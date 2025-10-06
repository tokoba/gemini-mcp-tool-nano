/**
 * Jest テストセットアップファイル
 * 
 * 全テストで共通する設定とモックを定義
 */

// パフォーマンステスト用の時間測定
(global as any).performance = require('perf_hooks').performance;

// プラットフォーム情報のモック保存
const originalPlatform = process.platform;
const originalEnv = { ...process.env };

// プラットフォームモック用のヘルパー
(global as any).mockPlatform = (platform: NodeJS.Platform, envVars: Record<string, string> = {}) => {
  Object.defineProperty(process, 'platform', {
    value: platform,
    writable: true,
    configurable: true
  });
  
  // 環境変数の設定
  Object.assign(process.env, envVars);
};

// プラットフォーム情報のリセット
(global as any).resetPlatform = () => {
  Object.defineProperty(process, 'platform', {
    value: originalPlatform,
    writable: true,
    configurable: true
  });
  
  // 環境変数のリセット
  process.env = { ...originalEnv };
};

// テスト後のクリーンアップ
afterEach(() => {
  (global as any).resetPlatform();
  jest.clearAllMocks();
});

// ファイルシステムモック用のヘルパー
(global as any).mockFileSystem = (files: Record<string, { content?: string; isDirectory?: boolean; size?: number; stats?: any }>) => {
  const fs = require('fs');
  const fsPromises = require('fs/promises');
  
  const fileMap = new Map(Object.entries(files));
  
  // fs.existsSync モック
  jest.spyOn(fs, 'existsSync').mockImplementation((...args: any[]) => {
    const path = args[0] as string;
    return fileMap.has(path);
  });
  
  // fs.promises.access モック
  jest.spyOn(fsPromises, 'access').mockImplementation(async (...args: any[]) => {
    const path = args[0] as string;
    if (!fileMap.has(path)) {
      throw new Error(`ENOENT: no such file or directory, access '${path}'`);
    }
  });
  
  // fs.promises.stat モック
  jest.spyOn(fsPromises, 'stat').mockImplementation(async (...args: any[]) => {
    const path = args[0] as string;
    const file = fileMap.get(path);
    if (!file) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    
    return {
      isFile: () => !file.isDirectory,
      isDirectory: () => !!file.isDirectory,
      isSymbolicLink: () => false,
      isCharacterDevice: () => false,
      isBlockDevice: () => false,
      size: file.size || (file.content?.length || 0),
      ...file.stats
    };
  });
  
  // fs.promises.readFile モック
  jest.spyOn(fsPromises, 'readFile').mockImplementation(async (...args: any[]) => {
    const path = args[0] as string;
    const file = fileMap.get(path);
    if (!file || file.isDirectory) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    
    return file.content || '';
  });
  
  // fs.promises.realpath モック
  jest.spyOn(fsPromises, 'realpath').mockImplementation(async (...args: any[]) => {
    const path = args[0] as string;
    if (!fileMap.has(path)) {
      throw new Error(`ENOENT: no such file or directory, realpath '${path}'`);
    }
    return path; // シンプルに同じパスを返す
  });
};

// コンソール出力のモック（テスト中の大量ログを抑制）
(global as any).silenceConsole = () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
};

// Logger モックのヘルパー
(global as any).mockLogger = () => {
  try {
    const Logger = require('../src/utils/logger.js');
    jest.spyOn(Logger.Logger, 'debug').mockImplementation(() => {});
    jest.spyOn(Logger.Logger, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.Logger, 'error').mockImplementation(() => {});
  } catch (error) {
    // Logger が見つからない場合は無視
  }
};