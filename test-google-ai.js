import { GoogleGenerativeAI } from '@google/generative-ai';

// Test without API key first to see available methods
const genAI = new GoogleGenerativeAI('test-key');

try {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
  console.log('Model created successfully');
  console.log('Model methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(model)));
  
  // Test different text types for token counting
  const testTexts = [
    "Hello world",
    "これは日本語のテストです。", // Japanese
    "这是中文测试。", // Chinese
    "안녕하세요 한국어 테스트입니다.", // Korean
    `This is a longer text that might be useful for testing chunking functionality.
    
    It has multiple paragraphs and various content types.
    
    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`,
  ];
  
  console.log('\nTest texts prepared:');
  testTexts.forEach((text, i) => {
    console.log(`Text ${i + 1}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  });
  
} catch (error) {
  console.error('Error creating model:', error.message);
}