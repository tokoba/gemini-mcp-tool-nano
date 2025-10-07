import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { askGeminiTool } from '../../src/tools/ask-gemini.tool.js';
import { fetchChunkTool } from '../../src/tools/fetch-chunk.tool.js';

describe('Chunking System Integration Tests', () => {
  const fixturesDir = path.join(__dirname, '../fixtures');
  const largeFilePath = path.join(fixturesDir, 'large-file.txt');
  const smallFilePath = path.join(fixturesDir, 'small-file.txt');
  const cacheBaseDir = path.join(os.tmpdir(), 'gemini-mcp-tool-cache');

  let generatedCacheIds: string[] = [];

  beforeAll(async () => {
    // Ensure fixtures directory exists
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    // Generate large test file to force chunking response from Gemini
    // Create a very large prompt that will result in a substantial response
    const largeContent = [
      '# Comprehensive Software Architecture Document',
      '',
      'This is an extremely detailed technical specification document.',
      'It contains comprehensive information about software design patterns, architectural principles, and implementation details.',
      '',
    ].join('\n');

    // Create massive content that will likely result in long Gemini responses  
    const sections = [];
    for (let i = 1; i <= 500; i++) {
      sections.push([
        `## Section ${i}: Advanced Technical Topic ${i}`,
        `This section covers complex technical concepts in software engineering topic ${i}.`,
        `It includes detailed explanations of algorithms, data structures, design patterns, and best practices.`,
        `The content discusses various aspects of distributed systems, microservices, containerization, and cloud-native architectures.`,
        `Japanese technical term ${i}: ソフトウェア設計パターン第${i}章`,
        `Chinese technical term ${i}: 软件设计模式第${i}章`,
        `Korean technical term ${i}: 소프트웨어 설계 패턴 제${i}장`,
        ``,
        `### Subsection ${i}.1: Implementation Details`,
        `Detailed implementation guidelines with code examples, performance considerations, and scalability factors.`,
        `This includes memory management, thread safety, error handling, and resource optimization techniques.`,
        ``,
        `### Subsection ${i}.2: Performance Metrics`,
        `Comprehensive performance analysis including latency measurements, throughput benchmarks, and resource utilization statistics.`,
        `The metrics cover CPU usage, memory consumption, disk I/O, network bandwidth, and concurrent user handling capabilities.`,
        ``,
        `### Subsection ${i}.3: Security Considerations`,
        `In-depth security analysis covering authentication, authorization, data encryption, input validation, and vulnerability assessments.`,
        `This includes OWASP top 10 vulnerabilities, penetration testing results, and compliance requirements.`,
        ``,
        `\`\`\`typescript`,
        `// Advanced TypeScript implementation example ${i}`,
        `interface TechnicalComponent${i} {`,
        `  id: string;`,
        `  name: string;`,
        `  description: string;`,
        `  version: string;`,
        `  dependencies: string[];`,
        `  configuration: Record<string, unknown>;`,
        `  metadata: {`,
        `    createdAt: Date;`,
        `    updatedAt: Date;`,
        `    author: string;`,
        `    tags: string[];`,
        `  };`,
        `}`,
        ``,
        `class AdvancedProcessor${i} implements TechnicalComponent${i} {`,
        `  constructor(`,
        `    public readonly id: string,`,
        `    public readonly name: string,`,
        `    public readonly description: string,`,
        `    public readonly version: string = "1.0.0"`,
        `  ) {}`,
        `  `,
        `  async processData(input: unknown[]): Promise<ProcessedResult${i}> {`,
        `    // Complex processing logic with error handling`,
        `    const results = await Promise.allSettled(`,
        `      input.map(item => this.processItem${i}(item))`,
        `    );`,
        `    return this.aggregateResults${i}(results);`,
        `  }`,
        `}`,
        `\`\`\``,
        ``,
        `---`,
        ``
      ].join('\n'));
    }

    fs.writeFileSync(largeFilePath, largeContent + sections.join('\n'));

    // Generate small test file (~2k tokens, 8k characters)  
    // This should NOT trigger chunking (<16k token threshold)
    const smallContent = [
      '# Small Document Test File',
      '',
      'This is a small document for testing non-chunked responses.',
      'It contains minimal content that should be returned directly.',
      '',
      '## Test Section',
      'Simple paragraph with basic content for testing.',
      'Japanese: 小さなテストファイル',
      'Chinese: 小测试文件',
      'Korean: 작은 테스트 파일',
      '',
      'End of small document.'
    ].join('\n');

    fs.writeFileSync(smallFilePath, smallContent);

    console.log(`Generated test files:
- Large file: ${largeFilePath} (${fs.statSync(largeFilePath).size} bytes)
- Small file: ${smallFilePath} (${fs.statSync(smallFilePath).size} bytes)`);
  });

  afterAll(async () => {
    // Clean up test files
    if (fs.existsSync(largeFilePath)) {
      fs.unlinkSync(largeFilePath);
    }
    if (fs.existsSync(smallFilePath)) {
      fs.unlinkSync(smallFilePath);
    }

    // Clean up cache directories created during tests
    for (const cacheId of generatedCacheIds) {
      const cacheDir = path.join(cacheBaseDir, cacheId);
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
      }
    }

    // Remove base cache directory if empty
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

  describe('Large Response Chunking (ask-gemini → fetch-chunk flow)', () => {
    it.skip('should chunk large responses and enable retrieval via fetch-chunk', async () => {
      // Test large file processing that should trigger chunking
      const prompt = `[filepath: ${largeFilePath}] Please summarize this document and explain its key sections.`;
      
      const result = await askGeminiTool.execute(
        { prompt, model: 'gemini-2.5-pro', sandbox: false },
        (progress) => console.log(`Progress: ${progress}`)
      );

      // Verify chunked response format
      expect(result).toContain('isChunked');
      expect(result).toContain('cacheId');
      expect(result).toContain('totalChunks');
      expect(result).toContain('chunkNumber');

      // Parse the JSON response
      const lines = result.split('\n');
      const jsonLine = lines.find(line => line.trim().startsWith('{'));
      expect(jsonLine).toBeDefined();

      const responseData = JSON.parse(jsonLine!);
      expect(responseData.isChunked).toBe(true);
      expect(typeof responseData.cacheId).toBe('string');
      expect(typeof responseData.totalChunks).toBe('number');
      expect(responseData.chunkNumber).toBe(1);
      expect(typeof responseData.content).toBe('string');

      // Store cache ID for cleanup
      generatedCacheIds.push(responseData.cacheId);

      // Verify first chunk content exists
      expect(responseData.content.length).toBeGreaterThan(0);

      // Test fetch-chunk tool with valid cache ID
      const fetchResult = await fetchChunkTool.execute(
        { cacheId: responseData.cacheId, chunkNumber: 1 },
        (progress) => console.log(`Fetch progress: ${progress}`)
      );

      expect(fetchResult).toContain('Chunk 1 retrieved successfully');
      expect(fetchResult).toContain(responseData.cacheId);

      // If multiple chunks exist, test fetching additional chunks
      if (responseData.totalChunks > 1) {
        const chunk2Result = await fetchChunkTool.execute(
          { cacheId: responseData.cacheId, chunkNumber: 2 },
          (progress) => console.log(`Fetch chunk 2 progress: ${progress}`)
        );

        expect(chunk2Result).toContain('Chunk 2 retrieved successfully');
        expect(chunk2Result).toContain(responseData.cacheId);
      }
    }, 300000); // 5 minute timeout for large file processing

    it.skip('should return direct response for small files without chunking', async () => {
      const prompt = `[filepath: ${smallFilePath}] Please summarize this small document.`;
      
      const result = await askGeminiTool.execute(
        { prompt, model: 'gemini-2.5-pro', sandbox: false },
        (progress) => console.log(`Small file progress: ${progress}`)
      );

      // Verify direct response (not chunked)
      expect(result).toContain('Gemini response:');
      expect(result).not.toContain('isChunked');
      expect(result).not.toContain('cacheId');
      expect(result).not.toContain('totalChunks');

      // Should be a direct text response
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }, 120000); // 2 minute timeout for small file processing
  });

  describe('Error Handling', () => {
    it('should handle invalid cache ID gracefully', async () => {
      const invalidCacheId = 'invalid-uuid-12345';
      
      const result = await fetchChunkTool.execute(
        { cacheId: invalidCacheId, chunkNumber: 1 },
        (progress) => console.log(`Error test progress: ${progress}`)
      );

      expect(result).toContain('❌ Chunk retrieval');
      expect(result).toContain('Failed to retrieve chunk');
      expect(result).toContain(invalidCacheId);
    });

    it('should handle out-of-bounds chunk numbers', async () => {
      // First, create a valid cache with chunked content
      const prompt = `[filepath: ${largeFilePath}] Provide a brief overview.`;
      
      const askResult = await askGeminiTool.execute(
        { prompt, model: 'gemini-2.5-pro', sandbox: false },
        (progress) => console.log(`Setup progress: ${progress}`)
      );

      if (askResult.includes('isChunked')) {
        const lines = askResult.split('\n');
        const jsonLine = lines.find(line => line.trim().startsWith('{'));
        const responseData = JSON.parse(jsonLine!);
        
        generatedCacheIds.push(responseData.cacheId);

        // Test with chunk number 0 (invalid)
        const result0 = await fetchChunkTool.execute(
          { cacheId: responseData.cacheId, chunkNumber: 0 },
        );
        expect(result0).toContain('❌ Chunk retrieval error:');

        // Test with negative chunk number (invalid)
        const resultNegative = await fetchChunkTool.execute(
          { cacheId: responseData.cacheId, chunkNumber: -1 },
        );
        expect(resultNegative).toContain('❌ Chunk retrieval error:');

        // Test with chunk number beyond total (invalid)
        const resultBeyond = await fetchChunkTool.execute(
          { cacheId: responseData.cacheId, chunkNumber: responseData.totalChunks + 1 },
        );
        expect(resultBeyond).toContain('❌ Chunk retrieval failed:');
      }
    }, 300000);
  });

  describe('Security Tests', () => {
    it('should prevent path traversal attacks in cache ID', async () => {
      // Test various path traversal attempts
      const maliciousCacheIds = [
        '../../../etc/passwd',
        '../../../../etc/hosts',
        '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '/etc/passwd',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
        '../cache/../../sensitive-file',
      ];

      for (const maliciousId of maliciousCacheIds) {
        const result = await fetchChunkTool.execute(
          { cacheId: maliciousId, chunkNumber: 1 },
          (progress) => console.log(`Security test progress: ${progress}`)
        );

        // Should return error, not attempt to access files outside cache directory
        expect(result).toContain('❌ Chunk retrieval error:');
        expect(result).toContain('Invalid cache key format');
      }
    });

    it('should handle extremely large chunk numbers without crashing', async () => {
      const validCacheId = 'test-cache-id-12345';
      const extremeChunkNumber = Number.MAX_SAFE_INTEGER;
      
      const result = await fetchChunkTool.execute(
        { cacheId: validCacheId, chunkNumber: extremeChunkNumber },
      );

      expect(result).toContain('❌ Chunk retrieval');
      expect(result).toContain('Failed to retrieve chunk');
    });
  });

  describe('Multilingual and Unicode Support', () => {
    it('should handle multilingual content in chunking', async () => {
      // Create a multilingual test file
      const multilingualContent = [
        '# 多言語文書テスト / Multilingual Document Test / 多语言文档测试',
        '',
        'English: This document tests multilingual support in the chunking system.',
        'Japanese: この文書はチャンキングシステムの多言語サポートをテストします。',
        'Chinese: 这个文档测试分块系统中的多语言支持。',
        'Korean: 이 문서는 청킹 시스템의 다국어 지원을 테스트합니다。',
        'Emoji test: 🚀🌟✨🎉🔥💫🌈🎯',
        '',
      ].join('\n');

      // Repeat to ensure chunking is triggered
      const largeMultilingualContent = Array(200).fill(multilingualContent).join('\n');
      const multilingualFilePath = path.join(fixturesDir, 'multilingual-test.txt');
      
      fs.writeFileSync(multilingualFilePath, largeMultilingualContent);

      try {
        const prompt = `[filepath: ${multilingualFilePath}] Analyze this multilingual document.`;
        
        const result = await askGeminiTool.execute(
          { prompt, model: 'gemini-2.5-pro', sandbox: false },
          (progress) => console.log(`Multilingual test progress: ${progress}`)
        );

        // Should handle multilingual content without corrupting characters
        if (result.includes('isChunked')) {
          const lines = result.split('\n');
          const jsonLine = lines.find(line => line.trim().startsWith('{'));
          const responseData = JSON.parse(jsonLine!);
          
          generatedCacheIds.push(responseData.cacheId);

          // Verify that content doesn't contain broken Unicode
          expect(responseData.content).not.toContain('�'); // Replacement character
          expect(responseData.content.length).toBeGreaterThan(0);

          // Test fetching chunks to ensure no character corruption
          const fetchResult = await fetchChunkTool.execute(
            { cacheId: responseData.cacheId, chunkNumber: 1 },
          );

          expect(fetchResult).toContain('Chunk 1 retrieved successfully');
          expect(fetchResult).not.toContain('�'); // No broken Unicode
        }
      } finally {
        // Clean up multilingual test file
        if (fs.existsSync(multilingualFilePath)) {
          fs.unlinkSync(multilingualFilePath);
        }
      }
    }, 300000);
  });
});