/**
 * @nonexistent.txt の検出問題をデバッグ
 */

const { createDefaultPathDetector } = require('./dist/utils/filepath/pathDetector.js');

async function testNonexistentDetection() {
  console.log('=== @nonexistent.txt 検出テスト ===\n');
  
  const detector = createDefaultPathDetector();
  
  const testCases = [
    '@nonexistent.txt',
    'Invalid @nonexistent.txt path',
    '@/home/test/valid.txt',
    'user@example.com'
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`${index + 1}. テストケース: "${testCase}"`);
    const detectedPaths = detector.detectFilePaths(testCase);
    
    if (detectedPaths.length === 0) {
      console.log('   検出されたパス: なし');
    } else {
      detectedPaths.forEach((path, i) => {
        console.log(`   検出 ${i + 1}: "${path.match}" (type: ${path.type}, filepath: "${path.filepath}")`);
      });
    }
    console.log('');
  });
}

testNonexistentDetection().catch(console.error);