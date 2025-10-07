import { z } from "zod";
import { ERROR_MESSAGES, STATUS_MESSAGES, CHUNKING } from "../constants.js";
import { executeGeminiCLI } from "../utils/geminiExecutor.js";
import { countTokens } from "../utils/tokenizer.js";
import { chunkText } from "../utils/chunker.js";
import { saveChunks } from "../utils/chunkCache.js";
import { UnifiedTool } from "./registry.js";

const askGeminiArgsSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      "Analysis request. Use @-syntax to include file or directory paths. For existing paths, prefer '@/absolute_path', '@/file.ext', or '@/directory'. For non-existing or conceptual references, intentionally use '@ ' (a space after '@') to avoid Gemini misinterpreting it as a path. You can also use the explicit form '[filepath: /absolute_file_path]'. Examples: '@/home/username/project/largefile.js explain what this does' or 'read [filepath: /home/username/project/largefile.js] and review the duplicated functions'. The server normalizes references: existing paths are rewritten to '@/...' and non-existing references become '@ ' to prevent errors."
    ),
  model: z
    .string()
    .default("gemini-2.5-pro")
    .describe(
      "Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro)."
    ),
  sandbox: z
    .boolean()
    .default(false)
    .describe(
      "Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment"
    ),
});

export const askGeminiTool: UnifiedTool = {
  name: "ask",
  description:
    "model selection [-m], sandbox [-s] for Gemini AI responses",
  zodSchema: askGeminiArgsSchema,
  prompt: {
    description:
      "Execute 'gemini -p <prompt>' to get Gemini AI's response.",
  },
  category: "gemini",
  execute: async (args, onProgress) => {
    const { prompt, model, sandbox } = args;
    if (!prompt?.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    const result = await executeGeminiCLI(
      prompt as string,
      model as string | undefined,
      !!sandbox,
      onProgress
    );

    // Evaluate response size and determine if chunking is needed
    const tokenCount = countTokens(result);
    
    if (tokenCount <= CHUNKING.TOKEN_THRESHOLD) {
      // Small response - return directly
      return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result}`;
    }
    
    // Large response - chunk and cache
    onProgress?.('Large response detected. Processing chunks...');
    
    const chunks = chunkText(result, {
      maxTokens: CHUNKING.MAX_TOKENS_PER_CHUNK,
      preserveStructure: true
    });
    
    const cacheResult = await saveChunks(chunks, { totalTokens: tokenCount });
    
    // Return structured response for chunked content
    const response = {
      isChunked: true,
      cacheId: cacheResult.cacheKey,
      totalChunks: cacheResult.chunkCount,
      chunkNumber: 1,
      content: chunks[0]
    };
    
    return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${JSON.stringify(response, null, 2)}\n\nℹ️ This response was chunked due to size (${tokenCount} tokens). Use the fetch-chunk tool with cacheId "${cacheResult.cacheKey}" to retrieve additional chunks (2-${cacheResult.chunkCount}).`;
  },
};
