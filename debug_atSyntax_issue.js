/**
 * AtSyntaxProcessor の問題を緊急デバッグ
 */

import { createDefaultAtSyntaxProcessor } from './src/utils/filepath/atSyntaxProcessor.js';
import { createDefaultPathDetector } from './src/utils/filepath/pathDetector.js';

// Logger mock
global.mockLogger = function() {};
global.mockLogger();

// ファイルシステムmock
global.mockFileSystem = function(files) {
  const fs = require('fs');
  const path = require('path');
  
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
      size: files[filePath].content ? files[filePath].content.length : 0
    };
  });
};

async function debugAtSyntaxIssue() {
  console.log('=== AtSyntaxProcessor Debug ===\n');
  
  // ファイルシステムのセットアップ
  global.mockFileSystem({});
  
  // PathDetector のテスト
  console.log('1. PathDetector テスト');
  const detector = createDefaultPathDetector();
  const detectedPaths = detector.detectFilePaths('Invalid @nonexistent.txt path');
  
  console.log('Detected paths:', detectedPaths);
  console.log('');
  
  // AtSyntaxProcessor のテスト
  console.log('2. AtSyntaxProcessor テスト');
  const processor = createDefaultAtSyntaxProcessor();
  
  try {
    const result = await processor.process('Invalid @nonexistent.txt path');
    console.log('Processed content:', result.processedContent);
    console.log('Modifications:', result.modifications);
    console.log('');
    
    if (result.modifications.length > 0) {
      const mod = result.modifications[0];
      console.log('First modification:');
      console.log('  Original:', mod.original);
      console.log('  Modified:', mod.modified);
      console.log('  Action:', mod.action);
      console.log('  Reason:', mod.reason);
    }
    
  } catch (error) {
    console.log('Error:', error.message);
  }
  
  console.log('\n=== Windows Path Test ===\n');
  
  // Windows path テスト
  global.mockPlatform = function(platform) {
    Object.defineProperty(process, 'platform', {
      value: platform,
      writable: true
    });
  };
  
  global.mockPlatform('win32');
  global.mockFileSystem({
    'C:\\Users\\test\\file.txt': { content: 'windows file' }
  });
  
  const winDetectedPaths = detector.detectFilePaths('@C:\\Users\\test\\file.txt');
  console.log('Windows detected paths:', winDetectedPaths);
  
  try {
    const winResult = await processor.process('@C:\\Users\\test\\file.txt');
    console.log('Windows processed content:', winResult.processedContent);
    console.log('Windows modifications:', winResult.modifications);
  } catch (error) {
    console.log('Windows error:', error.message);
  }
}

debugAtSyntaxIssue().catch(console.error);