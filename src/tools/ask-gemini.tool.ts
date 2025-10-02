import { z } from "zod";
import { ERROR_MESSAGES, STATUS_MESSAGES } from "../constants.js";
import {
  executeGeminiCLI,
  processChangeModeOutput,
} from "../utils/geminiExecutor.js";
import { UnifiedTool } from "./registry.js";

const askGeminiArgsSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      "Analysis request. Use `@ syntax` (`@/{absolute_file_path}`) or `[filepath: /{absolute_file_path}]`to include files (e.g., '@/home/username/project/largefile.js explain what this does' or `read [filepath: /home/username/project/largefile.js] and review the duplicated functions`) or ask general questions. If the the rensponse size is big, use `fetch-chunk` tool (`fetch-chunk cacheKey=<key> chunkIndex=<number>`) to get all the chunks of the response."
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
  changeMode: z
    .boolean()
    .default(true)
    .describe(
      "Enable structured change mode - formats prompts to prevent tool errors and returns structured edit suggestions that Claude can apply directly"
    ),
  chunkIndex: z
    .union([z.number(), z.string()])
    .optional()
    .describe(
      "Gemini could respond a huge sized response. `gemini-cli` mcp tool can divide the response and cache the huge response into some small chunks. Check the chunkCacheKey and read all the chunks after receiving the response. chunkIndex is a sequential number to determine which chunk to return (1-based)"
    ),
  chunkCacheKey: z
    .string()
    .optional()
    .describe("Optional cache key for continuation"),
});

export const askGeminiTool: UnifiedTool = {
  name: "ask",
  description:
    "model selection [-m], sandbox [-s], and changeMode:boolean for providing edits",
  zodSchema: askGeminiArgsSchema,
  prompt: {
    description:
      "Execute 'gemini -p <prompt>' to get Gemini AI's response. Supports enhanced change mode for structured edit suggestions.",
  },
  category: "gemini",
  execute: async (args, onProgress) => {
    const { prompt, model, sandbox, changeMode, chunkIndex, chunkCacheKey } =
      args;
    if (!prompt?.trim()) {
      throw new Error(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    }

    if (changeMode && chunkIndex && chunkCacheKey) {
      const indexNum =
        typeof chunkIndex === "string"
          ? Number(chunkIndex)
          : (chunkIndex as number);
      const normalizedKey = String(chunkCacheKey)
        .trim()
        .replace(/^['"]|['"]$/g, "");
      return processChangeModeOutput(
        "", // empty for cache path
        indexNum,
        normalizedKey,
        prompt as string
      );
    }

    const result = await executeGeminiCLI(
      prompt as string,
      model as string | undefined,
      !!sandbox,
      !!changeMode,
      onProgress
    );

    if (changeMode) {
      return processChangeModeOutput(
        result,
        args.chunkIndex as number | undefined,
        undefined,
        prompt as string
      );
    }
    return `${STATUS_MESSAGES.GEMINI_RESPONSE}\n${result}`; // changeMode false
  },
};
