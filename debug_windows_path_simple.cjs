/**
 * Windows パス検証問題の簡易デバッグ
 */

const { PathValidator, DEFAULT_SECURITY_CONFIG } = require('./dist/utils/filepath/pathValidator.js');
const path = require('path');

function debugWindowsPathValidation() {
  console.log('=== Windows Path Validation Debug ===\n');
  
  // PathValidator のセットアップ
  const validator = new PathValidator({
    ...DEFAULT_SECURITY_CONFIG,
    allowedDirectories: ['C:\\Users\\test', 'C:\\Windows']
  });
  
  const testPaths = [
    'C:\\Users\\test\\file.txt',
    'C:\\Windows\\file.txt',
    'C:\\Users\\test\\missing.txt'
  ];
  
  console.log('Current platform:', process.platform);
  console.log('Current working directory:', process.cwd());
  console.log('Path module info:');
  console.log('  path.sep:', JSON.stringify(path.sep));
  console.log('  path.posix.sep:', JSON.stringify(path.posix.sep));
  console.log('  path.win32.sep:', JSON.stringify(path.win32.sep));
  console.log();
  
  for (const testPath of testPaths) {
    console.log(`Testing path: "${testPath}"`);
    console.log('  path.isAbsolute(path):', path.isAbsolute(testPath));
    console.log('  path.win32.isAbsolute(path):', path.win32.isAbsolute(testPath));
    console.log('  path.posix.isAbsolute(path):', path.posix.isAbsolute(testPath));
    
    const normalized = path.normalize(testPath);
    console.log('  path.normalize(path):', JSON.stringify(normalized));
    
    const resolved = path.resolve(process.cwd(), testPath);
    console.log('  path.resolve(cwd, path):', JSON.stringify(resolved));
    
    console.log();
  }
  
  // isPathWithinAllowedDirectories の個別テスト
  console.log('=== isPathWithinAllowedDirectories Debug ===\n');
  
  const testCases = [
    {
      path: 'C:\\Users\\test\\file.txt',
      allowed: ['C:\\Users\\test']
    },
    {
      path: '/home/maru/dev/ts/gemini-mcp-tool-nano/C:\\Users\\test\\file.txt',  // Linux で resolve された可能性
      allowed: ['C:\\Users\\test']
    },
    {
      path: '/home/maru/dev/ts/gemini-mcp-tool-nano/C:/Users/test/file.txt',  // 正規化された可能性
      allowed: ['C:\\Users\\test']
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`Testing isPathWithinAllowedDirectories:`);
    console.log(`  path: "${testCase.path}"`);
    console.log(`  allowedDirs: [${testCase.allowed.map(d => `"${d}"`).join(', ')}]`);
    
    try {
      const result = validator.isPathWithinAllowedDirectories(testCase.path, testCase.allowed);
      console.log(`  result: ${result}`);
    } catch (error) {
      console.log(`  error: ${error.message}`);
    }
    console.log();
  }
  
  // normalizePath テスト
  console.log('=== normalizePath Debug ===\n');
  const { normalizePath } = require('./dist/utils/filepath/pathUtils.js');
  
  for (const testPath of testPaths) {
    console.log(`normalizePath("${testPath}"):`, JSON.stringify(normalizePath(testPath)));
  }
}

debugWindowsPathValidation();