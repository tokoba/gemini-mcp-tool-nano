# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Development Commands

- **Build**: `npm run build` - Compiles TypeScript to JavaScript in `dist/`
- **Development**: `npm run dev` - Build and start the MCP server for testing
- **Type Checking**: `npm run lint` - Run TypeScript compiler without emit (no actual tests yet)
- **Documentation**: `npm run docs:dev` - Start VitePress documentation server
- **Publish Prep**: `npm run prepublishOnly` - Builds before publishing to npm

## Architecture Overview

This is an **MCP (Model Context Protocol) Server** that bridges Claude Code with Google Gemini CLI. The architecture follows a unified tool registry pattern:

### Core Components

1. **MCP Server** (`src/index.ts`):
   - Uses `@modelcontextprotocol/sdk` for stdio transport
   - Implements progress notifications for long-running operations
   - Handles tool execution with error recovery

2. **Unified Tool Registry** (`src/tools/registry.ts`):
   - Central registration system for all tools
   - Uses Zod schemas for argument validation
   - Automatic JSON Schema generation for MCP protocol
   - Supports both tools and prompts

3. **Tool Categories**:
   - **Gemini Tools**: `ask-gemini`, `brainstorm` - integrate with Gemini CLI
   - **Simple Tools**: `ping`, `Help` - basic utilities  
   - **Utility Tools**: `fetch-chunk`, `timeout-test` - system utilities

4. **Change Mode System**:
   - Structured editing mode that formats Gemini responses into actionable edits
   - Uses chunking system (`src/utils/changeModeChunker.ts`) for large responses
   - Cache system (`src/utils/chunkCache.ts`) for continuation support

### Key Technical Patterns

- **Progress Tracking**: All long operations support real-time progress notifications every 25 seconds
- **Error Handling**: Zod validation with structured error messages
- **Command Execution**: Wraps Gemini CLI with proper stdio handling (`src/utils/geminiExecutor.ts`)
- **File Reference Support**: Uses `@` syntax to reference files/directories in Gemini prompts

## Tool Development

When adding new tools:

1. Create tool file in `src/tools/` implementing `UnifiedTool` interface
2. Define Zod schema for arguments with descriptions
3. Register in `src/tools/index.ts` via `toolRegistry.push()`
4. Use `onProgress` callback for long operations
5. Support `changeMode` parameter if tool provides edits

Example tool structure:

```typescript
export const myTool: UnifiedTool = {
  name: "my-tool",
  description: "Description for MCP client",
  zodSchema: mySchema,
  execute: async (args, onProgress) => { /* implementation */ }
};
```

## Gemini Integration

The primary integration is through `ask-gemini` (short-name: `ask`) tool which:

- Executes `gemini -p "prompt"` with optional model selection (`-m`)
- Supports sandbox mode (`-s`) for safe code execution  
- Has `changeMode` for structured edit responses
- Supports file references via `@` syntax (e.g., `@src/index.ts explain this`)

## Important Files

- `src/index.ts` - MCP server entry point with progress system
- `src/tools/registry.ts` - Tool registration and validation system
- `src/tools/ask-gemini.tool.ts` - Primary Gemini CLI integration
- `src/utils/geminiExecutor.ts` - Command execution with progress tracking
- `src/utils/changeModeParser.ts` - Parses Gemini output into structured edits
- `package.json` - Contains all development scripts and dependencies

## Development Notes

- TypeScript target: ES2022 with Node16 module resolution
- Uses stdio transport for MCP communication
- All tools support progress notifications via callbacks
- VitePress documentation in `docs/` directory
- No actual test framework currently implemented (placeholder only)
