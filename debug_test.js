import { debugAtSymbolProcessing, enableEnhancedProcessor } from './src/utils/promptPreprocessor.js';
import { DEFAULT_SECURITY_CONFIG } from './src/utils/filepath/pathValidator.js';

// Mock file system
const fs = require('fs');
jest.spyOn(fs, 'existsSync').mockImplementation((path) => {
  return path === '/home/test/valid.txt';
});

// Enable enhanced processor
enableEnhancedProcessor();

const prompt = 'Check @/home/test/valid.txt and contact user@example.com';
console.log('Input:', prompt);

debugAtSymbolProcessing(prompt, process.cwd(), true).then(result => {
  console.log('Mode:', result.mode);
  console.log('Original:', result.original);
  console.log('Processed:', result.processed);
  console.log('Changes:', result.changes);
  console.log('Statistics:', result.statistics);
}).catch(console.error);