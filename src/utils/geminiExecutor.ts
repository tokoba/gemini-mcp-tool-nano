import { CLI, ERROR_MESSAGES, MODELS, STATUS_MESSAGES } from "../constants.js";
import { executeCommand } from "./commandExecutor.js";
import { Logger } from "./logger.js";

import { preprocessAtSymbols } from "./promptPreprocessor.js";

export async function executeGeminiCLI(
  prompt: string,
  model?: string,
  sandbox?: boolean,
  onProgress?: (newOutput: string) => void
): Promise<string> {
  const args = [];
  if (model) {
    args.push(CLI.FLAGS.MODEL, model);
  }
  if (sandbox) {
    args.push(CLI.FLAGS.SANDBOX);
  }

  // セキュリティ向上: 常にstdin使用でコマンドインジェクション攻撃を防止
  // V2: プロンプトはすべてstdin経由で渡す（シェルエスケープ問題を根本的に解決）
  const useStdin = true; // 常にstdin使用
  let stdinData: string | undefined;

  // @ symbol processing
  try {
    const finalPrompt = await preprocessAtSymbols(prompt);
    stdinData = finalPrompt;
    Logger.debug(
      `Using stdin for prompt (length: ${finalPrompt.length} chars)`
    );
  } catch (error) {
    Logger.error(`@ symbol preprocessing failed: ${error}`);
    throw error;
  }

  // Log the exact command being executed for debugging
  Logger.debug(
    `Executing command: ${CLI.COMMANDS.GEMINI} ${args.join(" ")}${
      useStdin ? " [prompt via stdin]" : ""
    }`
  );

  try {
    return await executeCommand(
      CLI.COMMANDS.GEMINI,
      args,
      onProgress,
      stdinData
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes(ERROR_MESSAGES.QUOTA_EXCEEDED) &&
      model !== MODELS.FLASH
    ) {
      Logger.warn(
        `${ERROR_MESSAGES.QUOTA_EXCEEDED}. Falling back to ${MODELS.FLASH}.`
      );
      await sendStatusMessage(STATUS_MESSAGES.FLASH_RETRY);
      const fallbackArgs = [];
      fallbackArgs.push(CLI.FLAGS.MODEL, MODELS.FLASH);
      if (sandbox) {
        fallbackArgs.push(CLI.FLAGS.SANDBOX);
      }

      // V2: フォールバックでも常にstdin使用（セキュリティ統一）
      // stdinDataは既に処理済みなので再利用

      // Log the fallback command being executed for debugging
      Logger.debug(
        `Executing fallback command: ${CLI.COMMANDS.GEMINI} ${fallbackArgs.join(
          " "
        )}${useStdin ? " [prompt via stdin]" : ""}`
      );

      try {
        const result = await executeCommand(
          CLI.COMMANDS.GEMINI,
          fallbackArgs,
          onProgress,
          stdinData
        );
        Logger.warn(`Successfully executed with ${MODELS.FLASH} fallback.`);
        await sendStatusMessage(STATUS_MESSAGES.FLASH_SUCCESS);
        return result;
      } catch (fallbackError) {
        const fallbackErrorMessage =
          fallbackError instanceof Error
            ? fallbackError.message
            : String(fallbackError);
        throw new Error(
          `${MODELS.PRO} quota exceeded, ${MODELS.FLASH} fallback also failed: ${fallbackErrorMessage}`
        );
      }
    } else {
      throw error;
    }
  }
}

// Placeholder
async function sendStatusMessage(message: string): Promise<void> {
  Logger.debug(`Status: ${message}`);
}
