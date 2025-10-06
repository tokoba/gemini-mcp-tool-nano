/**
 * PathUtils モジュールのユニットテスト
 * クロスプラットフォーム対応のパス正規化をテスト
 */

import { 
  convertToWindowsPath, 
  normalizePath, 
  expandHome, 
  getPlatformInfo,
  checkPathCompatibility 
} from '../../src/utils/filepath/pathUtils.js';

describe('PathUtils', () => {
  beforeEach(() => {
    global.mockLogger();
  });

  describe('convertToWindowsPath', () => {
    test('WSLパス (/mnt/c/) をWindowsパスに変換', () => {
      expect(convertToWindowsPath('/mnt/c/Users/test/file.txt')).toBe('C:\\Users\\test\\file.txt');
      expect(convertToWindowsPath('/mnt/d/Projects/code.js')).toBe('D:\\Projects\\code.js');
    });

    test('Unix-style Windowsパス (/c/) をWindowsパスに変換', () => {
      expect(convertToWindowsPath('/c/Users/test/file.txt')).toBe('C:\\Users\\test\\file.txt');
      expect(convertToWindowsPath('/d/Projects/code.js')).toBe('D:\\Projects\\code.js');
    });

    test('標準的なWindowsパスのスラッシュを変換', () => {
      expect(convertToWindowsPath('C:/Users/test/file.txt')).toBe('C:\\Users\\test\\file.txt');
      expect(convertToWindowsPath('D:/Projects/code.js')).toBe('D:\\Projects\\code.js');
    });

    test('非Windowsパスはそのまま返す', () => {
      expect(convertToWindowsPath('/home/user/file.txt')).toBe('/home/user/file.txt');
      expect(convertToWindowsPath('./relative/path')).toBe('./relative/path');
    });
  });

  describe('normalizePath', () => {
    test('クォート文字と空白を除去', () => {
      expect(normalizePath('"C:\\Users\\test\\file.txt"')).toBe('C:\\Users\\test\\file.txt');
      
      // Windows環境をモック
      global.mockPlatform('win32');
      expect(normalizePath("'./file.txt'")).toBe('.\\file.txt');
      global.resetPlatform();
      
      expect(normalizePath('  /home/user/file.txt  ')).toBe('/home/user/file.txt');
    });

    test('Unixパスの正規化', () => {
      expect(normalizePath('/home//user///file.txt')).toBe('/home/user/file.txt');
      expect(normalizePath('/home/user/file.txt/')).toBe('/home/user/file.txt');
      expect(normalizePath('/home/user/./file.txt')).toBe('/home/user/file.txt');
    });

    test('WSLパスのWindows変換と正規化', () => {
      expect(normalizePath('/mnt/c/Users//test\\\\file.txt')).toBe('C:\\Users\\test\\file.txt');
    });

    test('CygwinパスのWindows変換と正規化', () => {
      expect(normalizePath('/cygdrive/c/Users/test')).toBe('C:\\Users\\test');
    });

    test('UNCパスの正規化', () => {
      expect(normalizePath('\\\\\\\\server\\\\share\\\\file.txt')).toBe('\\\\server\\share\\file.txt');
      expect(normalizePath('\\\\server\\share\\folder\\file.txt')).toBe('\\\\server\\share\\folder\\file.txt');
    });

    test('ドライブ文字の大文字化', () => {
      expect(normalizePath('c:\\users\\test\\file.txt')).toBe('C:\\users\\test\\file.txt');
      expect(normalizePath('d:/projects/code.js')).toBe('D:\\projects\\code.js');
    });

    test('相対パスの正規化', () => {
      // Windows環境をモック
      global.mockPlatform('win32');
      expect(normalizePath('./folder/file.txt')).toBe('.\\folder\\file.txt');
      expect(normalizePath('../parent/file.txt')).toBe('..\\parent\\file.txt');
      global.resetPlatform();
    });
  });

  describe('expandHome', () => {
    const originalHomedir = require('os').homedir;
    
    beforeEach(() => {
      // ホームディレクトリをモック
      require('os').homedir = jest.fn().mockReturnValue('/home/testuser');
    });

    afterEach(() => {
      require('os').homedir = originalHomedir;
    });

    test('チルダパスの展開', () => {
      expect(expandHome('~/Documents/file.txt')).toBe('/home/testuser/Documents/file.txt');
      expect(expandHome('~')).toBe('/home/testuser');
    });

    test('チルダ以外のパスはそのまま', () => {
      expect(expandHome('/absolute/path')).toBe('/absolute/path');
      expect(expandHome('./relative/path')).toBe('./relative/path');
      expect(expandHome('no-tilde/path')).toBe('no-tilde/path');
    });
  });

  describe('getPlatformInfo', () => {
    test('Windows環境の検出', () => {
      global.mockPlatform('win32');
      const info = getPlatformInfo();
      expect(info.isWindows).toBe(true);
      expect(info.isLinux).toBe(false);
      expect(info.isMacOS).toBe(false);
    });

    test('Linux環境の検出', () => {
      global.mockPlatform('linux');
      const info = getPlatformInfo();
      expect(info.isWindows).toBe(false);
      expect(info.isLinux).toBe(true);
      expect(info.isMacOS).toBe(false);
    });

    test('Cygwin環境の検出', () => {
      global.mockPlatform('win32', { CYGWIN: '1' });
      const info = getPlatformInfo();
      expect(info.isCygwin).toBe(true);
    });

    test('MSYSTEM環境の検出（Git Bash等）', () => {
      global.mockPlatform('win32', { MSYSTEM: 'MINGW64' });
      const info = getPlatformInfo();
      expect(info.isCygwin).toBe(true);
    });
  });

  describe('checkPathCompatibility', () => {
    test('Windowsドライブパスの検出', () => {
      const compat = checkPathCompatibility('C:\\Users\\test\\file.txt');
      expect(compat.hasWindowsDrive).toBe(true);
      expect(compat.hasUNCPath).toBe(false);
      expect(compat.hasWSLPath).toBe(false);
      expect(compat.hasUnixPath).toBe(false);
    });

    test('UNCパスの検出', () => {
      const compat = checkPathCompatibility('\\\\server\\share\\file.txt');
      expect(compat.hasWindowsDrive).toBe(false);
      expect(compat.hasUNCPath).toBe(true);
      expect(compat.hasWSLPath).toBe(false);
      expect(compat.hasUnixPath).toBe(false);
    });

    test('WSLパスの検出', () => {
      const compat = checkPathCompatibility('/mnt/c/Users/test/file.txt');
      expect(compat.hasWindowsDrive).toBe(false);
      expect(compat.hasUNCPath).toBe(false);
      expect(compat.hasWSLPath).toBe(true);
      expect(compat.hasUnixPath).toBe(false);
    });

    test('Unixパスの検出', () => {
      const compat = checkPathCompatibility('/home/user/file.txt');
      expect(compat.hasWindowsDrive).toBe(false);
      expect(compat.hasUNCPath).toBe(false);
      expect(compat.hasWSLPath).toBe(false);
      expect(compat.hasUnixPath).toBe(true);
    });

    test('相対パスの検出', () => {
      const compat = checkPathCompatibility('./relative/file.txt');
      expect(compat.isRelativePath).toBe(true);
      expect(compat.hasWindowsDrive).toBe(false);
      expect(compat.hasUnixPath).toBe(false);
    });
  });

  describe('エッジケースとエラーハンドリング', () => {
    test('空文字列の処理', () => {
      expect(normalizePath('')).toBe('.');
      expect(expandHome('')).toBe('');
    });

    test('特殊文字を含むパス', () => {
      expect(normalizePath('C:\\Users\\日本語\\ファイル.txt')).toBe('C:\\Users\\日本語\\ファイル.txt');
      expect(normalizePath('/home/用户/文件.txt')).toBe('/home/用户/文件.txt');
    });

    test('非常に長いパス', () => {
      const longPath = 'C:\\' + 'very-long-directory-name\\'.repeat(50) + 'file.txt';
      const result = normalizePath(longPath);
      expect(result).toContain('C:\\');
      expect(result).toContain('file.txt');
    });

    test('不正なパス文字の処理', () => {
      // Windowsで無効な文字
      const invalidChars = ['<', '>', ':', '"', '|', '?', '*'];
      invalidChars.forEach(char => {
        const invalidPath = `C:\\Users\\test${char}file.txt`;
        // 正規化は行うが、エラーは発生しない
        expect(() => normalizePath(invalidPath)).not.toThrow();
      });
    });
  });

  describe('クロスプラットフォーム統合テスト', () => {
    const testCases = [
      {
        platform: 'win32' as NodeJS.Platform,
        input: '/mnt/c/Users/test/file.txt',
        expected: 'C:\\Users\\test\\file.txt',
        description: 'Windows環境でのWSLパス変換'
      },
      {
        platform: 'linux' as NodeJS.Platform,
        input: '/home/user/file.txt',
        expected: '/home/user/file.txt',
        description: 'Linux環境でのUnixパス保持'
      },
      {
        platform: 'win32' as NodeJS.Platform,
        input: 'C:/Users/test/file.txt',
        expected: 'C:\\Users\\test\\file.txt',
        description: 'Windows環境でのスラッシュ変換'
      }
    ];

    testCases.forEach(({ platform, input, expected, description }) => {
      test(description, () => {
        global.mockPlatform(platform);
        expect(normalizePath(input)).toBe(expected);
      });
    });
  });
});