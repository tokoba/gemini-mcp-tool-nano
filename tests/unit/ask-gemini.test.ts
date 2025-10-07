/**
 * Unit tests for ask-gemini.tool.ts
 * エラーパス・チャンキング・プログレス・検証の包括的テスト
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { askGeminiTool } from '../../src/tools/ask-gemini.tool.js';
import { ERROR_MESSAGES, STATUS_MESSAGES, CHUNKING } from '../../src/constants.js';
import { executeGeminiCLI } from '../../src/utils/geminiExecutor.js';
import { countTokens } from '../../src/utils/tokenizer.js';
import { chunkText } from '../../src/utils/chunker.js';
import { saveChunks } from '../../src/utils/chunkCache.js';

// モック設定
jest.mock('../../src/utils/geminiExecutor.js');
jest.mock('../../src/utils/tokenizer.js');
jest.mock('../../src/utils/chunker.js');
jest.mock('../../src/utils/chunkCache.js');

const mockExecuteGeminiCLI = executeGeminiCLI as jest.MockedFunction<typeof executeGeminiCLI>;
const mockCountTokens = countTokens as jest.MockedFunction<typeof countTokens>;
const mockChunkText = chunkText as jest.MockedFunction<typeof chunkText>;
const mockSaveChunks = saveChunks as jest.MockedFunction<typeof saveChunks>;

describe('askGeminiTool', () => {
  let mockProgressCallback: jest.MockedFunction<(newOutput: string) => void>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProgressCallback = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('Tool Definition', () => {
    it('should have correct tool metadata', () => {
      expect(askGeminiTool.name).toBe('ask');
      expect(askGeminiTool.description).toBe('model selection [-m], sandbox [-s] for Gemini AI responses');
      expect(askGeminiTool.category).toBe('gemini');
      expect(askGeminiTool.zodSchema).toBeDefined();
      expect(askGeminiTool.prompt).toBeDefined();
    });

    it('should validate schema with required prompt', () => {
      const validArgs = { prompt: 'test prompt' };
      const result = askGeminiTool.zodSchema.safeParse(validArgs);
      expect(result.success).toBe(true);
    });

    it('should apply default values for optional parameters', () => {
      const args = { prompt: 'test prompt' };
      const parsed = askGeminiTool.zodSchema.parse(args);
      expect(parsed.model).toBe('gemini-2.5-pro');
      expect(parsed.sandbox).toBe(false);
    });

    it('should reject empty prompt', () => {
      const invalidArgs = { prompt: '' };
      const result = askGeminiTool.zodSchema.safeParse(invalidArgs);
      expect(result.success).toBe(false);
    });
  });

  describe('Input Validation', () => {
    it('should throw error for empty prompt after trimming', async () => {
      const args = { prompt: '   ', model: 'gemini-2.5-pro', sandbox: false };
      
      await expect(askGeminiTool.execute(args, mockProgressCallback))
        .rejects
        .toThrow(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    });

    it('should throw error for undefined prompt', async () => {
      const args = { prompt: undefined as any, model: 'gemini-2.5-pro', sandbox: false };
      
      await expect(askGeminiTool.execute(args, mockProgressCallback))
        .rejects
        .toThrow(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    });

    it('should throw error for null prompt', async () => {
      const args = { prompt: null as any, model: 'gemini-2.5-pro', sandbox: false };
      
      await expect(askGeminiTool.execute(args, mockProgressCallback))
        .rejects
        .toThrow(ERROR_MESSAGES.NO_PROMPT_PROVIDED);
    });
  });

  describe('Small Response Handling (No Chunking)', () => {
    it('should return direct response for small token count', async () => {
      const mockResponse = 'Short response from Gemini';
      const smallTokenCount = CHUNKING.TOKEN_THRESHOLD - 100;
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockReturnValueOnce(smallTokenCount);

      const args = { prompt: 'Simple question?', model: 'gemini-2.5-pro', sandbox: false };
      const result = await askGeminiTool.execute(args, mockProgressCallback);

      expect(mockExecuteGeminiCLI).toHaveBeenCalledWith(
        'Simple question?',
        'gemini-2.5-pro',
        false,
        mockProgressCallback
      );
      expect(mockCountTokens).toHaveBeenCalledWith(mockResponse);
      expect(mockChunkText).not.toHaveBeenCalled();
      expect(mockSaveChunks).not.toHaveBeenCalled();
      expect(result).toBe(`${STATUS_MESSAGES.GEMINI_RESPONSE}\n${mockResponse}`);
    });

    it('should handle exact token threshold boundary', async () => {
      const mockResponse = 'Response at exact threshold';
      const exactTokenCount = CHUNKING.TOKEN_THRESHOLD;
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockReturnValueOnce(exactTokenCount);

      const args = { prompt: 'Boundary test', model: 'gemini-2.5-flash', sandbox: true };
      const result = await askGeminiTool.execute(args, mockProgressCallback);

      expect(mockExecuteGeminiCLI).toHaveBeenCalledWith(
        'Boundary test',
        'gemini-2.5-flash',
        true,
        mockProgressCallback
      );
      expect(result).toBe(`${STATUS_MESSAGES.GEMINI_RESPONSE}\n${mockResponse}`);
      expect(mockChunkText).not.toHaveBeenCalled();
    });
  });

  describe('Large Response Handling (Chunking)', () => {
    it('should handle large response with chunking and progress callback', async () => {
      const mockResponse = 'Very long response that needs chunking...'.repeat(1000);
      const largeTokenCount = CHUNKING.TOKEN_THRESHOLD + 5000;
      const mockChunks = ['Chunk 1 content', 'Chunk 2 content', 'Chunk 3 content'];
      const mockCacheResult = {
        cacheKey: 'test-cache-id-12345',
        chunkCount: 3,
        success: true
      };
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockReturnValueOnce(largeTokenCount);
      mockChunkText.mockReturnValueOnce(mockChunks);
      mockSaveChunks.mockResolvedValueOnce(mockCacheResult);

      const args = { prompt: 'Complex analysis request', model: 'gemini-2.5-pro', sandbox: false };
      const result = await askGeminiTool.execute(args, mockProgressCallback);

      // 検証: executeGeminiCLIが正しく呼ばれた
      expect(mockExecuteGeminiCLI).toHaveBeenCalledWith(
        'Complex analysis request',
        'gemini-2.5-pro',
        false,
        mockProgressCallback
      );

      // 検証: プログレスコールバックが呼ばれた
      expect(mockProgressCallback).toHaveBeenCalledWith('Large response detected. Processing chunks...');

      // 検証: チャンキング処理が正しく呼ばれた
      expect(mockCountTokens).toHaveBeenCalledWith(mockResponse);
      expect(mockChunkText).toHaveBeenCalledWith(mockResponse, {
        maxTokens: CHUNKING.MAX_TOKENS_PER_CHUNK,
        preserveStructure: true
      });
      expect(mockSaveChunks).toHaveBeenCalledWith(mockChunks, { totalTokens: largeTokenCount });

      // 検証: 構造化された応答が返された
      expect(result).toContain(STATUS_MESSAGES.GEMINI_RESPONSE);
      expect(result).toContain('isChunked');
      expect(result).toContain('test-cache-id-12345');
      expect(result).toContain('Use the fetch-chunk tool');
      expect(result).toContain('(2-3)');
      
      // 検証: JSON構造
      const jsonMatch = result.match(/\{[\s\S]*?\}/);
      expect(jsonMatch).toBeTruthy();
      if (jsonMatch) {
        const responseObj = JSON.parse(jsonMatch[0]);
        expect(responseObj).toEqual({
          isChunked: true,
          cacheId: 'test-cache-id-12345',
          totalChunks: 3,
          chunkNumber: 1,
          content: 'Chunk 1 content'
        });
      }
    });

    it('should handle chunking without progress callback', async () => {
      const mockResponse = 'Large response without progress callback';
      const largeTokenCount = CHUNKING.TOKEN_THRESHOLD + 1;
      const mockChunks = ['Single chunk'];
      const mockCacheResult = {
        cacheKey: 'cache-no-progress',
        chunkCount: 1,
        success: true
      };
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockReturnValueOnce(largeTokenCount);
      mockChunkText.mockReturnValueOnce(mockChunks);
      mockSaveChunks.mockResolvedValueOnce(mockCacheResult);

      const args = { prompt: 'No progress test', model: 'gemini-2.5-pro', sandbox: false };
      const result = await askGeminiTool.execute(args); // progressCallbackなし

      expect(mockChunkText).toHaveBeenCalled();
      expect(mockSaveChunks).toHaveBeenCalled();
      expect(result).toContain('isChunked');
      expect(result).toContain('cache-no-progress');
    });
  });

  describe('Error Handling', () => {
    it('should propagate executeGeminiCLI errors', async () => {
      const geminiError = new Error('Gemini CLI execution failed');
      mockExecuteGeminiCLI.mockRejectedValueOnce(geminiError);

      const args = { prompt: 'Valid prompt', model: 'gemini-2.5-pro', sandbox: false };
      
      await expect(askGeminiTool.execute(args, mockProgressCallback))
        .rejects
        .toThrow('Gemini CLI execution failed');
    });

    it('should propagate tokenizer errors', async () => {
      const mockResponse = 'Valid response';
      const tokenizerError = new Error('Token counting failed');
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockImplementationOnce(() => {
        throw tokenizerError;
      });

      const args = { prompt: 'Valid prompt', model: 'gemini-2.5-pro', sandbox: false };
      
      await expect(askGeminiTool.execute(args, mockProgressCallback))
        .rejects
        .toThrow('Token counting failed');
    });

    it('should propagate chunker errors', async () => {
      const mockResponse = 'Large response';
      const largeTokenCount = CHUNKING.TOKEN_THRESHOLD + 1000;
      const chunkerError = new Error('Chunking failed');
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockReturnValueOnce(largeTokenCount);
      mockChunkText.mockImplementationOnce(() => {
        throw chunkerError;
      });

      const args = { prompt: 'Valid prompt', model: 'gemini-2.5-pro', sandbox: false };
      
      await expect(askGeminiTool.execute(args, mockProgressCallback))
        .rejects
        .toThrow('Chunking failed');
    });

    it('should propagate cache save errors', async () => {
      const mockResponse = 'Large response';
      const largeTokenCount = CHUNKING.TOKEN_THRESHOLD + 1000;
      const mockChunks = ['Chunk 1'];
      const cacheError = new Error('Cache save failed');
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockReturnValueOnce(largeTokenCount);
      mockChunkText.mockReturnValueOnce(mockChunks);
      mockSaveChunks.mockRejectedValueOnce(cacheError);

      const args = { prompt: 'Valid prompt', model: 'gemini-2.5-pro', sandbox: false };
      
      await expect(askGeminiTool.execute(args, mockProgressCallback))
        .rejects
        .toThrow('Cache save failed');
    });
  });

  describe('Parameter Handling', () => {
    it('should handle all parameter combinations', async () => {
      const mockResponse = 'Test response';
      const smallTokenCount = 1000;
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockReturnValueOnce(smallTokenCount);

      const args = {
        prompt: 'Test with all params',
        model: 'gemini-2.5-flash',
        sandbox: true
      };
      
      await askGeminiTool.execute(args, mockProgressCallback);

      expect(mockExecuteGeminiCLI).toHaveBeenCalledWith(
        'Test with all params',
        'gemini-2.5-flash',
        true,
        mockProgressCallback
      );
    });

    it('should handle undefined model parameter', async () => {
      const mockResponse = 'Test response';
      const smallTokenCount = 1000;
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockReturnValueOnce(smallTokenCount);

      const args = {
        prompt: 'Test with undefined model',
        model: undefined,
        sandbox: false
      };
      
      await askGeminiTool.execute(args, mockProgressCallback);

      expect(mockExecuteGeminiCLI).toHaveBeenCalledWith(
        'Test with undefined model',
        undefined,
        false,
        mockProgressCallback
      );
    });

    it('should convert sandbox parameter to boolean correctly', async () => {
      const mockResponse = 'Test response';
      const smallTokenCount = 1000;
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockReturnValueOnce(smallTokenCount);

      // Test truthy value conversion
      const args = {
        prompt: 'Test boolean conversion',
        model: 'gemini-2.5-pro',
        sandbox: 'true' as any // 文字列を渡してもbooleanに変換されることをテスト
      };
      
      await askGeminiTool.execute(args, mockProgressCallback);

      expect(mockExecuteGeminiCLI).toHaveBeenCalledWith(
        'Test boolean conversion',
        'gemini-2.5-pro',
        true, // !!sandbox の結果
        mockProgressCallback
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string response from Gemini', async () => {
      const emptyResponse = '';
      const zeroTokenCount = 0;
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(emptyResponse);
      mockCountTokens.mockReturnValueOnce(zeroTokenCount);

      const args = { prompt: 'Valid prompt', model: 'gemini-2.5-pro', sandbox: false };
      const result = await askGeminiTool.execute(args, mockProgressCallback);

      expect(result).toBe(`${STATUS_MESSAGES.GEMINI_RESPONSE}\n`);
    });

    it('should handle very large token count', async () => {
      const mockResponse = 'Extremely large response';
      const veryLargeTokenCount = CHUNKING.TOKEN_THRESHOLD * 10;
      const mockChunks = Array.from({ length: 50 }, (_, i) => `Chunk ${i + 1}`);
      const mockCacheResult = {
        cacheKey: 'very-large-cache',
        chunkCount: 50,
        success: true
      };
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockReturnValueOnce(veryLargeTokenCount);
      mockChunkText.mockReturnValueOnce(mockChunks);
      mockSaveChunks.mockResolvedValueOnce(mockCacheResult);

      const args = { prompt: 'Very large request', model: 'gemini-2.5-pro', sandbox: false };
      const result = await askGeminiTool.execute(args, mockProgressCallback);

      expect(result).toContain('(2-50)');
      expect(result).toContain(`${veryLargeTokenCount} tokens`);
    });

    it('should handle single chunk result', async () => {
      const mockResponse = 'Just over threshold response';
      const justOverTokenCount = CHUNKING.TOKEN_THRESHOLD + 1;
      const mockChunks = ['Single chunk only'];
      const mockCacheResult = {
        cacheKey: 'single-chunk-cache',
        chunkCount: 1,
        success: true
      };
      
      mockExecuteGeminiCLI.mockResolvedValueOnce(mockResponse);
      mockCountTokens.mockReturnValueOnce(justOverTokenCount);
      mockChunkText.mockReturnValueOnce(mockChunks);
      mockSaveChunks.mockResolvedValueOnce(mockCacheResult);

      const args = { prompt: 'Single chunk test', model: 'gemini-2.5-pro', sandbox: false };
      const result = await askGeminiTool.execute(args, mockProgressCallback);

      expect(result).toContain('(2-1)'); // Edge case: range shows 2-1
      expect(result).toContain('Single chunk only');
    });
  });
});