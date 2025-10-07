/**
 * Unit tests for logger.ts
 * ロギング機能・フォーマット・時間測定・コマンド追跡の検証
 */

import { Logger } from '../../src/utils/logger.js';
import { LOG_PREFIX } from '../../src/constants.js';

describe('Logger', () => {
  // コンソールスパイの設定
  let consoleSpy: {
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
    log: jest.SpyInstance;
  };

  beforeEach(() => {
    // 各テスト前にコンソールをモック
    consoleSpy = {
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      log: jest.spyOn(console, 'log').mockImplementation(() => {})
    };

    // Dateのモック（時間測定テスト用）
    jest.useFakeTimers();
  });

  afterEach(() => {
    // スパイとタイマーをリセット
    jest.restoreAllMocks();
    jest.useRealTimers();
    
    // コマンド追跡のクリーンアップ
    (Logger as any)._commandStartTimes.clear();
  });

  describe('formatMessage', () => {
    test('メッセージの基本フォーマット', () => {
      Logger.log('test message');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} test message\n`);
    });

    test('空メッセージのフォーマット', () => {
      Logger.log('');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} \n`);
    });

    test('特殊文字を含むメッセージのフォーマット', () => {
      Logger.log('Message with "quotes" and \n newlines');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} Message with "quotes" and \n newlines\n`);
    });

    test('日本語メッセージのフォーマット', () => {
      Logger.log('日本語メッセージ');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} 日本語メッセージ\n`);
    });
  });

  describe('log', () => {
    test('基本的なログ出力', () => {
      Logger.log('info message');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} info message\n`);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    });

    test('追加引数付きログ出力', () => {
      const obj = { key: 'value' };
      const num = 42;
      
      Logger.log('message with args', obj, num);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} message with args\n`, obj, num);
    });

    test('複数の追加引数', () => {
      Logger.log('multiple args', 1, 'two', [3], { four: 4 });
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} multiple args\n`,
        1, 'two', [3], { four: 4 }
      );
    });
  });

  describe('warn', () => {
    test('基本的な警告出力', () => {
      Logger.warn('warning message');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} warning message\n`);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    });

    test('追加引数付き警告出力', () => {
      const error = new Error('test error');
      
      Logger.warn('warning with error', error);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} warning with error\n`, error);
    });
  });

  describe('error', () => {
    test('基本的なエラー出力', () => {
      Logger.error('error message');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(`${LOG_PREFIX} error message\n`);
      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    test('エラーオブジェクト付きエラー出力', () => {
      const error = new Error('test error');
      
      Logger.error('Error occurred', error);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(`${LOG_PREFIX} Error occurred\n`, error);
    });

    test('スタックトレース情報の出力', () => {
      const error = new Error('detailed error');
      error.stack = 'Error: detailed error\n    at test.js:1:1';
      
      Logger.error('Stack trace test', error);
      
      expect(consoleSpy.error).toHaveBeenCalledWith(`${LOG_PREFIX} Stack trace test\n`, error);
    });
  });

  describe('debug', () => {
    test('基本的なデバッグ出力', () => {
      Logger.debug('debug message');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} debug message\n`);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    });

    test('オブジェクト付きデバッグ出力', () => {
      const debugData = { step: 1, data: 'test' };
      
      Logger.debug('Debug step', debugData);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} Debug step\n`, debugData);
    });
  });

  describe('toolInvocation', () => {
    test('ツール呼び出しログ', () => {
      const args = { prompt: 'test', model: 'gemini-pro' };
      
      Logger.toolInvocation('test-tool', args);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} Raw:\n`,
        JSON.stringify(args, null, 2)
      );
    });

    test('複雑なオブジェクトの整形出力', () => {
      const complexArgs = {
        prompt: 'complex test',
        nested: { a: 1, b: [2, 3, 4] },
        array: ['item1', 'item2']
      };
      
      Logger.toolInvocation('complex-tool', complexArgs);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} Raw:\n`,
        JSON.stringify(complexArgs, null, 2)
      );
    });

    test('nullやundefinedを含む引数', () => {
      const argsWithNulls = {
        prompt: 'test',
        optional: null,
        missing: undefined
      };
      
      Logger.toolInvocation('null-tool', argsWithNulls);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} Raw:\n`,
        JSON.stringify(argsWithNulls, null, 2)
      );
    });

    test('空オブジェクトの処理', () => {
      Logger.toolInvocation('empty-tool', {});
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} Raw:\n`,
        JSON.stringify({}, null, 2)
      );
    });
  });

  describe('toolParsedArgs', () => {
    test('プロンプトのみの出力', () => {
      Logger.toolParsedArgs('test prompt');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} Parsed prompt: "test prompt"\n`);
    });

    test('モデル・サンドボックス引数の無視', () => {
      // toolParsedArgsは現在promptのみ出力している
      Logger.toolParsedArgs('prompt with extras', 'gemini-pro', true);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} Parsed prompt: "prompt with extras"\n`);
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
    });

    test('空プロンプトの処理', () => {
      Logger.toolParsedArgs('');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} Parsed prompt: ""\n`);
    });

    test('特殊文字を含むプロンプト', () => {
      Logger.toolParsedArgs('Prompt with "quotes" and \n newlines');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(`${LOG_PREFIX} Parsed prompt: "Prompt with "quotes" and \n newlines"\n`);
    });
  });

  describe('commandExecution', () => {
    test('基本的なコマンド実行ログ', () => {
      const startTime = Date.now();
      
      Logger.commandExecution('echo', ['hello', 'world'], startTime);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} [${startTime}] Starting: echo "hello" "world"\n`
      );
    });

    test('引数なしコマンドの処理', () => {
      const startTime = Date.now();
      
      Logger.commandExecution('ls', [], startTime);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} [${startTime}] Starting: ls \n`
      );
    });

    test('特殊文字を含む引数の処理', () => {
      const startTime = Date.now();
      
      Logger.commandExecution('grep', ['pattern with spaces', '/path/to/file'], startTime);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} [${startTime}] Starting: grep "pattern with spaces" "/path/to/file"\n`
      );
    });

    test('コマンド追跡データの保存', () => {
      const startTime = Date.now();
      
      Logger.commandExecution('test-command', ['arg1', 'arg2'], startTime);
      
      // プライベートプロパティにアクセスしてトラッキング確認
      const commandTimes = (Logger as any)._commandStartTimes;
      expect(commandTimes.has(startTime)).toBe(true);
      expect(commandTimes.get(startTime)).toEqual({
        command: 'test-command',
        args: ['arg1', 'arg2'],
        startTime
      });
    });

    test('複数コマンドの同時追跡', () => {
      const startTime1 = Date.now();
      const startTime2 = Date.now() + 100;
      
      Logger.commandExecution('command1', ['arg1'], startTime1);
      Logger.commandExecution('command2', ['arg2'], startTime2);
      
      const commandTimes = (Logger as any)._commandStartTimes;
      expect(commandTimes.size).toBe(2);
      expect(commandTimes.has(startTime1)).toBe(true);
      expect(commandTimes.has(startTime2)).toBe(true);
    });
  });

  describe('commandComplete', () => {
    test('基本的なコマンド完了ログ', () => {
      const startTime = 1000; // 固定開始時間
      jest.setSystemTime(3500); // 3.5秒後
      
      Logger.commandComplete(startTime, 0);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} [2.5s] Process finished with exit code: 0\n`
      );
    });

    test('エラー終了コードのログ', () => {
      const startTime = 2000;
      jest.setSystemTime(3200); // 1.2秒後
      
      Logger.commandComplete(startTime, 1);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} [1.2s] Process finished with exit code: 1\n`
      );
    });

    test('null終了コードの処理', () => {
      const startTime = 5000;
      jest.setSystemTime(5100); // 0.1秒後
      
      Logger.commandComplete(startTime, null);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} [0.1s] Process finished with exit code: null\n`
      );
    });

    test('出力長付きログ', () => {
      const startTime = 10000;
      jest.setSystemTime(13000); // 3秒後
      
      Logger.commandComplete(startTime, 0, 1024);
      
      expect(consoleSpy.warn).toHaveBeenCalledTimes(2);
      expect(consoleSpy.warn).toHaveBeenNthCalledWith(1,
        `${LOG_PREFIX} [3.0s] Process finished with exit code: 0\n`
      );
      expect(consoleSpy.warn).toHaveBeenNthCalledWith(2,
        `${LOG_PREFIX} Response: 1024 chars\n`
      );
    });

    test('出力長0の処理', () => {
      const startTime = 20000;
      jest.setSystemTime(21000); // 1秒後
      
      Logger.commandComplete(startTime, 0, 0);
      
      expect(consoleSpy.warn).toHaveBeenCalledTimes(2);
      expect(consoleSpy.warn).toHaveBeenNthCalledWith(2,
        `${LOG_PREFIX} Response: 0 chars\n`
      );
    });

    test('コマンド追跡データのクリーンアップ', () => {
      const startTime = Date.now();
      
      // まずコマンド実行をログ
      Logger.commandExecution('test-command', ['arg'], startTime);
      
      const commandTimes = (Logger as any)._commandStartTimes;
      expect(commandTimes.has(startTime)).toBe(true);
      
      // コマンド完了をログ
      Logger.commandComplete(startTime, 0);
      
      // 追跡データが削除されることを確認
      expect(commandTimes.has(startTime)).toBe(false);
    });

    test('存在しない追跡データでの完了処理', () => {
      const startTime = Date.now();
      
      // commandExecutionを呼ばずにcommandCompleteを呼ぶ
      expect(() => {
        Logger.commandComplete(startTime, 0);
      }).not.toThrow();
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Process finished with exit code: 0')
      );
    });

    test('時間計算の精度確認', () => {
      const startTime = 50000;
      jest.setSystemTime(50123); // 123ms後
      
      Logger.commandComplete(startTime, 0);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        `${LOG_PREFIX} [0.1s] Process finished with exit code: 0\n`
      );
    });
  });

  describe('統合シナリオ', () => {
    test('完全なコマンド実行フロー', () => {
      const startTime = 30000;
      
      // 1. コマンド実行開始
      Logger.commandExecution('gemini', ['-p', 'test prompt'], startTime);
      
      // 2. 時間経過
      jest.setSystemTime(35500); // 5.5秒後
      
      // 3. コマンド完了
      Logger.commandComplete(startTime, 0, 256);
      
      expect(consoleSpy.warn).toHaveBeenCalledTimes(3);
      
      // 実行開始ログ
      expect(consoleSpy.warn).toHaveBeenNthCalledWith(1,
        `${LOG_PREFIX} [${startTime}] Starting: gemini "-p" "test prompt"\n`
      );
      
      // 完了ログ
      expect(consoleSpy.warn).toHaveBeenNthCalledWith(2,
        `${LOG_PREFIX} [5.5s] Process finished with exit code: 0\n`
      );
      
      // 出力長ログ
      expect(consoleSpy.warn).toHaveBeenNthCalledWith(3,
        `${LOG_PREFIX} Response: 256 chars\n`
      );
    });

    test('複数の並行コマンド追跡', () => {
      const startTime1 = 40000;
      const startTime2 = 41000;
      
      Logger.commandExecution('command1', [], startTime1);
      Logger.commandExecution('command2', [], startTime2);
      
      // 最初のコマンドが完了
      jest.setSystemTime(42000); // 2秒後
      Logger.commandComplete(startTime1, 0);
      
      // 2番目のコマンドも完了
      jest.setSystemTime(44000); // 3秒後
      Logger.commandComplete(startTime2, 1);
      
      const commandTimes = (Logger as any)._commandStartTimes;
      expect(commandTimes.size).toBe(0); // 全て削除される
    });
  });

  describe('エラーハンドリング', () => {
    test('JSON.stringifyエラーの処理', () => {
      // 循環参照オブジェクトを作成
      const circular: any = { prop: 'value' };
      circular.self = circular;
      
      // JSON.stringifyが失敗することを確認（通常は例外が投げられる）
      expect(() => {
        Logger.toolInvocation('circular-tool', circular);
      }).toThrow();
    });

    test('非常に大きな数値での時間計算', () => {
      const largeStartTime = 999999998000;
      jest.setSystemTime(999999999000); // 1秒後
      
      Logger.commandComplete(largeStartTime, 0);
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Process finished with exit code: 0')
      );
    });
  });
});