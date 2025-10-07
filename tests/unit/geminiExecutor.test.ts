/**
 * Unit tests for geminiExecutor.ts
 * Gemini CLI統合・フォールバック処理・セキュリティ・プロンプト前処理の検証
 */

import { executeGeminiCLI } from '../../src/utils/geminiExecutor.js';
import { executeCommand } from '../../src/utils/commandExecutor.js';
import { preprocessAtSymbols } from '../../src/utils/promptPreprocessor.js';
import { Logger } from '../../src/utils/logger.js';
import { CLI, ERROR_MESSAGES, MODELS, STATUS_MESSAGES } from '../../src/constants.js';

// 依存関数をモック
jest.mock('../../src/utils/commandExecutor.js', () => ({
  executeCommand: jest.fn()
}));

jest.mock('../../src/utils/promptPreprocessor.js', () => ({
  preprocessAtSymbols: jest.fn()
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const mockExecuteCommand = executeCommand as jest.MockedFunction<typeof executeCommand>;
const mockPreprocessAtSymbols = preprocessAtSymbols as jest.MockedFunction<typeof preprocessAtSymbols>;
const mockLogger = Logger as jest.Mocked<typeof Logger>;

describe('geminiExecutor', () => {
  beforeEach(() => {
    // モックをリセット
    mockExecuteCommand.mockReset();
    mockPreprocessAtSymbols.mockReset();
    jest.clearAllMocks();

    // デフォルトの動作を設定
    mockPreprocessAtSymbols.mockResolvedValue('processed prompt');
    mockExecuteCommand.mockResolvedValue('gemini response');
  });

  describe('基本的なGemini CLI実行', () => {
    test('最小限の引数での実行', async () => {
      const result = await executeGeminiCLI('test prompt');

      expect(mockPreprocessAtSymbols).toHaveBeenCalledWith('test prompt');
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [],
        undefined,
        'processed prompt'
      );
      expect(result).toBe('gemini response');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Using stdin for prompt (length: 16 chars)'
      );
    });

    test('モデル指定での実行', async () => {
      const result = await executeGeminiCLI('test prompt', 'gemini-pro');

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.MODEL, 'gemini-pro'],
        undefined,
        'processed prompt'
      );
      expect(result).toBe('gemini response');
    });

    test('サンドボックス有効での実行', async () => {
      const result = await executeGeminiCLI('test prompt', undefined, true);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.SANDBOX],
        undefined,
        'processed prompt'
      );
      expect(result).toBe('gemini response');
    });

    test('モデルとサンドボックス両方指定', async () => {
      const result = await executeGeminiCLI('test prompt', 'gemini-2.5-pro', true);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.MODEL, 'gemini-2.5-pro', CLI.FLAGS.SANDBOX],
        undefined,
        'processed prompt'
      );
      expect(result).toBe('gemini response');
    });

    test('onProgressコールバック付き実行', async () => {
      const onProgress = jest.fn();
      const result = await executeGeminiCLI('test prompt', undefined, false, onProgress);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [],
        onProgress,
        'processed prompt'
      );
      expect(result).toBe('gemini response');
    });
  });

  describe('プロンプト前処理', () => {
    test('@シンボル前処理の成功', async () => {
      mockPreprocessAtSymbols.mockResolvedValue('processed with @files');

      const result = await executeGeminiCLI('prompt with @file.txt');

      expect(mockPreprocessAtSymbols).toHaveBeenCalledWith('prompt with @file.txt');
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [],
        undefined,
        'processed with @files'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Using stdin for prompt (length: 21 chars)'
      );
      expect(result).toBe('gemini response');
    });

    test('@シンボル前処理のエラー', async () => {
      const preprocessError = new Error('File not found: @nonexistent.txt');
      mockPreprocessAtSymbols.mockRejectedValue(preprocessError);

      await expect(executeGeminiCLI('prompt with @nonexistent.txt')).rejects.toThrow('File not found: @nonexistent.txt');
      
      expect(mockLogger.error).toHaveBeenCalledWith('@ symbol preprocessing failed: Error: File not found: @nonexistent.txt');
      expect(mockExecuteCommand).not.toHaveBeenCalled();
    });

    test('長いプロンプトの処理', async () => {
      const longPrompt = 'A'.repeat(10000);
      mockPreprocessAtSymbols.mockResolvedValue(longPrompt);

      await executeGeminiCLI(longPrompt);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Using stdin for prompt (length: 10000 chars)'
      );
    });

    test('空プロンプトの処理', async () => {
      mockPreprocessAtSymbols.mockResolvedValue('');

      const result = await executeGeminiCLI('');

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [],
        undefined,
        ''
      );
      expect(result).toBe('gemini response');
    });
  });

  describe('フォールバック処理', () => {
    test('quota exceeded エラーでのフォールバック', async () => {
      // 最初の実行はquota exceeded エラー
      const quotaError = new Error(`Some error ${ERROR_MESSAGES.QUOTA_EXCEEDED} details`);
      mockExecuteCommand
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValueOnce('flash response');

      const result = await executeGeminiCLI('test prompt', 'gemini-2.5-pro');

      // 最初の実行
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(1,
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.MODEL, 'gemini-2.5-pro'],
        undefined,
        'processed prompt'
      );

      // フォールバック実行
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(2,
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.MODEL, MODELS.FLASH],
        undefined,
        'processed prompt'
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `${ERROR_MESSAGES.QUOTA_EXCEEDED}. Falling back to ${MODELS.FLASH}.`
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `Successfully executed with ${MODELS.FLASH} fallback.`
      );
      expect(result).toBe('flash response');
    });

    test('サンドボックス付きフォールバック', async () => {
      const quotaError = new Error(`${ERROR_MESSAGES.QUOTA_EXCEEDED}`);
      mockExecuteCommand
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValueOnce('flash sandbox response');

      const result = await executeGeminiCLI('test prompt', 'gemini-2.5-pro', true);

      // フォールバック実行でサンドボックスフラグが保持される
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(2,
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.MODEL, MODELS.FLASH, CLI.FLAGS.SANDBOX],
        undefined,
        'processed prompt'
      );

      expect(result).toBe('flash sandbox response');
    });

    test('既にflashモデルの場合のフォールバック無効', async () => {
      const quotaError = new Error(`${ERROR_MESSAGES.QUOTA_EXCEEDED}`);
      mockExecuteCommand.mockRejectedValue(quotaError);

      await expect(executeGeminiCLI('test prompt', MODELS.FLASH)).rejects.toThrow();

      // フォールバックは実行されない
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Falling back to')
      );
    });

    test('フォールバック自体が失敗する場合', async () => {
      const quotaError = new Error(`${ERROR_MESSAGES.QUOTA_EXCEEDED}`);
      const fallbackError = new Error('Flash model also failed');
      
      mockExecuteCommand
        .mockRejectedValueOnce(quotaError)
        .mockRejectedValueOnce(fallbackError);

      await expect(executeGeminiCLI('test prompt', 'gemini-2.5-pro')).rejects.toThrow(
        `${MODELS.PRO} quota exceeded, ${MODELS.FLASH} fallback also failed: Flash model also failed`
      );

      expect(mockExecuteCommand).toHaveBeenCalledTimes(2);
    });

    test('非quotaエラーの場合のフォールバック無効', async () => {
      const networkError = new Error('Network connection failed');
      mockExecuteCommand.mockRejectedValue(networkError);

      await expect(executeGeminiCLI('test prompt')).rejects.toThrow('Network connection failed');

      // フォールバックは実行されない
      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Falling back to')
      );
    });
  });

  describe('ログ出力の検証', () => {
    test('デバッグログの出力', async () => {
      await executeGeminiCLI('test prompt', 'gemini-2.5-pro', true);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Using stdin for prompt (length: 16 chars)'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Executing command: ${CLI.COMMANDS.GEMINI} ${CLI.FLAGS.MODEL} gemini-2.5-pro ${CLI.FLAGS.SANDBOX} [prompt via stdin]`
      );
    });

    test('フォールバック時のデバッグログ', async () => {
      const quotaError = new Error(`${ERROR_MESSAGES.QUOTA_EXCEEDED}`);
      mockExecuteCommand
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValueOnce('flash response');

      await executeGeminiCLI('test prompt', 'gemini-2.5-pro');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Executing fallback command: ${CLI.COMMANDS.GEMINI} ${CLI.FLAGS.MODEL} ${MODELS.FLASH} [prompt via stdin]`
      );
    });

    test('ステータスメッセージの送信', async () => {
      const quotaError = new Error(`${ERROR_MESSAGES.QUOTA_EXCEEDED}`);
      mockExecuteCommand
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValueOnce('flash response');

      await executeGeminiCLI('test prompt', 'gemini-2.5-pro');

      // sendStatusMessage の呼び出し確認（Logger.debug で実装されている）
      expect(mockLogger.debug).toHaveBeenCalledWith(`Status: ${STATUS_MESSAGES.FLASH_RETRY}`);
      expect(mockLogger.debug).toHaveBeenCalledWith(`Status: ${STATUS_MESSAGES.FLASH_SUCCESS}`);
    });
  });

  describe('エラーハンドリング', () => {
    test('Error インスタンスの処理', async () => {
      const error = new Error('Specific error message');
      mockExecuteCommand.mockRejectedValue(error);

      await expect(executeGeminiCLI('test prompt')).rejects.toThrow('Specific error message');
    });

    test('非Error オブジェクトの処理', async () => {
      const stringError = 'String error';
      mockPreprocessAtSymbols.mockRejectedValue(stringError);

      await expect(executeGeminiCLI('test prompt')).rejects.toBe(stringError);
    });

    test('null/undefined エラーの処理', async () => {
      mockPreprocessAtSymbols.mockRejectedValue(null);

      await expect(executeGeminiCLI('test prompt')).rejects.toBe(null);
    });

    test('フォールバックでのError インスタンス処理', async () => {
      const quotaError = new Error(`${ERROR_MESSAGES.QUOTA_EXCEEDED}`);
      const fallbackError = new Error('Fallback specific error');
      
      mockExecuteCommand
        .mockRejectedValueOnce(quotaError)
        .mockRejectedValueOnce(fallbackError);

      await expect(executeGeminiCLI('test prompt', 'gemini-2.5-pro')).rejects.toThrow(
        `${MODELS.PRO} quota exceeded, ${MODELS.FLASH} fallback also failed: Fallback specific error`
      );
    });

    test('フォールバックでの非Error オブジェクト処理', async () => {
      const quotaError = new Error(`${ERROR_MESSAGES.QUOTA_EXCEEDED}`);
      
      mockExecuteCommand
        .mockRejectedValueOnce(quotaError)
        .mockRejectedValueOnce('Fallback string error');

      await expect(executeGeminiCLI('test prompt', 'gemini-2.5-pro')).rejects.toThrow(
        `${MODELS.PRO} quota exceeded, ${MODELS.FLASH} fallback also failed: Fallback string error`
      );
    });
  });

  describe('セキュリティ機能', () => {
    test('stdin使用の強制', async () => {
      await executeGeminiCLI('test prompt');

      // stdinDataが必ず渡されることを確認
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [],
        undefined,
        'processed prompt'
      );
    });

    test('コマンドインジェクション対策', async () => {
      const maliciousPrompt = 'test; rm -rf /';
      mockPreprocessAtSymbols.mockResolvedValue(maliciousPrompt);

      await executeGeminiCLI(maliciousPrompt);

      // 悪意あるコマンドが引数ではなくstdinで渡される
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [],
        undefined,
        maliciousPrompt
      );
      
      // 引数配列にはmaliciousPromptが含まれない
      const [, args] = mockExecuteCommand.mock.calls[0];
      expect(args).not.toContain(maliciousPrompt);
      expect(args).not.toContainEqual(expect.stringContaining('rm -rf'));
    });

    test('特殊文字を含むモデル名の処理', async () => {
      const modelWithSpecialChars = 'gemini"2.5-pro';
      
      await executeGeminiCLI('test prompt', modelWithSpecialChars);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.MODEL, modelWithSpecialChars],
        undefined,
        'processed prompt'
      );
    });
  });

  describe('プログレス処理', () => {
    test('プログレスコールバックの伝播', async () => {
      const onProgress = jest.fn();
      
      await executeGeminiCLI('test prompt', undefined, false, onProgress);

      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [],
        onProgress,
        'processed prompt'
      );
    });

    test('フォールバック時のプログレス継続', async () => {
      const quotaError = new Error(`${ERROR_MESSAGES.QUOTA_EXCEEDED}`);
      const onProgress = jest.fn();
      
      mockExecuteCommand
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValueOnce('flash response');

      await executeGeminiCLI('test prompt', 'gemini-2.5-pro', false, onProgress);

      // 両方の呼び出しでプログレスが渡される
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(1,
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.MODEL, 'gemini-2.5-pro'],
        onProgress,
        'processed prompt'
      );
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(2,
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.MODEL, MODELS.FLASH],
        onProgress,
        'processed prompt'
      );
    });
  });

  describe('統合シナリオ', () => {
    test('完全な実行フロー', async () => {
      const onProgress = jest.fn();
      mockPreprocessAtSymbols.mockResolvedValue('processed complex prompt @file');

      const result = await executeGeminiCLI(
        'complex prompt @file.txt',
        'gemini-2.5-pro',
        true,
        onProgress
      );

      expect(mockPreprocessAtSymbols).toHaveBeenCalledWith('complex prompt @file.txt');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Using stdin for prompt (length: 30 chars)'
      );
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.MODEL, 'gemini-2.5-pro', CLI.FLAGS.SANDBOX],
        onProgress,
        'processed complex prompt @file'
      );
      expect(result).toBe('gemini response');
    });

    test('フォールバック付き完全フロー', async () => {
      const quotaError = new Error(`Network ${ERROR_MESSAGES.QUOTA_EXCEEDED} timeout`);
      const onProgress = jest.fn();
      
      mockPreprocessAtSymbols.mockResolvedValue('processed fallback prompt');
      mockExecuteCommand
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValueOnce('successful flash response');

      const result = await executeGeminiCLI(
        'fallback test @config.json',
        'gemini-2.5-pro',
        true,
        onProgress
      );

      // プリプロセス確認
      expect(mockPreprocessAtSymbols).toHaveBeenCalledWith('fallback test @config.json');
      
      // 最初の試行
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(1,
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.MODEL, 'gemini-2.5-pro', CLI.FLAGS.SANDBOX],
        onProgress,
        'processed fallback prompt'
      );

      // フォールバック
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(2,
        CLI.COMMANDS.GEMINI,
        [CLI.FLAGS.MODEL, MODELS.FLASH, CLI.FLAGS.SANDBOX],
        onProgress,
        'processed fallback prompt'
      );

      expect(result).toBe('successful flash response');
    });
  });
});