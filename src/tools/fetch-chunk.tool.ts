import { z } from "zod";
import { getChunk } from "../utils/chunkCache.js";
import { UnifiedTool } from "./registry.js";

const fetchChunkArgsSchema = z.object({
  cacheId: z
    .string()
    .min(1)
    .describe(
      "Cache ID returned by ask-gemini tool when response was chunked. This is a UUID that identifies the cached response chunks."
    ),
  chunkNumber: z
    .number()
    .int()
    .min(1)
    .describe(
      "Chunk number to retrieve (1-based index). Use the totalChunks value from ask-gemini response to know the valid range."
    ),
});

export const fetchChunkTool: UnifiedTool = {
  name: "fetch-chunk",
  description:
    "Retrieve a specific chunk from a cached response using the cache ID and chunk number provided by ask-gemini tool",
  zodSchema: fetchChunkArgsSchema,
  prompt: {
    description:
      "Fetch a specific chunk of a large response that was previously chunked by the ask-gemini tool.",
  },
  category: "gemini",
  execute: async (args, onProgress) => {
    const { cacheId, chunkNumber } = args;

    onProgress?.(`Retrieving chunk ${chunkNumber} from cache ${cacheId}...`);

    try {
      // Retrieve the chunk from cache
      const chunkContent = await getChunk(cacheId as string, chunkNumber as number);

      if (chunkContent === null) {
        // This should not happen with the improved getChunk, but keeping for safety
        const errorResponse = {
          error: "Unexpected null result from cache",
          cacheId: cacheId as string,
          requestedChunk: chunkNumber as number,
        };
        return `❌ Chunk retrieval failed:\n${JSON.stringify(errorResponse, null, 2)}\n\nThis is an unexpected error. Please report this issue.`;
      }

      // Successful retrieval - return in the same format as ask-gemini chunked responses
      // Note: We don't have totalChunks info here, so we'll return a simplified format
      const response = {
        isChunked: true,
        cacheId: cacheId as string,
        chunkNumber: chunkNumber as number,
        content: chunkContent,
      };

      return `📄 Chunk ${chunkNumber} retrieved successfully:\n${JSON.stringify(response, null, 2)}`;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorResponse = {
        error: `Failed to retrieve chunk: ${errorMessage}`,
        cacheId: cacheId as string,
        requestedChunk: chunkNumber as number,
      };
      return `❌ Chunk retrieval error:\n${JSON.stringify(errorResponse, null, 2)}`;
    }
  },
};