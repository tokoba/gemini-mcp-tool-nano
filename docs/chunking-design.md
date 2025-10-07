# Chunking & Caching Detailed Design (token-counter based)

This document is the implementation blueprint for removing changeMode and introducing a token-based chunking and file-backed caching pipeline using token-counter (tiktoken).

It provides actionable details for developers: module APIs, data flow, configuration, error handling, security, and tests, so the refactor can be executed without ambiguity.

## Goals

- Replace changeMode (structured edit flow) with a generalized, secure, and robust chunking system.
- Split large Gemini outputs by token count (tiktoken) while preserving paragraph/line boundaries when possible.
- Persist large outputs as file-backed chunks with a 24h TTL and safe permissions.
- Keep the MCP surface simple: ask returns first chunk + cacheKey; fetch-chunk retrieves any chunk by index.

Non-goals
- Maintain changeMode output formats or backward compatibility.
- Perform summarization or any LLM post-processing — only minimal headers for UX clarity.

## Architecture Overview

- tokenization: `src/utils/tokenizer.ts` (abstraction over token-counter)
- chunking: `src/utils/chunker.ts` (paragraph-first recursive splitting using tokenizer)
- caching: `src/utils/chunkCache.ts` (file-backed persistence, uuid cacheKey)
- tools:
  - `ask-gemini.tool.ts`: run CLI → chunk by tokens → persist if needed → return first chunk and instructions
  - `fetch-chunk.tool.ts`: return exact chunk content for given cacheKey/index
  - `cleanup-cache.tool.ts`: manual TTL cleanup + stats
- executor: `src/utils/geminiExecutor.ts`: remove changeMode; return raw response only
- server: unchanged; progress notifications remain intact

## Data Flow

1) ask
   - preprocess `@` syntax as before
   - execute Gemini CLI (stdin prompt)
   - tokenize result → if `<= maxTokens` return unchanged; else chunk + save
   - return:
     - non-chunked: `Gemini response:` + full text
     - chunked: header `[RESPONSE CHUNKED]` + `cacheKey` + `Total Size: <tokens> tokens` + `fetch-chunk` usage + `[CHUNK 1 of N] + chunk_1`

2) fetch-chunk
   - `getChunk(cacheKey, index)` → return raw content or error message

3) cleanup-cache
   - `cleanupExpired()` → number of deleted entries
   - `getCacheStats()` → files/size/dir/ttlMs

## Module Specifications

### 1) tokenizer.ts

Purpose: decouple token-counting from the rest of the code; provide stable interface over token-counter (tiktoken).

API:
```ts
export interface TokenizerConfig {
  model: string;       // e.g. "gemini-2.5-pro", "gemini-2.5-flash"
  encoding?: string;   // explicit encoding if needed
}

export function countTokens(text: string, config?: TokenizerConfig): number;
export function sliceByTokenLimit(text: string, maxTokens: number, config?: TokenizerConfig): string[];
```

Notes:
- Model→encoding mapping is centralized here; default mapping covers supported models.
- `sliceByTokenLimit` returns an array of consecutive slices that each fit under `maxTokens`.
- If tokenizer initialization fails, we throw a typed error that the caller can catch to fallback to fixed-length char slicing (failsafe mode).

### 2) chunker.ts

Purpose: paragraph-first chunking with token constraints.

API:
```ts
export interface ChunkingOptions {
  maxTokens: number;            // target upper bound per chunk
  maxChunks?: number;           // optional hard cap (safety)
  preserveStructure?: boolean;  // default true: paragraph/line preference
  tokenizer?: TokenizerConfig;  // tokenizer configuration
}

export function chunkText(text: string, opts: ChunkingOptions): string[];
```

Algorithm:
- Normalize CRLF → `\n`
- If `countTokens(text) <= maxTokens`: return `[text]`
- Split by paragraphs (`\n\n`). For each paragraph:
  - If `countTokens(paragraph) <= maxTokens`: push
  - else split by line (`\n`), greedily accumulate lines until next line would exceed `maxTokens`
  - Push current accumulator and continue
- For any residue that still exceeds `maxTokens` (e.g., single extremely long line): use `sliceByTokenLimit` (token-based slicing)
- If `maxChunks` is set, truncate beyond the cap and surface a warning in logs; do not crash.

Edge Cases:
- Empty input → `[""]` or `[]`? Return `[""]` to maintain consistent type; callers can `trim()` if needed.
- Extremely large outputs → ensure linear-time behavior; avoid quadratic concatenations.

### 3) chunkCache.ts

Purpose: persist chunks on disk to enable post-hoc retrieval.

API:
```ts
export interface CacheResult {
  cacheKey: string;   // uuid v4
  chunkCount: number;
  totalSize: number;  // tokens (sum of chunks)
}

export function saveChunks(chunks: string[], meta?: { totalTokens?: number }): CacheResult;
export function getChunk(cacheKey: string, chunkIndex: number): string | null;
export function cleanupExpired(): Promise<number>;
export function getCacheStats(): { fileCount: number; totalSize: number; dir: string; ttlMs: number };
```

On-Disk Layout:
```
/tmp/gemini-mcp-chunks/
  └─ {uuid-cacheKey}/
       ├─ chunk-001.txt
       ├─ chunk-002.txt
       └─ metadata.json
```

metadata.json:
```json
{
  "cacheKey": "<uuid>",
  "totalChunks": 3,
  "createdAt": "2025-10-07T10:30:00.000Z",
  "expiresAt": "2025-10-08T10:30:00.000Z",
  "originalTokens": 65432,
  "chunkTokenSizes": [20000, 20000, 25432]
}
```

Security & Safety:
- Create directory with `0o700` and files with `0o600` permissions.
- `cacheKey` must be a valid UUID v4; reject others.
- TTL = 24h; Cleanup on write and via `cleanupExpired()`.
- Impose capped total directories and total bytes to prevent disk growth.

### 4) ask-gemini.tool.ts (new behavior)

Arguments: `prompt: string`, `model?: string`, `sandbox?: boolean`

Flow:
- Run `executeGeminiCLI` → `rawText`
- `chunks = chunkText(rawText, { maxTokens, tokenizer: { model } })`
- If `chunks.length === 1` → return `Gemini response:\n${rawText}`
- Else → `saveChunks(chunks, { totalTokens })` and return header:

```
[RESPONSE CHUNKED] Gemini's response was split into N chunks due to size.
Cache Key: <uuid>
Total Size: <tokens> tokens

To retrieve chunks, use:
fetch-chunk cacheKey=<uuid> chunkIndex=1

[CHUNK 1 of N]
<chunk_1_contents>
```

Notes:
- `maxTokens` default: 20,000 (configurable constant); provide a single source constant in `constants.ts`.
- `totalTokens = countTokens(rawText)` to display `Total Size`.

### 5) fetch-chunk.tool.ts (updated)

Arguments: `cacheKey: string`, `chunkIndex: number (>=1)`
- Returns raw chunk content on success
- On error: `Chunk not found: <cacheKey>#<chunkIndex>`

### 6) cleanup-cache.tool.ts (new)

- No arguments
- Returns: `Cleaned <n> expired files. Current: <fileCount> files, <totalSize> bytes`

## Configuration

- `maxTokens`: default 20,000
- `ttlMs`: default 24h
- `maxCacheDirs`: default 1000 (example; adjust based on environment)
- `encodingMap`: model→tiktoken encoding mapping in `tokenizer.ts`

Define these in one place (e.g., `constants.ts`) or a dedicated `config.ts` to avoid drift.

## Error Handling

- Tokenizer init failure → log warning; fallback to fixed-length char slicing for this run; include note in returned header.
- File I/O error on save → log error; return non-chunked response (best-effort) with a warning.
- Invalid `cacheKey`/`chunkIndex` in `fetch-chunk` → uniform error message; do not leak paths.

## Security

- Strict path handling: never join user-provided strings except as validated UUID folder names under the cache root.
- Minimal leakage in errors; no full paths or environment details in user-facing messages.
- Permissions as noted; no world-readable artifacts.

## Testing Strategy

Unit Tests
- `tokenizer.ts`: count and slice determinism for short/long/multilingual strings; model mapping
- `chunker.ts`: paragraph→line→token-slice progression; boundary values near `maxTokens`; very long single line
- `chunkCache.ts`: save/get/TTL expiration, corrupted metadata handling, permission failures (mock), capacity enforcement

Integration Tests (tools)
- `ask`: non-chunked small output; borderline size; large output chunked with proper header and first chunk content
- `fetch-chunk`: valid/invalid indices; expired/not-found keys
- `cleanup-cache`: deletion count + stats format

Performance
- Measure chunking and caching for 100KB–2MB outputs; ensure linear-ish timing and acceptable memory usage

Acceptance Criteria
- No residual changeMode imports or code paths (repo-wide search yields 0)
- ask returns correct header for chunked outputs; all chunks retrievable and reconstruct the original response
- Cache auto-expires at 24h; corrupted entries self-heal by deletion
- Tests cover boundary and multilingual cases; integration paths validated

## Migration Notes

- Breaking change: remove `changeMode`, `chunkIndex`, `chunkCacheKey` from ask schema
- Document the new behavior prominently in README/CLAUDE.md
- Provide examples of chunked replies and `fetch-chunk` usage

## Rollout Plan

1) Implement `tokenizer.ts` and `chunker.ts` with tests
2) Replace `chunkCache.ts`; add tests
3) Update `ask-gemini.tool.ts` and `fetch-chunk.tool.ts`; add `cleanup-cache.tool.ts`
4) Remove changeMode modules and branches; update `geminiExecutor.ts`
5) Update docs and announce breaking change

