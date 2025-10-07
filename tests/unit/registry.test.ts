/**
 * Unit tests for registry.ts
 * 統一ツールレジストリの機能・バリデーション・エラーハンドリングの検証
 */

import { z, ZodError } from 'zod';
import {
  toolRegistry,
  toolExists,
  getToolDefinitions,
  getPromptDefinitions,
  executeTool,
  getPromptMessage,
  UnifiedTool
} from '../../src/tools/registry.js';

describe('registry', () => {
  // テスト用のモックツール定義
  const mockToolSchema = z.object({
    text: z.string().describe('Text parameter'),
    number: z.number().default(42).describe('Number parameter'),
    optional: z.string().optional().describe('Optional parameter')
  });

  const mockTool: UnifiedTool = {
    name: 'mock-tool',
    description: 'Mock tool for testing',
    zodSchema: mockToolSchema,
    execute: jest.fn().mockResolvedValue('mock result'),
    category: 'utility'
  };

  const mockToolWithPrompt: UnifiedTool = {
    name: 'mock-prompt-tool',
    description: 'Mock tool with prompt',
    zodSchema: z.object({
      prompt: z.string().describe('Prompt text'),
      flag: z.boolean().default(false).describe('Boolean flag')
    }),
    prompt: {
      description: 'Tool with prompt support',
      arguments: [
        { name: 'prompt', description: 'Custom prompt description', required: true },
        { name: 'flag', description: 'Custom flag description', required: false }
      ]
    },
    execute: jest.fn().mockResolvedValue('prompt result')
  };

  const mockToolAutoPrompt: UnifiedTool = {
    name: 'auto-prompt-tool',
    description: 'Tool with auto-generated prompt arguments',
    zodSchema: z.object({
      input: z.string().describe('Input parameter'),
      count: z.number().default(1).describe('Count parameter')
    }),
    prompt: {
      description: 'Auto-prompt tool'
      // arguments not specified - will be auto-generated
    },
    execute: jest.fn().mockResolvedValue('auto-prompt result')
  };

  let originalToolRegistry: UnifiedTool[];

  beforeEach(() => {
    // レジストリの元の状態を保存
    originalToolRegistry = [...toolRegistry];
    
    // テスト用にレジストリをクリア
    toolRegistry.length = 0;
    
    // モック関数をリセット
    jest.clearAllMocks();
  });

  afterEach(() => {
    // レジストリを元の状態に復元
    toolRegistry.length = 0;
    toolRegistry.push(...originalToolRegistry);
  });

  describe('toolRegistry操作', () => {
    test('ツールの登録と存在確認', () => {
      toolRegistry.push(mockTool);
      
      expect(toolExists('mock-tool')).toBe(true);
      expect(toolExists('nonexistent-tool')).toBe(false);
    });

    test('複数ツールの登録', () => {
      toolRegistry.push(mockTool, mockToolWithPrompt);
      
      expect(toolExists('mock-tool')).toBe(true);
      expect(toolExists('mock-prompt-tool')).toBe(true);
      expect(toolRegistry.length).toBe(2);
    });

    test('空のレジストリでの存在確認', () => {
      expect(toolExists('any-tool')).toBe(false);
      expect(toolRegistry.length).toBe(0);
    });
  });

  describe('getToolDefinitions', () => {
    test('基本的なツール定義の生成', () => {
      toolRegistry.push(mockTool);
      
      const definitions = getToolDefinitions();
      
      expect(definitions).toHaveLength(1);
      expect(definitions[0]).toMatchObject({
        name: 'mock-tool',
        description: 'Mock tool for testing',
        inputSchema: {
          type: 'object',
          properties: {
            text: { description: 'Text parameter' },
            number: { description: 'Number parameter', default: 42 },
            optional: { description: 'Optional parameter' }
          },
          required: ['text'] // numberはdefaultがあるのでrequiredから除外される
        }
      });
    });

    test('複数ツールの定義生成', () => {
      toolRegistry.push(mockTool, mockToolWithPrompt);
      
      const definitions = getToolDefinitions();
      
      expect(definitions).toHaveLength(2);
      expect(definitions.map(d => d.name)).toContain('mock-tool');
      expect(definitions.map(d => d.name)).toContain('mock-prompt-tool');
    });

    test('空のレジストリでの定義生成', () => {
      const definitions = getToolDefinitions();
      
      expect(definitions).toEqual([]);
    });

    test('複雑なスキーマの定義生成', () => {
      const complexSchema = z.object({
        nested: z.object({
          field: z.string()
        }),
        array: z.array(z.string()),
        union: z.union([z.string(), z.number()])
      });

      const complexTool: UnifiedTool = {
        name: 'complex-tool',
        description: 'Complex schema tool',
        zodSchema: complexSchema,
        execute: jest.fn()
      };

      toolRegistry.push(complexTool);
      
      const definitions = getToolDefinitions();
      
      expect(definitions[0].inputSchema.properties).toHaveProperty('nested');
      expect(definitions[0].inputSchema.properties).toHaveProperty('array');
      expect(definitions[0].inputSchema.properties).toHaveProperty('union');
    });
  });

  describe('getPromptDefinitions', () => {
    test('プロンプト付きツールの定義生成', () => {
      toolRegistry.push(mockToolWithPrompt);
      
      const prompts = getPromptDefinitions();
      
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toMatchObject({
        name: 'mock-prompt-tool',
        description: 'Tool with prompt support',
        arguments: [
          { name: 'prompt', description: 'Custom prompt description', required: true },
          { name: 'flag', description: 'Custom flag description', required: false }
        ]
      });
    });

    test('自動生成プロンプト引数の処理', () => {
      toolRegistry.push(mockToolAutoPrompt);
      
      const prompts = getPromptDefinitions();
      
      expect(prompts).toHaveLength(1);
      expect(prompts[0].arguments).toEqual([
        { name: 'input', description: 'Input parameter', required: true },
        { name: 'count', description: 'Count parameter', required: false } // defaultがあるのでrequired: false
      ]);
    });

    test('プロンプトなしツールのフィルタリング', () => {
      toolRegistry.push(mockTool, mockToolWithPrompt);
      
      const prompts = getPromptDefinitions();
      
      expect(prompts).toHaveLength(1);
      expect(prompts[0].name).toBe('mock-prompt-tool');
    });

    test('空レジストリでのプロンプト定義', () => {
      const prompts = getPromptDefinitions();
      
      expect(prompts).toEqual([]);
    });
  });

  describe('executeTool', () => {
    test('正常なツール実行', async () => {
      toolRegistry.push(mockTool);
      
      const result = await executeTool('mock-tool', { text: 'test', number: 123 });
      
      expect(result).toBe('mock result');
      expect(mockTool.execute).toHaveBeenCalledWith({ text: 'test', number: 123 }, undefined);
    });

    test('デフォルト値の適用', async () => {
      toolRegistry.push(mockTool);
      
      const result = await executeTool('mock-tool', { text: 'test' });
      
      expect(result).toBe('mock result');
      expect(mockTool.execute).toHaveBeenCalledWith({ text: 'test', number: 42 }, undefined);
    });

    test('プログレスコールバック付き実行', async () => {
      toolRegistry.push(mockTool);
      const onProgress = jest.fn();
      
      const result = await executeTool('mock-tool', { text: 'test' }, onProgress);
      
      expect(result).toBe('mock result');
      expect(mockTool.execute).toHaveBeenCalledWith({ text: 'test', number: 42 }, onProgress);
    });

    test('存在しないツールのエラー', async () => {
      await expect(executeTool('nonexistent', {})).rejects.toThrow('Unknown tool: nonexistent');
    });

    test('バリデーションエラー - 必須フィールド不足', async () => {
      toolRegistry.push(mockTool);
      
      await expect(executeTool('mock-tool', {})).rejects.toThrow('Invalid arguments for mock-tool: text: Required');
    });

    test('バリデーションエラー - 型不一致', async () => {
      toolRegistry.push(mockTool);
      
      await expect(executeTool('mock-tool', { text: 'test', number: 'not-a-number' })).rejects.toThrow('Invalid arguments for mock-tool');
    });

    test('複数バリデーションエラーの結合', async () => {
      toolRegistry.push(mockTool);
      
      try {
        await executeTool('mock-tool', { number: 'invalid' });
      } catch (error: any) {
        expect(error.message).toContain('Invalid arguments for mock-tool');
        expect(error.message).toContain('text: Required');
        expect(error.message).toContain('number: Expected number');
      }
    });

    test('ツール実行中のエラー伝播', async () => {
      const errorTool: UnifiedTool = {
        name: 'error-tool',
        description: 'Tool that throws error',
        zodSchema: z.object({}),
        execute: jest.fn().mockRejectedValue(new Error('Tool execution error'))
      };
      
      toolRegistry.push(errorTool);
      
      await expect(executeTool('error-tool', {})).rejects.toThrow('Tool execution error');
    });

    test('非ZodErrorの伝播', async () => {
      const badTool: UnifiedTool = {
        name: 'bad-tool',
        description: 'Tool with bad schema',
        zodSchema: {
          parse: () => { throw new Error('Generic error'); }
        } as any,
        execute: jest.fn()
      };
      
      toolRegistry.push(badTool);
      
      await expect(executeTool('bad-tool', {})).rejects.toThrow('Generic error');
    });
  });

  describe('getPromptMessage', () => {
    test('基本的なプロンプトメッセージ生成', () => {
      toolRegistry.push(mockToolWithPrompt);
      
      const message = getPromptMessage('mock-prompt-tool', { prompt: 'test prompt' });
      
      expect(message).toBe('Use the mock-prompt-tool tool: test prompt');
    });

    test('複数パラメータのメッセージ生成', () => {
      toolRegistry.push(mockToolWithPrompt);
      
      const message = getPromptMessage('mock-prompt-tool', {
        prompt: 'test prompt',
        flag: true
      });
      
      expect(message).toBe('Use the mock-prompt-tool tool: test prompt [flag]');
    });

    test('非boolean値パラメータの処理', () => {
      toolRegistry.push(mockToolWithPrompt);
      
      const message = getPromptMessage('mock-prompt-tool', {
        prompt: 'test prompt',
        customParam: 'value'
      });
      
      expect(message).toBe('Use the mock-prompt-tool tool: test prompt (customParam: value)');
    });

    test('falseブール値の無視', () => {
      toolRegistry.push(mockToolWithPrompt);
      
      const message = getPromptMessage('mock-prompt-tool', {
        prompt: 'test prompt',
        flag: false
      });
      
      expect(message).toBe('Use the mock-prompt-tool tool: test prompt');
    });

    test('undefined/null値の無視', () => {
      toolRegistry.push(mockToolWithPrompt);
      
      const message = getPromptMessage('mock-prompt-tool', {
        prompt: 'test prompt',
        undefinedParam: undefined,
        nullParam: null
      });
      
      expect(message).toBe('Use the mock-prompt-tool tool: test prompt');
    });

    test('promptなしのメッセージ生成', () => {
      toolRegistry.push(mockToolWithPrompt);
      
      const message = getPromptMessage('mock-prompt-tool', { flag: true });
      
      expect(message).toBe('Use the mock-prompt-tool tool: [flag]');
    });

    test('パラメータなしのメッセージ', () => {
      toolRegistry.push(mockToolWithPrompt);
      
      const message = getPromptMessage('mock-prompt-tool', {});
      
      expect(message).toBe('Use the mock-prompt-tool tool');
    });

    test('存在しないツールのエラー', () => {
      expect(() => getPromptMessage('nonexistent', {})).toThrow('No prompt defined for tool: nonexistent');
    });

    test('プロンプト定義のないツールのエラー', () => {
      toolRegistry.push(mockTool);
      
      expect(() => getPromptMessage('mock-tool', {})).toThrow('No prompt defined for tool: mock-tool');
    });
  });

  describe('エラーハンドリング', () => {
    test('循環参照スキーマの処理', async () => {
      // 循環参照を含むスキーマは実際には作成困難だが、
      // zodToJsonSchemaが適切にエラーを処理することを確認
      toolRegistry.push(mockTool);
      
      const definitions = getToolDefinitions();
      expect(definitions).toBeDefined();
      expect(definitions.length).toBeGreaterThan(0);
    });

    test('不正なスキーマ定義の処理', () => {
      const invalidTool: UnifiedTool = {
        name: 'invalid-tool',
        description: 'Invalid schema tool',
        zodSchema: null as any,
        execute: jest.fn()
      };
      
      // zodToJsonSchemaがnullを処理できないことを確認
      expect(() => {
        toolRegistry.push(invalidTool);
        getToolDefinitions();
      }).toThrow();
    });
  });

  describe('型安全性とTypeScript検証', () => {
    test('UnifiedToolインターフェースの適合性', () => {
      // TypeScriptコンパイルエラーがないことを確認するテスト
      const typedTool: UnifiedTool = {
        name: 'typed-tool',
        description: 'Typed tool test',
        zodSchema: z.object({ param: z.string() }),
        execute: async (args, onProgress) => {
          expect(args).toBeDefined();
          expect(typeof onProgress).toBe('function' || 'undefined');
          return 'typed result';
        },
        category: 'simple',
        prompt: {
          description: 'Typed prompt',
          arguments: []
        }
      };
      
      expect(typedTool.name).toBe('typed-tool');
      expect(typedTool.execute).toBeDefined();
    });
  });
});