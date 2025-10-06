// デバッグ用スクリプト: @記号処理の詳細動作確認
const { debugAtSymbolProcessing, enableEnhancedProcessor, updatePreprocessorConfig } = require('./src/utils/promptPreprocessor.js');
const { DEFAULT_SECURITY_CONFIG } = require('./src/utils/filepath/pathValidator.js');

// Mock file system for testing
const fs = require('fs');
jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
  console.log(`[Mock] existsSync called for: ${path}`);
  return path === '/home/test/valid.txt';
});

async function debugTest() {
  console.log('=== @記号処理デバッグテスト ===\n');
  
  // Enhanced processor有効化
  enableEnhancedProcessor();
  console.log('Enhanced processor enabled');
  
  // セキュリティ設定
  updatePreprocessorConfig({
    filepathConfig: {
      security: {
        ...DEFAULT_SECURITY_CONFIG,
        allowedDirectories: ['/home/test', '/var/log']
      }
    }
  });
  console.log('Security config updated');
  
  const prompt = 'Check @/home/test/valid.txt and contact user@example.com';
  console.log(`Input prompt: "${prompt}"\n`);
  
  try {
    const result = await debugAtSymbolProcessing(prompt, process.cwd(), true);
    
    console.log('=== Debug Result ===');
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
      console.log(`By type:`, result.statistics.byType);
      console.log(`By platform:`, result.statistics.byPlatform);
    }
    
  } catch (error) {
    console.error('Error during debug:', error);
  }
}

debugTest().catch(console.error);