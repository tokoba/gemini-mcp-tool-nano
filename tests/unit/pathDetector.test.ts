/**
 * PathDetector モジュールのユニットテスト
 * 
 * ⚠️ 重要: このコードは個人用ローカルPC環境専用です
 * セキュリティ関連のテストは実施しません
 * セキュリティ関連のチェックも実施しません
 * 個人用ローカルPCでの基本的なパス検出機能のみテスト
 */

import { 
  PathDetector,
  createDefaultPathDetector,
  createLightweightPathDetector,
  EXPLICIT_PATTERNS,
  GENERAL_PATH_PATTERNS,
  FILENAME_PATTERNS,
  type PathDetectionConfig 
} from '../../src/utils/filepath/pathDetector.js';

describe('PathDetector - 個人用ローカルPC専用（セキュリティチェックなし）', () => {
  let detector: PathDetector;

  beforeEach(() => {
    global.mockLogger();
    detector = createDefaultPathDetector();
  });

  describe('明示的パターン検出 (EXPLICIT_PATTERNS)', () => {
    test('@ マーカー付きファイルパス', () => {
      const testContent = 'Check this file @/home/user/test.txt and also @C:\\Users\\test\\file.doc';
      const results = detector.detectFilePaths(testContent);
      
      const explicitResults = results.filter(r => r.type === 'explicit');
      expect(explicitResults).toHaveLength(2);
      expect(explicitResults[0].filepath).toBe('/home/user/test.txt');
      expect(explicitResults[1].filepath).toBe('C:\\Users\\test\\file.doc');
      expect(explicitResults[0].priority).toBe(1);
    });

    test('filepath: マーカー付きパス', () => {
      const testContent = 'See filepath:/var/log/app.log for details';
      const results = detector.detectFilePaths(testContent);
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('explicit');
      expect(results[0].filepath).toBe('/var/log/app.log');
    });

    test('Windows UNCパス with @', () => {
      const testContent = 'Network file @\\\\server\\share\\folder\\file.txt';
      const results = detector.detectFilePaths(testContent);
      
      expect(results).toHaveLength(1);
      expect(results[0].filepath).toBe('\\\\server\\share\\folder\\file.txt');
      expect(results[0].platform).toBe('windows');
    });

    test('Cygwin パス with @', () => {
      const testContent = 'Cygwin path @/cygdrive/c/Users/test/file.txt';
      const results = detector.detectFilePaths(testContent);
      
      expect(results).toHaveLength(1);
      expect(results[0].filepath).toBe('/cygdrive/c/Users/test/file.txt');
      expect(results[0].platform).toBe('cygwin');
    });

    test('相対パス with @', () => {
      const testContent = 'Check @./relative/file.txt and @../parent/file.txt';
      const results = detector.detectFilePaths(testContent);
      
      expect(results).toHaveLength(2);
      expect(results[0].filepath).toBe('./relative/file.txt');
      expect(results[1].filepath).toBe('../parent/file.txt');
    });
  });

  describe('一般パターン検出 (GENERAL_PATH_PATTERNS)', () => {
    test('@ マーカーなしのパス検出', () => {
      const testContent = 'Files: /home/user/test.txt C:\\Users\\test\\file.doc';
      const results = detector.detectFilePaths(testContent);
      
      const generalResults = results.filter(r => r.type === 'general');
      expect(generalResults.length).toBeGreaterThan(0);
      expect(generalResults[0].priority).toBe(2);
    });

    test('単語境界での正確な検出', () => {
      const testContent = 'prefix/home/user/filesuffix vs /home/user/file.txt standalone';
      const results = detector.detectFilePaths(testContent);
      
      // 単語境界がある /home/user/file.txt のみが検出される
      const validPaths = results.filter(r => r.filepath === '/home/user/file.txt');
      expect(validPaths).toHaveLength(1);
    });
  });

  describe('ファイル名パターン検出 (FILENAME_PATTERNS)', () => {
    test('拡張子付きファイル名', () => {
      const testContent = 'Files: config.json setup.exe readme.md';
      const results = detector.detectFilePaths(testContent);
      
      const filenames = results.filter(r => r.type === 'filename');
      expect(filenames.length).toBeGreaterThan(0);
      expect(filenames[0].priority).toBe(3);
    });

    test('無効な拡張子の除外', () => {
      const testContent = 'Invalid: .txt .log .exe';
      const results = detector.detectFilePaths(testContent);
      
      // 拡張子のみは除外される
      expect(results).toHaveLength(0);
    });
  });

  describe('Unicode/国際化対応', () => {
    test('日本語ファイル名の検出', () => {
      const testContent = '@/home/ユーザー/ドキュメント.txt と @/home/user/ファイル.doc';
      const results = detector.detectFilePaths(testContent);
      
      expect(results).toHaveLength(2);
      expect(results[0].filepath).toBe('/home/ユーザー/ドキュメント.txt');
      expect(results[1].filepath).toBe('/home/user/ファイル.doc');
    });

    test('中国語ファイル名の検出', () => {
      const testContent = '@/home/用户/文档.txt';
      const results = detector.detectFilePaths(testContent);
      
      expect(results).toHaveLength(1);
      expect(results[0].filepath).toBe('/home/用户/文档.txt');
    });

    test('混合言語パスの検出', () => {
      const testContent = '@C:\\Users\\テスト\\projects\\项目\\file.txt';
      const results = detector.detectFilePaths(testContent);
      
      expect(results).toHaveLength(1);
      expect(results[0].filepath).toBe('C:\\Users\\テスト\\projects\\项目\\file.txt');
    });
  });

  describe('基本的なパス検出（個人用PC向け - 除外機能なし）', () => {
    test('全ての@マーカーを検出（除外なし）', () => {
      const testContent = 'Contact user@example.com or check @/home/user/file.txt';
      const results = detector.detectFilePaths(testContent);
      
      // 個人用PC向け: メールアドレスもファイルパスも全て検出
      expect(results.length).toBeGreaterThanOrEqual(2);
      
      // 明示的な@マーカー付きファイルパスは必ず検出
      const fileResult = results.find(r => r.filepath === '/home/user/file.txt');
      expect(fileResult).toBeDefined();
    });

    test('明示的マーカー付きファイル名の検出（個人用PC向け）', () => {
      const testContent = 'Time 12:34 and 12:34:56 but @test-file.log is a file';
      const results = detector.detectFilePaths(testContent);
      
      // 個人用PC向け: 明示的@マーカー付きファイルは確実に検出
      expect(results.length).toBeGreaterThanOrEqual(1);
      
      // 明示的な@マーカー付きは必ず検出
      const logResult = results.find(r => r.filepath === 'test-file.log');
      expect(logResult).toBeDefined();
    });

    test('一般的な単語もファイル名として検出（個人用PC向け）', () => {
      const testContent = 'Files: fox.txt lazy.doc and @real.txt are all valid';
      const results = detector.detectFilePaths(testContent);
      
      // 個人用PC向け: 全ての拡張子付きファイル名を検出
      expect(results.length).toBeGreaterThanOrEqual(1);
      
      // 明示的な@マーカー付きは必ず検出
      const realResult = results.find(r => r.filepath === 'real.txt');
      expect(realResult).toBeDefined();
    });

    test('Windows予約名も検出（個人用PC向け）', () => {
      const testContent = 'Files: CON.txt PRN.doc AUX.log and @valid.txt';
      const results = detector.detectFilePaths(testContent);
      
      // 個人用PC向け: Windows予約名も検出（制限なし）
      expect(results.length).toBeGreaterThanOrEqual(1);
      
      // 明示的な@マーカー付きは必ず検出
      const validResult = results.find(r => r.filepath === 'valid.txt');
      expect(validResult).toBeDefined();
    });
  });

  describe('プラットフォーム判定', () => {
    test('Windowsパスの判定', () => {
      const testContent = '@C:\\Users\\test\\file.txt @D:/Projects/code.js';
      const results = detector.detectFilePaths(testContent);
      
      results.forEach(result => {
        expect(result.platform).toBe('windows');
      });
    });

    test('WSLパスの判定', () => {
      const testContent = '@/mnt/c/Users/test/file.txt';
      const results = detector.detectFilePaths(testContent);
      
      expect(results[0].platform).toBe('wsl');
    });

    test('Cygwinパスの判定', () => {
      const testContent = '@/cygdrive/c/Users/test/file.txt';
      const results = detector.detectFilePaths(testContent);
      
      expect(results[0].platform).toBe('cygwin');
    });

    test('Unixパスの判定', () => {
      const testContent = '@/home/user/file.txt @/var/log/app.log';
      const results = detector.detectFilePaths(testContent);
      
      results.forEach(result => {
        expect(result.platform).toBe('unix');
      });
    });
  });

  describe('優先度システム', () => {
    test('優先度順のソート', () => {
      const testContent = 'file.txt /home/user/file.txt @/explicit/file.txt';
      const results = detector.detectFilePaths(testContent);
      
      // 明示的パターンが最優先
      expect(results[0].priority).toBe(1);
      expect(results[0].type).toBe('explicit');
      expect(results[0].filepath).toBe('/explicit/file.txt');
    });

    test('同一優先度内での位置順ソート', () => {
      const testContent = '@/first/file.txt some text @/second/file.txt';
      const results = detector.detectFilePaths(testContent);
      
      const explicitResults = results.filter(r => r.type === 'explicit');
      expect(explicitResults[0].filepath).toBe('/first/file.txt');
      expect(explicitResults[1].filepath).toBe('/second/file.txt');
      expect(explicitResults[0].startIndex).toBeLessThan(explicitResults[1].startIndex);
    });
  });

  describe('重複除去', () => {
    test('同一パス・同一位置の重複除去', () => {
      // 複数のパターンが同じパスにマッチする場合
      const testContent = '@/home/user/file.txt';
      const results = detector.detectFilePaths(testContent);
      
      // 同じファイルパスが複数回検出されないこと
      const uniquePaths = new Set(results.map(r => `${r.filepath}:${r.startIndex}`));
      expect(uniquePaths.size).toBe(results.length);
    });
  });

  describe('軽量モード', () => {
    test('軽量モードでの明示的パターンのみ検出', () => {
      const lightweightDetector = createLightweightPathDetector();
      const testContent = '@/explicit/file.txt /general/file.txt filename.txt';
      const results = lightweightDetector.detectFilePaths(testContent);
      
      // 明示的パターンのみ検出
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('explicit');
      expect(results[0].filepath).toBe('/explicit/file.txt');
    });
  });

  describe('統計情報とデバッグ機能', () => {
    test('詳細検出統計の取得', () => {
      const testContent = '@/explicit/file.txt /general/file.txt filename.txt';
      const debugResult = detector.detectWithDebugInfo(testContent);
      
      expect(debugResult.stats.totalMatches).toBeGreaterThan(0);
      expect(debugResult.stats.byType).toBeDefined();
      expect(debugResult.stats.byPlatform).toBeDefined();
      
      // 統計の一貫性チェック
      const typeSum = Object.values(debugResult.stats.byType).reduce((a: number, b: number) => a + b, 0);
      expect(typeSum).toBe(debugResult.stats.totalMatches);
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量テキストの高速処理', () => {
      const largeText = 'Check @/file.txt '.repeat(1000);
      
      const startTime = performance.now();
      const results = detector.detectFilePaths(largeText);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
      expect(results).toHaveLength(1000);
    });

    test('ReDoS攻撃パターンの安全性', () => {
      const maliciousPattern = '@' + 'a'.repeat(10000) + '/file.txt';
      
      const startTime = performance.now();
      const results = detector.detectFilePaths(maliciousPattern);
      const endTime = performance.now();
      
      // 処理時間が合理的な範囲内
      expect(endTime - startTime).toBeLessThan(100); // 100ms以内
    });
  });

  describe('設定可能な検出オプション（個人用PC向け）', () => {
    test('Unicode サポートは常に有効（個人用PC向け）', () => {
      // 個人用PC向け: Unicode は常にサポート
      const testContent = '@/home/ユーザー/file.txt';
      const results = detector.detectFilePaths(testContent);
      
      // Unicode ファイル名も正常に検出
      expect(results.length).toBeGreaterThanOrEqual(1);
      const unicodeResult = results.find(r => r.filepath === '/home/ユーザー/file.txt');
      expect(unicodeResult).toBeDefined();
    });

    test('全プラットフォーム対応（個人用PC向け）', () => {
      const testContent = '@C:\\Windows\\file.txt @/home/user/file.txt';
      const results = detector.detectFilePaths(testContent);
      
      // 個人用PC向け: 全プラットフォームのパスを検出
      expect(results.length).toBeGreaterThanOrEqual(2);
      
      const windowsResult = results.find(r => r.platform === 'windows');
      const unixResult = results.find(r => r.platform === 'unix');
      expect(windowsResult).toBeDefined();
      expect(unixResult).toBeDefined();
    });
  });

  describe('エラーハンドリング', () => {
    test('無効な入力タイプ', () => {
      // @ts-ignore - テスト用の無効な型
      const results = detector.detectFilePaths(null);
      expect(results).toHaveLength(0);
    });

    test('空文字列', () => {
      const results = detector.detectFilePaths('');
      expect(results).toHaveLength(0);
    });

    test('非常に長い文字列', () => {
      const longString = 'x'.repeat(100000);
      expect(() => detector.detectFilePaths(longString)).not.toThrow();
    });
  });
});