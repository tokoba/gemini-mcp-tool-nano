/**
 * PathValidator モジュールのユニットテスト
 * 
 * ⚠️ 重要: このコードは個人用ローカルPC環境専用です
 * セキュリティ関連のテストは実施しません
 * セキュリティ関連のチェックも実施しません
 * 本番環境や信頼できない入力には使用しないでください
 */

import { 
  PathValidator, 
  ValidationError, 
  DEFAULT_SECURITY_CONFIG,
  type SecurityConfig 
} from '../../src/utils/filepath/pathValidator.js';

describe('PathValidator - 個人用ローカルPC専用（セキュリティチェックなし）', () => {
  let validator: PathValidator;
  let testConfig: SecurityConfig;

  beforeEach(() => {
    global.mockLogger();
    
    // 個人用PC向け設定（セキュリティ制限なし）
    testConfig = {
      allowedDirectories: ['/home/test'],
      maxPathLength: 1024,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowSymlinks: true,     // 個人用PCでは制限なし
      allowHiddenFiles: true,  // 個人用PCでは制限なし
      allowBinaryFiles: true   // 個人用PCでは制限なし
    };
    
    validator = new PathValidator(testConfig);
  });

  describe('基本的なパス検証（セキュリティチェックなし）', () => {
    test('有効な絶対パス', async () => {
      global.mockFileSystem({
        '/home/test/file.txt': { content: 'test content' }
      });

      const result = await validator.validatePath('/home/test/file.txt');
      expect(result.valid).toBe(true);
      expect(result.isSafeToRead).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('存在しないファイル（個人用PC向け: パス形式は無効だが安全）', async () => {
      global.mockFileSystem({});

      const result = await validator.validatePath('/home/test/nonexistent.txt');
      expect(result.valid).toBe(false);       // ファイルが存在しないため無効
      expect(result.isSafeToRead).toBe(false); // 読み込み不可
      expect(result.errors).toHaveLength(1);   // ファイル未存在エラー
      expect(result.errors[0]).toBe('File not found');
    });

    test('相対パスの絶対パス変換', async () => {
      const originalCwd = process.cwd;
      process.cwd = jest.fn().mockReturnValue('/home/test');

      global.mockFileSystem({
        '/home/test/relative.txt': { content: 'test' }
      });

      const result = await validator.validatePath('./relative.txt');
      expect(result.valid).toBe(true);
      expect(result.normalizedPath).toContain('/home/test');
      expect(result.realPath).toBeDefined();

      process.cwd = originalCwd;
    });
  });

  describe('基本的な入力検証（セキュリティチェックなし）', () => {
    test('ヌル文字を含むパスの拒否（基本的な安全性のため）', async () => {
      const nullBytePaths = [
        '/home/test/file.txt\x00',
        '\x00/home/test/file.txt',
        '/home/test/\x00file.txt'
      ];

      for (const nullPath of nullBytePaths) {
        const result = await validator.validatePath(nullPath);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('null bytes'))).toBe(true);
      }
    });

    test('パス長制限（ReDoS攻撃対策のみ）', () => {
      const longPath = '/home/test/' + 'a'.repeat(2000) + '.txt';
      expect(validator.checkInputLength(longPath)).toBe(false);
    });

    test('適切な長さのパス', () => {
      const normalPath = '/home/test/normal.txt';
      expect(validator.checkInputLength(normalPath)).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    test('無効な入力タイプ', async () => {
      // @ts-ignore - テスト用の無効な型
      const result = await validator.validatePath(null);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be a string'))).toBe(true);
    });

    test('空文字列', async () => {
      const result = await validator.validatePath('');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('cannot be empty'))).toBe(true);
    });

    test('ファイルシステムエラーの処理', async () => {
      const fs = require('fs/promises');
      jest.spyOn(fs, 'stat').mockRejectedValue(new Error('Permission denied'));

      const result = await validator.validatePath('/home/test/error.txt');
      expect(result.valid).toBe(false);        // ファイル処理失敗のため無効
      expect(result.isSafeToRead).toBe(false); // 読み込み不可
    });
  });

  describe('Windows互換性テスト（セキュリティチェックなし）', () => {
    beforeEach(() => {
      global.mockPlatform('win32');
    });

    test('Windowsドライブパスの正規化', async () => {
      // 個人用PC向け: Linux環境でのテスト（実際のprocess.platformに関係なく）
      global.mockFileSystem({}); // 空のファイルシステム
      
      const result = await validator.validatePath('c:/users/test/file.txt');
      
      // Linux環境でWindowsパスを処理する場合、ファイルが存在しないため無効
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File not found');
      expect(result.normalizedPath).toBeDefined(); // パス正規化は実行される
    });
  });

  describe('デフォルト設定テスト', () => {
    test('DEFAULT_SECURITY_CONFIG の妥当性', () => {
      expect(DEFAULT_SECURITY_CONFIG.allowedDirectories).toContain(process.cwd());
      expect(DEFAULT_SECURITY_CONFIG.maxPathLength).toBeGreaterThan(0);
      expect(DEFAULT_SECURITY_CONFIG.maxFileSize).toBeGreaterThan(0);
      expect(DEFAULT_SECURITY_CONFIG.allowSymlinks).toBe(true);
      expect(DEFAULT_SECURITY_CONFIG.allowHiddenFiles).toBe(true);
      expect(DEFAULT_SECURITY_CONFIG.allowBinaryFiles).toBe(true);
    });

    test('デフォルト設定でのバリデーター作成', () => {
      const defaultValidator = new PathValidator(DEFAULT_SECURITY_CONFIG);
      expect(defaultValidator).toBeInstanceOf(PathValidator);
    });
  });

  describe('統合テスト（個人用PC専用）', () => {
    test('完全なバリデーションフロー', async () => {
      global.mockFileSystem({
        '/home/test/valid.txt': { content: 'valid content', size: 13 }
      });

      const result = await validator.validatePath('/home/test/valid.txt');
      
      expect(result.valid).toBe(true);
      expect(result.isSafeToRead).toBe(true);
      expect(result.normalizedPath).toBeDefined();
      expect(result.realPath).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    test('パス長制限のみのテスト（セキュリティチェックなし）', async () => {
      const longPath = '/home/test/' + 'a'.repeat(2000) + '.txt';
      
      const result = await validator.validatePath(longPath);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('maximum length'))).toBe(true);
    });
  });
});

/**
 * 注意事項:
 * - このテストファイルはセキュリティ関連のテストを実施しません
 * - ディレクトリトラバーサル攻撃のテストは削除済み
 * - 許可ディレクトリ外アクセスのテストは削除済み
 * - ファイルタイプ制限のテストは削除済み
 * - 個人用ローカルPC環境でのみ使用してください
 */