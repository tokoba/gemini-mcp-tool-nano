/**
 * 簡易デバッグテスト: promptPreprocessorの動作確認
 */

import { 
  debugAtSymbolProcessing,
  enableEnhancedProcessor,
  updatePreprocessorConfig
} from './src/utils/promptPreprocessor.js';
import { DEFAULT_SECURITY_CONFIG } from './src/utils/filepath/pathValidator.js';

describe('promptPreprocessor デバッグテスト', () => {
  beforeEach(() => {
    global.mockLogger();
    
    // ファイルシステムのモック
    global.mockFileSystem({
      '/home/test/valid.txt': { content: 'valid content' }
    });
    
    // Enhanced processor有効化
    enableEnhancedProcessor();
    
    // セキュリティ設定
    updatePreprocessorConfig({
      filepathConfig: {
        security: {
          ...DEFAULT_SECURITY_CONFIG,
          allowedDirectories: ['/home/test', '/var/log']
        }
      }
    });
  });

  test('詳細デバッグ情報の取得', async () => {
    const prompt = 'Check @/home/test/valid.txt and contact user@example.com';
    console.log(`=== Input: "${prompt}" ===`);
    
    const result = await debugAtSymbolProcessing(prompt, '', true);
    
    console.log('\n=== Debug Result ===');
    console.log(`Mode: ${result.mode}`);
    console.log(`Original: "${result.original}"`);
    console.log(`Processed: "${result.processed}"`);
    console.log('\n=== Changes ===');
    result.changes.forEach((change, index) => {
      console.log(`${index + 1}. Pattern: "${change.pattern}"`);
      console.log(`   Action: ${change.action}`);
      console.log(`   Reason: ${change.reason}`);
    });
    
    if (result.statistics) {
      console.log('\n=== Statistics ===');
      console.log(`Total @ symbols: ${result.statistics.totalAtSymbols}`);
      console.log(`Detected paths: ${result.statistics.detectedPaths}`);
      console.log(`Valid paths: ${result.statistics.validPaths}`);
      console.log(`Safe paths: ${result.statistics.safePaths}`);
      console.log(`By type:`, JSON.stringify(result.statistics.byType, null, 2));
      console.log(`By platform:`, JSON.stringify(result.statistics.byPlatform, null, 2));
    }
    
    // 期待値との比較
    console.log('\n=== Expected vs Actual ===');
    console.log(`Expected: "Check @/home/test/valid.txt and contact user@ example.com"`);
    console.log(`Actual:   "${result.processed}"`);
    
    // 最低限の検証
    expect(result.mode).toBe('enhanced');
    expect(result.processed).toBeDefined();
  });
});