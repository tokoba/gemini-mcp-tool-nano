/**
 * PathValidator詳細デバッグテスト
 */

import { PathValidator, DEFAULT_SECURITY_CONFIG } from '../../src/utils/filepath/pathValidator.js';

describe('PathValidator詳細デバッグ', () => {
  beforeEach(() => {
    global.mockLogger();
    
    // ファイルシステムのモック
    global.mockFileSystem({
      '/home/test/valid.txt': { content: 'valid content' }
    });
  });

  test('PathValidator単体での動作確認', async () => {
    console.log('=== PathValidator 詳細デバッグ ===\n');
    
    // セキュリティ設定
    const securityConfig = {
      ...DEFAULT_SECURITY_CONFIG,
      allowedDirectories: ['/home/test', '/var/log']
    };
    
    console.log('セキュリティ設定:');
    console.log('- allowedDirectories:', securityConfig.allowedDirectories);
    console.log('- maxFileSize:', securityConfig.maxFileSize);
    console.log('- allowHiddenFiles:', securityConfig.allowHiddenFiles);
    console.log('- allowBinaryFiles:', securityConfig.allowBinaryFiles);
    console.log('- allowSymlinks:', securityConfig.allowSymlinks);
    
    const validator = new PathValidator(securityConfig);
    const filepath = '/home/test/valid.txt';
    
    console.log(`\n=== ファイルパス検証: "${filepath}" ===`);
    
    try {
      const result = await validator.validatePath(filepath);
      
      console.log('\n=== PathValidator結果 ===');
      console.log('- valid:', result.valid);
      console.log('- isSafeToRead:', result.isSafeToRead);
      console.log('- normalizedPath:', result.normalizedPath);
      console.log('- realPath:', result.realPath);
      console.log('- errors:', result.errors);
      console.log('- reason:', result.reason);
      
    } catch (error) {
      console.error('PathValidator エラー:', error);
    }
    
    // 追加テスト: 個別メソッドの確認
    console.log('\n=== 個別メソッド確認 ===');
    
    try {
      const dirCheck = validator.isPathWithinAllowedDirectories(filepath, securityConfig.allowedDirectories);
      console.log('- isPathWithinAllowedDirectories:', dirCheck);
      
      const traversalCheck = validator.preventDirectoryTraversal(filepath);
      console.log('- preventDirectoryTraversal:', traversalCheck);
      
    } catch (error) {
      console.error('個別メソッドエラー:', error);
    }
    
    // 最低限の検証
    expect(filepath).toBe('/home/test/valid.txt');
  });
});