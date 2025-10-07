/**
 * Unit tests for simple-tools.ts
 * pingTool・helpTool の基本機能とエラーハンドリングの検証
 */

import { pingTool, helpTool } from '../../src/tools/simple-tools.js';
import { executeCommand } from '../../src/utils/commandExecutor.js';

// commandExecutor をモック
jest.mock('../../src/utils/commandExecutor.js', () => ({
  executeCommand: jest.fn()
}));

const mockExecuteCommand = executeCommand as jest.MockedFunction<typeof executeCommand>;

describe('simple-tools', () => {
  beforeEach(() => {
    // 各テスト前にモックをリセット
    mockExecuteCommand.mockReset();
  });

  describe('pingTool', () => {
    test('基本的なecho機能', async () => {
      mockExecuteCommand.mockResolvedValue('test message');
      
      const result = await pingTool.execute({ prompt: 'test message' });
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('echo', ['test message'], undefined);
      expect(result).toBe('test message');
    });

    test('promptフィールドによるメッセージ指定', async () => {
      mockExecuteCommand.mockResolvedValue('hello world');
      
      const result = await pingTool.execute({ prompt: 'hello world' });
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('echo', ['hello world'], undefined);
      expect(result).toBe('hello world');
    });

    test('messageフィールドによるメッセージ指定 (レガシー)', async () => {
      mockExecuteCommand.mockResolvedValue('legacy message');
      
      // messageフィールドを使用する場合のテスト
      const result = await pingTool.execute({ message: 'legacy message' } as any);
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('echo', ['legacy message'], undefined);
      expect(result).toBe('legacy message');
    });

    test('空文字列の場合のデフォルトメッセージ', async () => {
      mockExecuteCommand.mockResolvedValue('Pong!');
      
      const result = await pingTool.execute({ prompt: '' });
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('echo', ['Pong!'], undefined);
      expect(result).toBe('Pong!');
    });

    test('promptが未定義の場合のデフォルトメッセージ', async () => {
      mockExecuteCommand.mockResolvedValue('Pong!');
      
      const result = await pingTool.execute({} as any);
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('echo', ['Pong!'], undefined);
      expect(result).toBe('Pong!');
    });

    test('onProgressコールバックの伝播', async () => {
      mockExecuteCommand.mockResolvedValue('progress test');
      const onProgress = jest.fn();
      
      const result = await pingTool.execute({ prompt: 'test' }, onProgress);
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('echo', ['test'], onProgress);
      expect(result).toBe('progress test');
    });

    test('executeCommandエラーの伝播', async () => {
      const error = new Error('Command execution failed');
      mockExecuteCommand.mockRejectedValue(error);
      
      await expect(pingTool.execute({ prompt: 'test' })).rejects.toThrow('Command execution failed');
    });

    test('日本語メッセージの処理', async () => {
      mockExecuteCommand.mockResolvedValue('こんにちは世界');
      
      const result = await pingTool.execute({ prompt: 'こんにちは世界' });
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('echo', ['こんにちは世界'], undefined);
      expect(result).toBe('こんにちは世界');
    });

    test('特殊文字を含むメッセージの処理', async () => {
      const specialMessage = 'Hello "world" & universe!';
      mockExecuteCommand.mockResolvedValue(specialMessage);
      
      const result = await pingTool.execute({ prompt: specialMessage });
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('echo', [specialMessage], undefined);
      expect(result).toBe(specialMessage);
    });
  });

  describe('helpTool', () => {
    test('基本的なヘルプコマンド実行', async () => {
      mockExecuteCommand.mockResolvedValue('Gemini CLI help text');
      
      const result = await helpTool.execute({});
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('gemini', ['-help'], undefined);
      expect(result).toBe('Gemini CLI help text');
    });

    test('onProgressコールバックの伝播', async () => {
      mockExecuteCommand.mockResolvedValue('Help with progress');
      const onProgress = jest.fn();
      
      const result = await helpTool.execute({}, onProgress);
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('gemini', ['-help'], onProgress);
      expect(result).toBe('Help with progress');
    });

    test('引数が渡されても無視されること', async () => {
      mockExecuteCommand.mockResolvedValue('Help text');
      
      // 余分な引数を渡してもhelpToolは無視する
      const result = await helpTool.execute({ unexpectedArg: 'ignored' } as any);
      
      expect(mockExecuteCommand).toHaveBeenCalledWith('gemini', ['-help'], undefined);
      expect(result).toBe('Help text');
    });

    test('executeCommandエラーの伝播', async () => {
      const error = new Error('Gemini command not found');
      mockExecuteCommand.mockRejectedValue(error);
      
      await expect(helpTool.execute({})).rejects.toThrow('Gemini command not found');
    });

    test('長いヘルプテキストの処理', async () => {
      const longHelpText = 'Help text\n'.repeat(100);
      mockExecuteCommand.mockResolvedValue(longHelpText);
      
      const result = await helpTool.execute({});
      
      expect(result).toBe(longHelpText);
      expect(mockExecuteCommand).toHaveBeenCalledWith('gemini', ['-help'], undefined);
    });
  });

  describe('ツール定義の検証', () => {
    test('pingToolの基本プロパティ', () => {
      expect(pingTool.name).toBe('ping');
      expect(pingTool.description).toBe('Echo');
      expect(pingTool.category).toBe('simple');
      expect(pingTool.prompt?.description).toBe('Echo test message with structured response.');
      expect(typeof pingTool.execute).toBe('function');
      expect(pingTool.zodSchema).toBeDefined();
    });

    test('helpToolの基本プロパティ', () => {
      expect(helpTool.name).toBe('Help');
      expect(helpTool.description).toBe('receive help information');
      expect(helpTool.category).toBe('simple');
      expect(helpTool.prompt?.description).toBe('receive help information');
      expect(typeof helpTool.execute).toBe('function');
      expect(helpTool.zodSchema).toBeDefined();
    });

    test('Zodスキーマの検証 - pingTool', () => {
      // 有効な引数
      const validArgs = { prompt: 'test message' };
      expect(() => pingTool.zodSchema.parse(validArgs)).not.toThrow();
      
      // デフォルト値の適用
      const emptyArgs = {};
      const parsed = pingTool.zodSchema.parse(emptyArgs);
      expect(parsed.prompt).toBe('');
    });

    test('Zodスキーマの検証 - helpTool', () => {
      // 空オブジェクトは有効
      const validArgs = {};
      expect(() => helpTool.zodSchema.parse(validArgs)).not.toThrow();
      
      // 余分なプロパティがあっても問題なし
      const extraArgs = { extraProp: 'ignored' };
      expect(() => helpTool.zodSchema.parse(extraArgs)).not.toThrow();
    });
  });

  describe('エラーハンドリング', () => {
    test('executeCommandタイムアウトエラー', async () => {
      const timeoutError = new Error('Command execution timeout');
      mockExecuteCommand.mockRejectedValue(timeoutError);
      
      await expect(pingTool.execute({ prompt: 'test' })).rejects.toThrow('Command execution timeout');
      await expect(helpTool.execute({})).rejects.toThrow('Command execution timeout');
    });

    test('executeCommandネットワークエラー', async () => {
      const networkError = new Error('Network unreachable');
      mockExecuteCommand.mockRejectedValue(networkError);
      
      await expect(pingTool.execute({ prompt: 'test' })).rejects.toThrow('Network unreachable');
      await expect(helpTool.execute({})).rejects.toThrow('Network unreachable');
    });

    test('非同期エラーの適切な処理', async () => {
      // Promiseが即座に拒否される場合
      mockExecuteCommand.mockImplementation(() => {
        return Promise.reject(new Error('Async error'));
      });
      
      await expect(pingTool.execute({ prompt: 'test' })).rejects.toThrow('Async error');
    });
  });
});