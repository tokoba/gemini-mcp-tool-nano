/**
 * promptPreprocessor 統合テスト
 * 智的@記号処理の統合テスト
 */

import { 
  preprocessAtSymbols,
  debugAtSymbolProcessing,
  setLightweightMode,
  updatePreprocessorConfig,
  getPreprocessorConfig
} from '../../src/utils/promptPreprocessor.js';
import { DEFAULT_SECURITY_CONFIG } from '../../src/utils/filepath/pathValidator.js';

describe('promptPreprocessor 統合テスト', () => {
  beforeEach(() => {
    global.mockLogger();
    
    // テスト用のセキュリティ設定
    updatePreprocessorConfig({
      filepathConfig: {
        security: {
          ...DEFAULT_SECURITY_CONFIG,
          allowedDirectories: ['/home/test', '/var/log']
        }
      }
    });
  });

  describe('智的@記号処理', () => {
    test('基本的な@記号処理', async () => {
      global.mockFileSystem({
        '/home/test/existing.txt': { content: 'exists' }
      });

      const prompt = 'Check @/home/test/existing.txt and @/home/test/missing.txt';
      const result = await preprocessAtSymbols(prompt);
      
      // 存在するファイルは保持、存在しないファイルはスペース挿入
      expect(result).toBe('Check @/home/test/existing.txt and @ /home/test/missing.txt');
    });

    test('智的@記号処理', async () => {
      global.mockFileSystem({
        '/home/test/valid.txt': { content: 'valid content' }
      });

      const prompt = 'Check @/home/test/valid.txt and contact user@example.com';
      const result = await preprocessAtSymbols(prompt);
      
      // 有効なファイルは保持、メールアドレスはスペース追加
      expect(result).toBe('Check @/home/test/valid.txt and contact user@ example.com');
    });

    test('Unicode ファイル名の処理', async () => {
      global.mockFileSystem({
        '/home/test/日本語.txt': { content: 'Japanese content' }
      });

      const prompt = '@/home/test/日本語.txt をチェック';
      const result = await preprocessAtSymbols(prompt);
      
      // 存在するファイルは保持される
      expect(result).toBe('@/home/test/日本語.txt をチェック');
    });

    test('クロスプラットフォーム対応', async () => {
      global.mockPlatform('win32');
      global.mockFileSystem({
        'C:\\Users\\test\\file.txt': { content: 'windows file' }
      });

      updatePreprocessorConfig({
        filepathConfig: {
          security: {
            ...DEFAULT_SECURITY_CONFIG,
            allowedDirectories: ['C:\\Users\\test']
          }
        }
      });

      const prompt = '@C:\\Users\\test\\file.txt';
      const result = await preprocessAtSymbols(prompt);
      
      // 存在するファイルは保持される
      expect(result).toBe('@C:\\Users\\test\\file.txt');
    });

    test('セキュリティ検証の統合', async () => {
      const prompt = '@../../../etc/passwd';
      const result = await preprocessAtSymbols(prompt);
      
      // セキュリティ違反によりスペース挿入
      expect(result).toBe('@ ../../../etc/passwd');
    });

    test('ディレクトリトラバーサル攻撃の防御', async () => {
      const attacks = [
        '@/home/test/../../../etc/passwd',
        '@..\\..\\..\\windows\\system32',
        '@/home/test/../../outside/file.txt'
      ];

      for (const attack of attacks) {
        const result = await preprocessAtSymbols(attack);
        // 無効なパスにはスペースが追加される
        expect(result).not.toBe(attack); // 何らかの変更が行われる
      }
    });
  });

  describe('設定管理', () => {
    test('設定の更新と取得', () => {
      const newConfig = {
        lightweightMode: true
      };

      updatePreprocessorConfig(newConfig);
      const currentConfig = getPreprocessorConfig();

      expect(currentConfig.lightweightMode).toBe(true);
    });

    test('便利関数の動作', () => {
      setLightweightMode(true);
      let config = getPreprocessorConfig();
      expect(config.lightweightMode).toBe(true);

      setLightweightMode(false);
      config = getPreprocessorConfig();
      expect(config.lightweightMode).toBe(false);
    });
  });

  describe('デバッグ機能', () => {
    test('@記号処理のデバッグ', async () => {
      global.mockFileSystem({
        '/home/test/exists.txt': { content: 'content' }
      });

      updatePreprocessorConfig({
        filepathConfig: {
          security: {
            ...DEFAULT_SECURITY_CONFIG,
            allowedDirectories: ['/home/test']
          }
        }
      });

      const result = await debugAtSymbolProcessing('Check @/home/test/exists.txt and @missing.txt');
      
      expect(result.statistics).toBeDefined();
      expect(result.changes.length).toBeGreaterThan(0);
    });
  });

  describe('エラーハンドリングと回復', () => {
    test('無効な設定でのエラー処理', async () => {
      // 無効な設定を意図的に設定
      const invalidConfig = {
        filepathConfig: {
          security: {
            ...DEFAULT_SECURITY_CONFIG,
            allowedDirectories: null as any
          }
        }
      };
      
      // 無効な設定でもエラーできれいに処理されることを確認
      expect(() => {
        updatePreprocessorConfig(invalidConfig);
      }).not.toThrow();
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量テキストの処理性能', async () => {
      const largePrompt = 'Check @file.txt '.repeat(1000);
      
      const startTime = performance.now();
      const result = await preprocessAtSymbols(largePrompt);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(2000); // 2秒以内
      expect(result).toBeDefined();
    });

    test('標準モードと軽量モードの性能比較', async () => {
      const testPrompt = 'Check @file1.txt and @file2.txt and user@email.com';
      
      // 標準モードのテスト
      setLightweightMode(false);
      const standardStart = performance.now();
      const standardResult = await preprocessAtSymbols(testPrompt);
      const standardEnd = performance.now();
      
      // 軽量モードのテスト
      setLightweightMode(true);
      const lightweightStart = performance.now();
      const lightweightResult = await preprocessAtSymbols(testPrompt);
      const lightweightEnd = performance.now();
      
      // 両方とも合理的な時間内で完了
      expect(standardEnd - standardStart).toBeLessThan(200);
      expect(lightweightEnd - lightweightStart).toBeLessThan(200);
      
      // 結果が定義されている
      expect(standardResult).toBeDefined();
      expect(lightweightResult).toBeDefined();
    });
  });

  describe('実際の使用シナリオ', () => {
    test('マルチプラットフォーム環境での動作', async () => {
      const testCases = [
        {
          platform: 'linux' as NodeJS.Platform,
          paths: ['/home/user/file.txt', '/var/log/app.log'],
          allowedDirs: ['/home/user', '/var/log']
        },
        {
          platform: 'win32' as NodeJS.Platform,
          paths: ['C:\\Users\\test\\file.txt', 'D:\\Projects\\code.js'],
          allowedDirs: ['C:\\Users\\test', 'D:\\Projects']
        }
      ];

      for (const testCase of testCases) {
        global.mockPlatform(testCase.platform);
        
        // ファイルシステムのモック
        const fileSystem: Record<string, any> = {};
        testCase.paths.forEach(path => {
          fileSystem[path] = { content: 'test content' };
        });
        global.mockFileSystem(fileSystem);

        updatePreprocessorConfig({
          filepathConfig: {
            security: {
              ...DEFAULT_SECURITY_CONFIG,
              allowedDirectories: testCase.allowedDirs
            }
          }
        });

        const prompt = testCase.paths.map(p => `@${p}`).join(' and ');
        const result = await preprocessAtSymbols(prompt);
        
        // すべてのパスが保持されることを確認
        testCase.paths.forEach(path => {
          expect(result).toContain(`@${path}`);
        });
      }
    });

    test('開発者の実際の使用パターン', async () => {
      global.mockFileSystem({
        '/project/src/main.ts': { content: 'main code' },
        '/project/docs/README.md': { content: 'documentation' },
        '/project/tests/test.spec.ts': { content: 'tests' }
      });

      updatePreprocessorConfig({
        filepathConfig: {
          security: {
            ...DEFAULT_SECURITY_CONFIG,
            allowedDirectories: ['/project']
          }
        }
      });

      const devPrompt = `
        I need help with these files:
        - Main implementation: @/project/src/main.ts
        - Documentation: @/project/docs/README.md  
        - Test file: @/project/tests/test.spec.ts
        
        Please email me at developer@company.com when done.
        Also check the non-existent @/project/missing.txt file.
      `;

      const result = await preprocessAtSymbols(devPrompt);
      
      // 有効なプロジェクトファイルは保持
      expect(result).toContain('@/project/src/main.ts');
      expect(result).toContain('@/project/docs/README.md');
      expect(result).toContain('@/project/tests/test.spec.ts');
      
      // メールアドレスと無効パスは修正
      expect(result).toContain('developer@ company.com');
      expect(result).toContain('@ /project/missing.txt');
    });
  });

  describe('統合テストカバレッジ向上', () => {
    test('有効・無効・非パスの@記号混在処理', async () => {
      const validPath = '/home/test/existing.txt';
      global.mockFileSystem({
        [validPath]: { content: 'existing file' }
      });

      const prompt = `Please review @${validPath} and also @/nonexistent/file.txt. Email: user@domain.com`;
      const result = await preprocessAtSymbols(prompt);
      
      // 存在するファイルは保持、存在しないファイルとEmailはスペース追加
      expect(result).toContain(`@${validPath}`);
      expect(result).toContain('@ /nonexistent/file.txt');
      expect(result).toContain('user@ domain.com');
    });

    test('多数の@記号を含むプロンプト処理', async () => {
      global.mockFileSystem({
        '/home/test/package.json': { content: '{}' }
      });

      const prompt = 'This prompt mentions @a @b @c @d and @/home/test/package.json';
      const result = await preprocessAtSymbols(prompt);
      
      expect(result).toContain('@ a @ b @ c @ d');
      expect(result).toContain('@/home/test/package.json');
    });

    test('Windows・リナックス混在パス処理', async () => {
      global.mockFileSystem({
        'C:\\Windows\\file.txt': { content: 'windows file' },
        '/usr/local/file.txt': { content: 'linux file' }
      });

      updatePreprocessorConfig({
        filepathConfig: {
          security: {
            ...DEFAULT_SECURITY_CONFIG,
            allowedDirectories: ['C:\\Windows', '/usr/local']
          }
        }
      });

      const prompt = 'Check @C:\\Windows\\file.txt and @/usr/local/file.txt and @/nonexistent';
      const result = await preprocessAtSymbols(prompt);
      
      // 存在するファイルは保持、存在しないファイルはスペース追加
      expect(result).toContain('@C:\\Windows\\file.txt');
      expect(result).toContain('@/usr/local/file.txt');
      expect(result).toContain('@ /nonexistent');
    });

    test('極端に長いプロンプトの処理パフォーマンス', async () => {
      const longPrompt = 'Check '.repeat(1000) + '@/home/test/file.txt ' + 'content '.repeat(1000);
      
      const startTime = performance.now();
      const result = await preprocessAtSymbols(longPrompt);
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
      expect(result).toContain('@ /home/test/file.txt');
    });

    test('標準モードと軽量モードの互換性', async () => {
      global.mockFileSystem({
        '/home/test/config.json': { content: '{"version": 1}' }
      });

      const prompt = 'Load @/home/test/config.json and @/missing.txt';
      
      // 標準モード
      setLightweightMode(false);
      const standardResult = await preprocessAtSymbols(prompt);
      
      // 軽量モード
      setLightweightMode(true);
      const lightweightResult = await preprocessAtSymbols(prompt);
      
      // 両モードとも基本的な動作は同じであることを確認
      expect(standardResult).toContain('@/home/test/config.json');
      expect(lightweightResult).toContain('@/home/test/config.json');
      expect(standardResult).toMatch(/missing\.txt/);
      expect(lightweightResult).toMatch(/missing\.txt/);
    });
  });
});