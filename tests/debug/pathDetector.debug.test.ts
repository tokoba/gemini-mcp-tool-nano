/**
 * PathDetector詳細デバッグテスト
 */

import { 
  PathDetector,
  createDefaultPathDetector,
  EXCLUSION_PATTERNS
} from '../../src/utils/filepath/pathDetector.js';

describe('PathDetector詳細デバッグ', () => {
  beforeEach(() => {
    global.mockLogger();
  });

  test('メールアドレス検出の詳細確認', () => {
    console.log('=== PathDetector メールアドレス検出テスト ===\n');
    
    const detector = createDefaultPathDetector();
    const testContent = 'Check @/home/test/valid.txt and contact user@example.com';
    
    console.log(`入力テキスト: "${testContent}"`);
    
    // パス検出実行
    const detectedPaths = detector.detectFilePaths(testContent);
    
    console.log('\n=== 検出結果 ===');
    console.log(`検出されたパス数: ${detectedPaths.length}`);
    
    detectedPaths.forEach((path, index) => {
      console.log(`${index + 1}. パターン: "${path.match}"`);
      console.log(`   タイプ: ${path.type}`);
      console.log(`   ファイルパス: "${path.filepath}"`);
      console.log(`   プラットフォーム: ${path.platform}`);
      console.log(`   開始位置: ${path.startIndex}`);
      console.log(`   終了位置: ${path.endIndex}`);
    });
    
    // EXCLUSION_PATTERNSの確認
    console.log('\n=== EXCLUSION_PATTERNS確認 ===');
    const emailPattern = 'user@example.com';
    console.log(`テストパターン: "${emailPattern}"`);
    
    EXCLUSION_PATTERNS.forEach((pattern, index) => {
      const matches = pattern.test(emailPattern);
      console.log(`${index + 1}. ${pattern.toString()}: ${matches ? 'マッチ' : '非マッチ'}`);
    });
    
    // 個別の@記号確認
    console.log('\n=== @記号の個別確認 ===');
    const atMatches = testContent.matchAll(/@[^\s]*/g);
    const allAtMatches = [...atMatches];
    console.log(`全@記号パターン: ${allAtMatches.length}個`);
    allAtMatches.forEach((match, index) => {
      console.log(`${index + 1}. "${match[0]}" (位置: ${match.index})`);
    });
    
    // 最低限の検証
    expect(detectedPaths).toBeDefined();
  });
});