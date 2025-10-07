/**
 * Unit tests for commandExecutor.ts
 * child_process統合・プラットフォーム対応・エラーハンドリング・プログレス追跡の検証
 */

import { spawn, ChildProcessByStdio } from 'child_process';
import { Readable, Writable } from 'stream';
import { executeCommand } from '../../src/utils/commandExecutor.js';
import { Logger } from '../../src/utils/logger.js';

// child_process.spawnをモック
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Loggerをモック
jest.mock('../../src/utils/logger.js', () => ({
  Logger: {
    commandExecution: jest.fn(),
    commandComplete: jest.fn(),
    error: jest.fn()
  }
}));

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;
const mockLogger = Logger as jest.Mocked<typeof Logger>;

// モック用のストリームヘルパー
function createMockReadableStream(): Readable {
  return new Readable({
    read() {}
  });
}

function createMockWritableStream(): Writable {
  return new Writable({
    write(chunk, encoding, callback) {
      callback();
    }
  });
}

// モック用のChildProcessインスタンスを作成
function createMockChildProcess(options: {
  stdout?: Readable;
  stderr?: Readable;
  stdin?: Writable | null;
  exitCode?: number | null;
  exitDelay?: number;
  errorOnSpawn?: Error;
}): ChildProcessByStdio<any, any, any> {
  const stdout = options.stdout || createMockReadableStream();
  const stderr = options.stderr || createMockReadableStream();
  const stdin = options.stdin;
  
  const mockProcess = {
    stdout,
    stderr,
    stdin,
    on: jest.fn(),
    kill: jest.fn()
  } as any;

  // onメソッドのイベントハンドリング
  mockProcess.on.mockImplementation((event: string, callback: Function) => {
    if (event === 'error' && options.errorOnSpawn) {
      setTimeout(() => callback(options.errorOnSpawn), 0);
    } else if (event === 'close') {
      setTimeout(() => callback(options.exitCode ?? 0), options.exitDelay || 0);
    }
    return mockProcess;
  });

  return mockProcess;
}

describe('commandExecutor', () => {
  let originalPlatform: NodeJS.Platform;

  beforeEach(() => {
    // プラットフォーム情報を保存
    originalPlatform = process.platform;
    
    // モックをリセット
    mockSpawn.mockReset();
    jest.clearAllMocks();
    
    // タイマーのモック
    jest.useFakeTimers();
  });

  afterEach(() => {
    // プラットフォームを復元
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
    
    jest.useRealTimers();
  });

  describe('基本的なコマンド実行', () => {
    test('正常終了の処理', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('echo', ['hello']);

      // 標準出力にデータを送信
      stdout.emit('data', Buffer.from('hello world'));
      stdout.emit('end');

      // プロセス終了をシミュレート
      jest.advanceTimersByTime(0);

      const result = await promise;
      expect(result).toBe('hello world');
      expect(mockLogger.commandExecution).toHaveBeenCalled();
      expect(mockLogger.commandComplete).toHaveBeenCalledWith(expect.any(Number), 0, 11);
    });

    test('空の出力の処理', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('echo', []);

      // 空の出力
      stdout.emit('end');
      jest.advanceTimersByTime(0);

      const result = await promise;
      expect(result).toBe('');
    });

    test('複数データチャンクの結合', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('cat', ['file.txt']);

      // 複数のデータチャンクを送信
      stdout.emit('data', Buffer.from('chunk1'));
      stdout.emit('data', Buffer.from('chunk2'));
      stdout.emit('data', Buffer.from('chunk3'));
      stdout.emit('end');

      jest.advanceTimersByTime(0);

      const result = await promise;
      expect(result).toBe('chunk1chunk2chunk3');
    });

    test('UTF-8文字の正しい処理', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('echo', ['こんにちは世界']);

      stdout.emit('data', Buffer.from('こんにちは世界 🌍'));
      stdout.emit('end');

      jest.advanceTimersByTime(0);

      const result = await promise;
      expect(result).toBe('こんにちは世界 🌍');
    });
  });

  describe('エラーハンドリング', () => {
    test('非ゼロ終了コードの処理', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 1
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('false', []);

      stderr.emit('data', Buffer.from('Command failed'));
      stderr.emit('end');
      jest.advanceTimersByTime(0);

      await expect(promise).rejects.toThrow('Command failed with exit code 1: Command failed');
      expect(mockLogger.commandComplete).toHaveBeenCalledWith(expect.any(Number), 1);
    });

    test('標準エラー出力なしの場合のエラー', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 2
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('exit', ['2']);

      stderr.emit('end');
      jest.advanceTimersByTime(0);

      await expect(promise).rejects.toThrow('Command failed with exit code 2: Unknown error');
    });

    test('プロセス生成エラー', async () => {
      const spawnError = new Error('ENOENT: no such file or directory');
      const mockProcess = createMockChildProcess({
        errorOnSpawn: spawnError
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('nonexistent', []);

      jest.advanceTimersByTime(0);

      await expect(promise).rejects.toThrow('Failed to spawn command: ENOENT: no such file or directory');
      expect(mockLogger.error).toHaveBeenCalledWith('Process error:', spawnError);
    });

    test('RESOURCE_EXHAUSTEDエラーの検出', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 1
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('gemini', ['-p', 'test']);

      const quotaError = 'Error: RESOURCE_EXHAUSTED: Quota exceeded for quota metric \'aiplatform.googleapis.com/predict_requests\' {"reason":"rateLimitExceeded","status":429}';
      stderr.emit('data', Buffer.from(quotaError));
      stderr.emit('end');
      jest.advanceTimersByTime(0);

      await expect(promise).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenNthCalledWith(1,
        expect.stringContaining('Gemini Quota Error:')
      );
    });
  });

  describe('プログレス追跡', () => {
    test('onProgressコールバックの呼び出し', async () => {
      const onProgress = jest.fn();
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('echo', ['progress test'], onProgress);

      // データを段階的に送信
      stdout.emit('data', Buffer.from('progress '));
      expect(onProgress).toHaveBeenCalledWith('progress ');

      stdout.emit('data', Buffer.from('test'));
      expect(onProgress).toHaveBeenCalledWith('test');

      stdout.emit('end');
      jest.advanceTimersByTime(0);

      await promise;
      expect(onProgress).toHaveBeenCalledTimes(2);
    });

    test('重複データでのプログレス追跡', async () => {
      const onProgress = jest.fn();
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('long-output', [], onProgress);

      // 累積的にデータが増加する
      stdout.emit('data', Buffer.from('line1\n'));
      expect(onProgress).toHaveBeenLastCalledWith('line1\n');

      stdout.emit('data', Buffer.from('line2\n'));
      expect(onProgress).toHaveBeenLastCalledWith('line2\n');

      stdout.emit('data', Buffer.from('line3\n'));
      expect(onProgress).toHaveBeenLastCalledWith('line3\n');

      stdout.emit('end');
      jest.advanceTimersByTime(0);

      const result = await promise;
      expect(result).toBe('line1\nline2\nline3');
      expect(onProgress).toHaveBeenCalledTimes(3);
    });

    test('プログレスコールバックなしの実行', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('echo', ['no callback']);

      stdout.emit('data', Buffer.from('no callback'));
      stdout.emit('end');
      jest.advanceTimersByTime(0);

      const result = await promise;
      expect(result).toBe('no callback');
      // エラーが投げられないことを確認
    });
  });

  describe('stdin処理', () => {
    test('stdinDataありの場合のプロセス生成', async () => {
      const stdin = createMockWritableStream();
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdin,
        stdout,
        stderr,
        exitCode: 0
      });

      const writeSpy = jest.spyOn(stdin, 'write').mockImplementation((chunk, callback?: any) => {
        if (typeof callback === 'function') callback();
        return true;
      });
      const endSpy = jest.spyOn(stdin, 'end').mockImplementation((callback?: any) => {
        if (typeof callback === 'function') callback();
        return stdin;
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('grep', ['pattern'], undefined, 'input data');

      // spawnの呼び出し確認
      expect(mockSpawn).toHaveBeenCalledWith('grep', ['pattern'], {
        env: process.env,
        shell: false,
        windowsHide: false,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // stdinへの書き込み確認
      expect(writeSpy).toHaveBeenCalledWith('input data');
      expect(endSpy).toHaveBeenCalled();

      stdout.emit('data', Buffer.from('matched line'));
      stdout.emit('end');
      jest.advanceTimersByTime(0);

      const result = await promise;
      expect(result).toBe('matched line');
    });

    test('stdinDataなしの場合のプロセス生成', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('ls', []);

      expect(mockSpawn).toHaveBeenCalledWith('ls', [], {
        env: process.env,
        shell: false,
        windowsHide: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      stdout.emit('data', Buffer.from('file1\nfile2\n'));
      stdout.emit('end');
      jest.advanceTimersByTime(0);

      await promise;
    });

    test('stdinがnullの場合の処理', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdin: null,
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      // stdinDataがあってもstdinがnullなら書き込めない
      const promise = executeCommand('command', [], undefined, 'data');

      stdout.emit('end');
      jest.advanceTimersByTime(0);

      // エラーにはならない（stdinの存在確認をしているため）
      await expect(promise).resolves.toBe('');
    });
  });

  describe('プラットフォーム対応', () => {
    test('Windows環境でのshell有効化', async () => {
      // Windowsプラットフォームに変更
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
        configurable: true
      });

      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('dir', []);

      expect(mockSpawn).toHaveBeenCalledWith('dir', [], {
        env: process.env,
        shell: true,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      stdout.emit('end');
      jest.advanceTimersByTime(0);

      await promise;
    });

    test('Linux環境でのshell無効化', async () => {
      // Linuxプラットフォーム（デフォルト）
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
        configurable: true
      });

      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('ls', []);

      expect(mockSpawn).toHaveBeenCalledWith('ls', [], {
        env: process.env,
        shell: false,
        windowsHide: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      stdout.emit('end');
      jest.advanceTimersByTime(0);

      await promise;
    });

    test('macOS環境でのshell無効化', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'darwin',
        writable: true,
        configurable: true
      });

      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('ps', []);

      expect(mockSpawn).toHaveBeenCalledWith('ps', [], {
        env: process.env,
        shell: false,
        windowsHide: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      stdout.emit('end');
      jest.advanceTimersByTime(0);

      await promise;
    });
  });

  describe('二重解決防止', () => {
    test('エラーと正常終了の競合状態', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr
      });

      // onメソッドを手動で制御
      const eventHandlers: Record<string, Function[]> = {};
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (!eventHandlers[event]) eventHandlers[event] = [];
        eventHandlers[event].push(callback);
        return mockProcess;
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('flaky-command', []);

      // エラーと正常終了を同時に発生させる
      setTimeout(() => {
        eventHandlers['error']?.forEach(cb => cb(new Error('Process error')));
        eventHandlers['close']?.forEach(cb => cb(0));
      }, 0);

      jest.advanceTimersByTime(0);

      // エラーが優先される（isResolvedフラグにより二重解決を防ぐ）
      await expect(promise).rejects.toThrow('Failed to spawn command: Process error');
    });

    test('複数のcloseイベントの処理', async () => {
      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr
      });

      const eventHandlers: Record<string, Function[]> = {};
      mockProcess.on.mockImplementation((event: string, callback: Function) => {
        if (!eventHandlers[event]) eventHandlers[event] = [];
        eventHandlers[event].push(callback);
        return mockProcess;
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('multi-close', []);

      stdout.emit('data', Buffer.from('output'));
      stdout.emit('end');

      // 複数回closeイベントを発生
      setTimeout(() => {
        eventHandlers['close']?.forEach(cb => cb(0));
        eventHandlers['close']?.forEach(cb => cb(0)); // 2回目は無視される
      }, 0);

      jest.advanceTimersByTime(0);

      const result = await promise;
      expect(result).toBe('output');
    });
  });

  describe('環境変数の処理', () => {
    test('process.envの伝播', async () => {
      const originalEnv = process.env;
      process.env = { ...originalEnv, TEST_VAR: 'test_value' };

      const stdout = createMockReadableStream();
      const stderr = createMockReadableStream();
      const mockProcess = createMockChildProcess({
        stdout,
        stderr,
        exitCode: 0
      });

      mockSpawn.mockReturnValue(mockProcess as any);

      const promise = executeCommand('env', []);

      expect(mockSpawn).toHaveBeenCalledWith('env', [], expect.objectContaining({
        env: expect.objectContaining({
          TEST_VAR: 'test_value'
        })
      }));

      stdout.emit('end');
      jest.advanceTimersByTime(0);

      await promise;

      process.env = originalEnv;
    });
  });
});