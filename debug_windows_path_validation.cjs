/**
 * Windows パス検証問題のデバッグ
 */

const { PathValidator, DEFAULT_SECURITY_CONFIG } = require('./dist/utils/filepath/pathValidator.js');
const path = require('path');

// ファイルシステムmock
global.mockFileSystem = function(files) {
  const fs = require('fs');
  
  jest.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
    return files.hasOwnProperty(filePath);
  });
  
  jest.spyOn(fs.promises, 'access').mockImplementation(async (filePath) => {
    if (!files.hasOwnProperty(filePath)) {
      const error = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      throw error;
    }
  });
  
  jest.spyOn(fs.promises, 'stat').mockImplementation(async (filePath) => {
    if (!files.hasOwnProperty(filePath)) {
      const error = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      throw error;
    }
    return {
      isFile: () => true,
      isDirectory: () => false,
      isCharacterDevice: () => false,
      isBlockDevice: () => false,
      isSymbolicLink: () => false,
      size: files[filePath].content ? files[filePath].content.length : 0
    };
  });
  
  jest.spyOn(fs.promises, 'realpath').mockImplementation(async (filePath) => {
    if (!files.hasOwnProperty(filePath)) {
      const error = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      throw error;
    }
    return filePath; // モックでは同じパスを返す
  });
  
  jest.spyOn(fs.promises, 'readFile').mockImplementation(async (filePath, options) => {
    if (!files.hasOwnProperty(filePath)) {
      const error = new Error('ENOENT: no such file or directory');
      error.code = 'ENOENT';
      throw error;
    }
    return files[filePath].content || '';
  });
};

// Logger mock
global.mockLogger = function() {};
global.mockLogger();

async function debugWindowsPathValidation() {
  console.log('=== Windows Path Validation Debug ===\n');
  
  // ファイルシステムのセットアップ
  global.mockFileSystem({
    'C:\\Users\\test\\file.txt': { content: 'windows file' },
    'C:\\Windows\\file.txt': { content: 'system file' }
  });
  
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
    
    try {
      const validationResult = await validator.validatePath(testPath);
      console.log('  Validation result:');
      console.log('    valid:', validationResult.valid);
      console.log('    isSafeToRead:', validationResult.isSafeToRead);
      console.log('    errors:', validationResult.errors);
      console.log('    normalizedPath:', JSON.stringify(validationResult.normalizedPath));
      console.log('    realPath:', JSON.stringify(validationResult.realPath));
    } catch (error) {
      console.log('  Validation error:', error.message);
    }
    
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
}

debugWindowsPathValidation().catch(console.error);