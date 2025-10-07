import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { performance } from 'perf_hooks';
import { countTokens } from '../../src/utils/tokenizer.js';
import { chunkText } from '../../src/utils/chunker.js';
import { saveChunks, getChunk } from '../../src/utils/chunkCache.js';

describe('Performance and Load Tests', () => {
  const cacheBaseDir = path.join(os.tmpdir(), 'gemini-mcp-tool-cache');
  let generatedCacheIds: string[] = [];

  afterAll(async () => {
    // Clean up cache directories
    for (const cacheId of generatedCacheIds) {
      const cacheDir = path.join(cacheBaseDir, cacheId);
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      }
    }

    if (fs.existsSync(cacheBaseDir)) {
      try {
        const entries = fs.readdirSync(cacheBaseDir);
        if (entries.length === 0) {
          fs.rmdirSync(cacheBaseDir);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Tokenizer Performance Tests', () => {
    it('should count tokens efficiently for large text', () => {
      // Generate large text (1MB)
      const largeText = 'This is a performance test sentence with mixed content. '.repeat(20000);
      
      const startTime = performance.now();
      const tokenCount = countTokens(largeText);
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      console.log(`Token counting for ${largeText.length} chars took ${executionTime.toFixed(2)}ms`);
      
      // Should complete within reasonable time (< 100ms for 1MB)
      expect(executionTime).toBeLessThan(100);
      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBe(Math.ceil(Array.from(largeText).length / 4.0));
    });

    it('should handle multilingual text performance', () => {
      // Create multilingual content
      const multilingualText = [
        'English text with standard ASCII characters.',
        'Japanese: こんにちは世界。これは日本語のテストです。',
        'Chinese: 你好世界。这是中文测试。',
        'Korean: 안녕하세요 세계. 이것은 한국어 테스트입니다.',
        'Emoji: 🚀🌟✨🎉🔥💫🌈🎯⚡🌸',
        'Mixed: Hello こんにちは 你好 안녕하세요 🌍'
      ].join('\n').repeat(5000); // ~5000 repetitions

      const startTime = performance.now();
      const tokenCount = countTokens(multilingualText);
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      console.log(`Multilingual token counting took ${executionTime.toFixed(2)}ms`);
      
      // Should handle Unicode efficiently
      expect(executionTime).toBeLessThan(200);
      expect(tokenCount).toBeGreaterThan(0);
    });
  });

  describe('Chunker Performance Tests', () => {
    it('should chunk very large documents efficiently', () => {
      // Create a 5MB document with paragraph structure
      const paragraphs = [];
      for (let i = 0; i < 1000; i++) {
        paragraphs.push([
          `## Section ${i}`,
          `This is paragraph ${i} with detailed content about topic ${i}.`,
          `It contains technical information and examples.`,
          `The content includes various formatting and structures.`,
          ``,
          `### Subsection ${i}.1`,
          `More detailed content for subsection ${i}.1.`,
          `This includes code examples and technical details.`,
          ``,
          `\`\`\`typescript`,
          `function example${i}() {`,
          `  console.log("Example function ${i}");`,
          `  return "result-${i}";`,
          `}`,
          `\`\`\``,
          ``,
          `End of section ${i}.`,
          `---`,
          ``
        ].join('\n'));
      }
      
      const largeDocument = paragraphs.join('\n');
      const tokenCount = countTokens(largeDocument);
      
      console.log(`Large document: ${largeDocument.length} chars, ~${tokenCount} tokens`);
      
      const startTime = performance.now();
      const chunks = chunkText(largeDocument, {
        maxTokens: 8000,
        preserveStructure: true
      });
      const endTime = performance.now();
      
      const executionTime = endTime - startTime;
      console.log(`Chunking took ${executionTime.toFixed(2)}ms for ${chunks.length} chunks`);
      
      // Should complete chunking within reasonable time
      expect(executionTime).toBeLessThan(1000); // < 1 second
      expect(chunks.length).toBeGreaterThan(1);
      
      // Verify chunk sizes
      for (let i = 0; i < chunks.length; i++) {
        const chunkTokens = countTokens(chunks[i]);
        expect(chunkTokens).toBeLessThanOrEqual(10000); // Allow some buffer
      }
      
      // Verify content integrity
      const reassembled = chunks.join('');
      expect(reassembled).toBe(largeDocument);
    });

    it('should handle concurrent chunking operations', async () => {
      // Create multiple documents to chunk simultaneously
      const documents = [];
      for (let i = 0; i < 5; i++) {
        const doc = `Document ${i}:\n` + 'Content line for performance testing. '.repeat(2000);
        documents.push(doc);
      }

      const startTime = performance.now();
      
      // Process all documents concurrently
      const chunkingPromises = documents.map((doc, index) => {
        return new Promise((resolve) => {
          const chunks = chunkText(doc, {
            maxTokens: 4000,
            preserveStructure: true
          });
          resolve({ index, chunks: chunks.length, tokens: countTokens(doc) });
        });
      });

      const results = await Promise.all(chunkingPromises);
      const endTime = performance.now();
      
      const totalTime = endTime - startTime;
      console.log(`Concurrent chunking of ${documents.length} docs took ${totalTime.toFixed(2)}ms`);
      console.log('Results:', results);
      
      // Should handle concurrent processing efficiently
      expect(totalTime).toBeLessThan(2000); // < 2 seconds total
      expect(results).toHaveLength(5);
      
      for (const result of results) {
        expect(result).toHaveProperty('chunks');
        expect(result).toHaveProperty('tokens');
        expect((result as any).chunks).toBeGreaterThan(0);
      }
    });
  });

  describe('Cache Performance Tests', () => {
    it('should handle high-volume cache operations efficiently', async () => {
      const testData = [];
      const cacheKeys = [];
      
      // Generate test data sets
      for (let i = 0; i < 10; i++) {
        const chunks = [];
        for (let j = 0; j < 5; j++) {
          chunks.push(`Test chunk ${i}-${j}: ` + 'Sample content data. '.repeat(100));
        }
        testData.push(chunks);
      }

      // Test cache save performance
      const saveStartTime = performance.now();
      
      for (const chunks of testData) {
        const cacheResult = await saveChunks(chunks, { totalTokens: countTokens(chunks.join('')) });
        cacheKeys.push(cacheResult.cacheKey);
        generatedCacheIds.push(cacheResult.cacheKey);
      }
      
      const saveEndTime = performance.now();
      const saveTime = saveEndTime - saveStartTime;
      
      console.log(`Saving ${testData.length} cache sets took ${saveTime.toFixed(2)}ms`);
      
      // Test cache retrieval performance
      const retrieveStartTime = performance.now();
      
      let retrievalCount = 0;
      for (const cacheKey of cacheKeys) {
        for (let chunkNum = 1; chunkNum <= 5; chunkNum++) {
          const chunk = await getChunk(cacheKey, chunkNum);
          expect(chunk).toBeTruthy();
          retrievalCount++;
        }
      }
      
      const retrieveEndTime = performance.now();
      const retrieveTime = retrieveEndTime - retrieveStartTime;
      
      console.log(`Retrieved ${retrievalCount} chunks in ${retrieveTime.toFixed(2)}ms`);
      console.log(`Average retrieval time: ${(retrieveTime / retrievalCount).toFixed(2)}ms per chunk`);
      
      // Performance expectations
      expect(saveTime).toBeLessThan(3000); // < 3 seconds for 10 sets
      expect(retrieveTime).toBeLessThan(1000); // < 1 second for 50 retrievals
      expect(retrieveTime / retrievalCount).toBeLessThan(50); // < 50ms per retrieval
    });

    it('should handle concurrent cache access', async () => {
      // Create test chunks
      const testChunks = ['Chunk A', 'Chunk B', 'Chunk C', 'Chunk D', 'Chunk E'];
      const cacheResult = await saveChunks(testChunks, { totalTokens: 25 });
      generatedCacheIds.push(cacheResult.cacheKey);

      // Concurrent access test
      const concurrentPromises = [];
      
      for (let i = 0; i < 20; i++) {
        const chunkNum = (i % 5) + 1; // Cycle through chunks 1-5
        concurrentPromises.push(
          getChunk(cacheResult.cacheKey, chunkNum).then(chunk => ({
            request: i,
            chunkNum,
            success: chunk !== null,
            content: chunk
          }))
        );
      }

      const startTime = performance.now();
      const results = await Promise.all(concurrentPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      console.log(`${concurrentPromises.length} concurrent retrievals took ${totalTime.toFixed(2)}ms`);

      // All requests should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
        expect(result.content).toBeTruthy();
      }

      // Should handle concurrency efficiently
      expect(totalTime).toBeLessThan(500); // < 500ms for 20 concurrent requests
    });
  });

  describe('Memory Usage Tests', () => {
    it('should handle large text without excessive memory usage', () => {
      // Monitor memory usage before
      const memBefore = process.memoryUsage();
      
      // Process very large text
      const hugeText = 'Large text content for memory testing. '.repeat(100000); // ~3.7MB
      
      const tokenCount = countTokens(hugeText);
      const chunks = chunkText(hugeText, { maxTokens: 8000, preserveStructure: true });
      
      // Monitor memory usage after
      const memAfter = process.memoryUsage();
      
      const memoryIncrease = memAfter.heapUsed - memBefore.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);
      
      console.log(`Memory usage increased by ${memoryIncreaseMB.toFixed(2)}MB`);
      console.log(`Processed ${hugeText.length} chars into ${chunks.length} chunks`);
      
      // Memory increase should be reasonable (< 150MB for 3.7MB input)
      // Note: Node.js may use additional memory for string operations and GC overhead
      expect(memoryIncreaseMB).toBeLessThan(150);
      expect(tokenCount).toBeGreaterThan(0);
      expect(chunks.length).toBeGreaterThan(1);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    });
  });

  describe('Stress Tests', () => {
    it('should handle repeated operations without degradation', async () => {
      const testContent = 'Stress test content with repeated operations. '.repeat(1000);
      const executionTimes = [];

      // Perform the same operation multiple times
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        // Combined operations
        const tokenCount = countTokens(testContent);
        const chunks = chunkText(testContent, { maxTokens: 4000, preserveStructure: true });
        const cacheResult = await saveChunks(chunks, { totalTokens: tokenCount });
        generatedCacheIds.push(cacheResult.cacheKey);
        
        // Retrieve first chunk
        const retrievedChunk = await getChunk(cacheResult.cacheKey, 1);
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        executionTimes.push(executionTime);
        
        expect(retrievedChunk).toBe(chunks[0]);
      }

      console.log('Execution times:', executionTimes.map(t => `${t.toFixed(2)}ms`));
      
      const avgTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);
      
      console.log(`Average: ${avgTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
      
      // Performance should be consistent (max shouldn't be more than 3x average for integration tests)
      expect(maxTime).toBeLessThan(avgTime * 3);
      expect(avgTime).toBeLessThan(1000); // < 1 second average
    });
  });
});