/**
 * 構造化エラー分類システムのテスト
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  ErrorClassifier,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  hasClassification,
  getUserMessage,
  getRecoveryStrategy,
  type ClassifiedError
} from '../../src/utils/errorClassification.js';
import { Logger } from '../../src/utils/logger.js';

// Logger をモック化
jest.mock('../../src/utils/logger.js', () => ({
  Logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ErrorClassifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('classify', () => {
    it('should classify validation errors correctly', () => {
      const error = new Error('invalid arguments for tool');
      const result = ErrorClassifier.classify(error);

      expect(result.category).toBe(ErrorCategory.VALIDATION);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.recovery).toBe(RecoveryStrategy.USER_ACTION);
      expect(result.code).toBe('VALIDATION_001');
      expect(result.originalError).toBe(error);
    });

    it('should classify command execution errors correctly', () => {
      const error = new Error('failed to spawn command: gemini not found');
      const result = ErrorClassifier.classify(error);

      expect(result.category).toBe(ErrorCategory.COMMAND_EXECUTION);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.recovery).toBe(RecoveryStrategy.RETRY);
      expect(result.code).toBe('COMMAND_001');
    });

    it('should classify file system errors correctly', () => {
      const error = new Error('ENOENT: no such file or directory');
      const result = ErrorClassifier.classify(error);

      expect(result.category).toBe(ErrorCategory.FILE_SYSTEM);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.recovery).toBe(RecoveryStrategy.USER_ACTION);
      expect(result.code).toBe('FS_001');
    });

    it('should classify network errors correctly', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const result = ErrorClassifier.classify(error);

      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.recovery).toBe(RecoveryStrategy.RETRY);
      expect(result.code).toBe('NETWORK_001');
    });

    it('should classify cache errors correctly', () => {
      const error = new Error('cache expired: TTL expired at 2023-10-07');
      const result = ErrorClassifier.classify(error);

      expect(result.category).toBe(ErrorCategory.CACHE);
      expect(result.severity).toBe(ErrorSeverity.WARNING);
      expect(result.recovery).toBe(RecoveryStrategy.FALLBACK);
      expect(result.code).toBe('CACHE_001');
    });

    it('should classify quota errors correctly', () => {
      const error = new Error('quota exceeded for Gemini 2.5 Pro');
      const result = ErrorClassifier.classify(error);

      expect(result.category).toBe(ErrorCategory.QUOTA);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.recovery).toBe(RecoveryStrategy.FALLBACK);
      expect(result.code).toBe('QUOTA_001');
    });

    it('should classify timeout errors correctly', () => {
      const error = new Error('operation timed out after 30s');
      const result = ErrorClassifier.classify(error);

      expect(result.category).toBe(ErrorCategory.TIMEOUT);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.recovery).toBe(RecoveryStrategy.RETRY);
      expect(result.code).toBe('TIMEOUT_001');
    });

    it('should classify protocol errors correctly', () => {
      const error = new Error('unknown tool: invalid-tool');
      const result = ErrorClassifier.classify(error);

      expect(result.category).toBe(ErrorCategory.PROTOCOL);
      expect(result.severity).toBe(ErrorSeverity.ERROR);
      expect(result.recovery).toBe(RecoveryStrategy.USER_ACTION);
      expect(result.code).toBe('PROTOCOL_001');
    });

    it('should classify unknown errors as internal errors', () => {
      const error = new Error('some unknown error message');
      const result = ErrorClassifier.classify(error);

      expect(result.category).toBe(ErrorCategory.INTERNAL);
      expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      expect(result.recovery).toBe(RecoveryStrategy.NONE);
      expect(result.code).toBe('INTERNAL_001');
    });

    it('should handle string errors', () => {
      const result = ErrorClassifier.classify('invalid arguments provided');

      expect(result.category).toBe(ErrorCategory.VALIDATION);
      expect(result.originalError).toBeUndefined();
    });

    it('should include context information', () => {
      const context = { toolName: 'ask-gemini', userId: '123' };
      const result = ErrorClassifier.classify('some error', context);

      expect(result.context).toEqual(context);
    });

    it('should provide user-friendly messages', () => {
      const result = ErrorClassifier.classify('invalid arguments for tool');

      expect(result.userMessage).toContain('入力データに問題があります');
      expect(result.devMessage).toContain('Validation failed');
    });

    it('should provide suggestions for error resolution', () => {
      const result = ErrorClassifier.classify('invalid arguments for tool');

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions?.length).toBeGreaterThan(0);
      expect(result.suggestions?.[0]).toContain('入力パラメータ');
    });
  });

  describe('logError', () => {
    it('should log info level errors correctly', () => {
      const classifiedError: ClassifiedError = {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.INFO,
        recovery: RecoveryStrategy.USER_ACTION,
        code: 'TEST_001',
        userMessage: 'Test user message',
        devMessage: 'Test dev message',
        context: { test: 'data' }
      };

      ErrorClassifier.logError(classifiedError);

      expect(Logger.log).toHaveBeenCalledWith(
        '[validation:TEST_001] Test dev message',
        { context: { test: 'data' } }
      );
    });

    it('should log warning level errors correctly', () => {
      const classifiedError: ClassifiedError = {
        category: ErrorCategory.CACHE,
        severity: ErrorSeverity.WARNING,
        recovery: RecoveryStrategy.FALLBACK,
        code: 'CACHE_001',
        userMessage: 'Cache warning',
        devMessage: 'Cache operation warning'
      };

      ErrorClassifier.logError(classifiedError);

      expect(Logger.warn).toHaveBeenCalledWith(
        '[cache:CACHE_001] Cache operation warning',
        { context: undefined }
      );
    });

    it('should log error level errors correctly', () => {
      const classifiedError: ClassifiedError = {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.ERROR,
        recovery: RecoveryStrategy.RETRY,
        code: 'NETWORK_001',
        userMessage: 'Network error',
        devMessage: 'Network connection failed'
      };

      ErrorClassifier.logError(classifiedError);

      expect(Logger.error).toHaveBeenCalledWith(
        '[network:NETWORK_001] Network connection failed',
        { context: undefined }
      );
    });

    it('should log critical level errors with special formatting', () => {
      const classifiedError: ClassifiedError = {
        category: ErrorCategory.INTERNAL,
        severity: ErrorSeverity.CRITICAL,
        recovery: RecoveryStrategy.NONE,
        code: 'INTERNAL_001',
        userMessage: 'Critical error',
        devMessage: 'System failure',
        suggestions: ['Restart system', 'Contact support']
      };

      ErrorClassifier.logError(classifiedError);

      expect(Logger.error).toHaveBeenCalledWith(
        '🚨 CRITICAL: [internal:INTERNAL_001] System failure',
        {
          context: undefined,
          suggestions: ['Restart system', 'Contact support']
        }
      );
    });
  });

  describe('handleError', () => {
    it('should classify, log, and throw enhanced error', () => {
      const originalError = new Error('invalid arguments provided');

      expect(() => {
        ErrorClassifier.handleError(originalError);
      }).toThrow();

      // Logger が呼ばれたことを確認
      expect(Logger.error).toHaveBeenCalled();
    });

    it('should throw error with classification attached', () => {
      const originalError = new Error('invalid arguments provided');

      try {
        ErrorClassifier.handleError(originalError);
      } catch (error) {
        expect(hasClassification(error)).toBe(true);
        expect((error as any).classification.category).toBe(ErrorCategory.VALIDATION);
      }
    });

    it('should include context in classification', () => {
      const context = { toolName: 'test-tool' };

      try {
        ErrorClassifier.handleError('some error', context);
      } catch (error) {
        expect(hasClassification(error)).toBe(true);
        expect((error as any).classification.context).toEqual(context);
      }
    });
  });

  describe('pattern matching edge cases', () => {
    it('should handle mixed case error messages', () => {
      const result = ErrorClassifier.classify('INVALID ARGUMENTS FOR TOOL');
      expect(result.category).toBe(ErrorCategory.VALIDATION);
    });

    it('should handle partial pattern matches', () => {
      const result = ErrorClassifier.classify('Command execution failed due to timeout');
      expect(result.category).toBe(ErrorCategory.COMMAND_EXECUTION);
    });

    it('should handle multiple pattern matches (first match wins)', () => {
      const result = ErrorClassifier.classify('Failed to spawn command: timeout occurred');
      // Should match command execution first
      expect(result.category).toBe(ErrorCategory.COMMAND_EXECUTION);
    });
  });

  describe('getErrorStats', () => {
    it('should return empty stats object (placeholder)', () => {
      const stats = ErrorClassifier.getErrorStats();
      expect(stats).toEqual({});
    });
  });
});

describe('utility functions', () => {
  describe('hasClassification', () => {
    it('should return true for errors with classification', () => {
      const error = new Error('test') as Error & { classification: ClassifiedError };
      error.classification = {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.ERROR,
        recovery: RecoveryStrategy.USER_ACTION,
        code: 'TEST_001',
        userMessage: 'Test',
        devMessage: 'Test'
      };

      expect(hasClassification(error)).toBe(true);
    });

    it('should return false for errors without classification', () => {
      const error = new Error('test');
      expect(hasClassification(error)).toBe(false);
    });

    it('should return false for non-Error objects', () => {
      expect(hasClassification('string')).toBe(false);
      expect(hasClassification(null)).toBe(false);
      expect(hasClassification(undefined)).toBe(false);
      expect(hasClassification({})).toBe(false);
    });
  });

  describe('getUserMessage', () => {
    it('should return classification user message if available', () => {
      const error = new Error('test') as Error & { classification: ClassifiedError };
      error.classification = {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.ERROR,
        recovery: RecoveryStrategy.USER_ACTION,
        code: 'TEST_001',
        userMessage: 'Custom user message',
        devMessage: 'Test'
      };

      expect(getUserMessage(error)).toBe('Custom user message');
    });

    it('should classify error and return user message if no classification', () => {
      const error = new Error('invalid arguments provided');
      const message = getUserMessage(error);

      expect(message).toContain('入力データに問題があります');
    });

    it('should return default message for non-Error objects', () => {
      expect(getUserMessage('string')).toBe('予期しないエラーが発生しました。');
      expect(getUserMessage(null)).toBe('予期しないエラーが発生しました。');
    });
  });

  describe('getRecoveryStrategy', () => {
    it('should return classification recovery strategy if available', () => {
      const error = new Error('test') as Error & { classification: ClassifiedError };
      error.classification = {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.ERROR,
        recovery: RecoveryStrategy.RETRY,
        code: 'TEST_001',
        userMessage: 'Test',
        devMessage: 'Test'
      };

      expect(getRecoveryStrategy(error)).toBe(RecoveryStrategy.RETRY);
    });

    it('should classify error and return recovery strategy if no classification', () => {
      const error = new Error('command failed with exit code 1');
      const strategy = getRecoveryStrategy(error);

      expect(strategy).toBe(RecoveryStrategy.RETRY);
    });

    it('should return NONE for non-Error objects', () => {
      expect(getRecoveryStrategy('string')).toBe(RecoveryStrategy.NONE);
      expect(getRecoveryStrategy(null)).toBe(RecoveryStrategy.NONE);
    });
  });
});

describe('real-world error scenarios', () => {
  it('should handle chunkCache specific errors', () => {
    const errors = [
      'Invalid cache key format',
      'Cache expired: TTL expired at 2023-10-07T10:00:00.000Z',
      'Cache not found: directory or metadata file does not exist',
      'Failed to save chunks after retries',
      'Cannot save empty chunks array'
    ];

    errors.forEach(errorMessage => {
      const result = ErrorClassifier.classify(errorMessage);
      expect(result.category).toBe(ErrorCategory.CACHE);
    });
  });

  it('should handle geminiExecutor specific errors', () => {
    const errors = [
      'Failed to spawn command: gemini not found',
      'Command failed with exit code 1: Permission denied',
      'Quota exceeded for quota metric Gemini 2.5 Pro Requests'
    ];

    const expectedCategories = [
      ErrorCategory.COMMAND_EXECUTION,
      ErrorCategory.COMMAND_EXECUTION,
      ErrorCategory.QUOTA
    ];

    errors.forEach((errorMessage, index) => {
      const result = ErrorClassifier.classify(errorMessage);
      expect(result.category).toBe(expectedCategories[index]);
    });
  });

  it('should handle registry specific errors', () => {
    const errors = [
      'Unknown tool: non-existent-tool',        // PROTOCOL
      'Invalid arguments for ask-gemini: prompt is required',  // VALIDATION  
      'No prompt defined for tool: test-tool',  // PROTOCOL
      'not found in registry'                   // PROTOCOL
    ];

    const expectedCategories = [
      ErrorCategory.PROTOCOL,
      ErrorCategory.VALIDATION,
      ErrorCategory.PROTOCOL,
      ErrorCategory.PROTOCOL
    ];

    errors.forEach((errorMessage, index) => {
      const result = ErrorClassifier.classify(errorMessage);
      expect(result.category).toBe(expectedCategories[index]);
    });
  });

  it('should handle filepath validation errors', () => {
    const errors = [
      'Content must be a string',
      'Invalid path detected',
      'Chunk index must be 1 or greater'
    ];

    errors.forEach(errorMessage => {
      const result = ErrorClassifier.classify(errorMessage);
      expect(result.category).toBe(ErrorCategory.VALIDATION);
    });
  });
});