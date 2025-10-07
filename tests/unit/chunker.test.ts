/**
 * Unit tests for chunker.ts
 * 段落優先分割アルゴリズムとメモリ効率性の検証
 */

import {
  chunkText,
  getChunkingStats,
  ChunkingOptions
} from '../../src/utils/chunker.js';

describe('chunker', () => {
  const defaultOptions: ChunkingOptions = {
    maxTokens: 10,
    preserveStructure: true
  };

  describe('chunkText', () => {
    test('空文字列の処理', () => {
      expect(chunkText('', defaultOptions)).toEqual(['']);
      expect(chunkText('   ', defaultOptions)).toEqual(['   ']);
    });

    test('制限内テキストはそのまま返す', () => {
      const text = 'Short text';
      const result = chunkText(text, defaultOptions);
      expect(result).toEqual([text]);
    });

    test('改行文字の処理', () => {
      const text = 'Line 1\nLine 2\n\nParagraph 2';
      const result = chunkText(text, defaultOptions);
      
      // 改行文字が適切に処理されることを確認
      expect(result.length).toBeGreaterThan(0);
      expect(result.join('')).toBe(text);
    });

    test('段落優先分割 - 小さな段落', () => {
      const text = 'Para 1\n\nPara 2\n\nPara 3';
      const result = chunkText(text, { maxTokens: 5, preserveStructure: true });
      
      // チャンクが生成されることを確認
      expect(result.length).toBeGreaterThan(0);
      
      // 結合すると元のテキストになることを確認
      expect(result.join('')).toBe(text);
    });

    test('段落優先分割 - 大きな段落の行レベル分割', () => {
      const text = 'Line 1\nLine 2\nLine 3\nLine 4\n\nNext paragraph';
      const result = chunkText(text, { maxTokens: 8, preserveStructure: true });
      
      // チャンクが生成されることを確認
      expect(result.length).toBeGreaterThan(1);
      
      // 結合すると元のテキストになることを確認
      expect(result.join('')).toBe(text);
    });

    test('行レベル貪欲分割', () => {
      const lines = ['A', 'B', 'C', 'D', 'E']; // 各1文字 = 1トークン
      const text = lines.join('\n'); // A\nB\nC\nD\nE = 9文字 = 3トークン
      const result = chunkText(text, { maxTokens: 3, preserveStructure: true });
      
      // チャンクが生成されることを確認
      expect(result.length).toBeGreaterThan(0);
      
      // 結合すると元のテキストになることを確認
      expect(result.join('')).toBe(text);
    });

    test('超長行の強制分割', () => {
      const longLine = 'a'.repeat(100); // 100文字 = 25トークン
      const result = chunkText(longLine, { maxTokens: 5, preserveStructure: true });
      
      // 強制分割されることを確認
      expect(result.length).toBeGreaterThan(1);
      
      // 結合すると元のテキストになることを確認
      expect(result.join('')).toBe(longLine);
    });

    test('preserveStructure=false（強制文字分割）', () => {
      const text = 'This is a long text that should be split';
      const result = chunkText(text, { 
        maxTokens: 5, 
        preserveStructure: false 
      });
      
      // 強制分割されることを確認
      expect(result.length).toBeGreaterThan(1);
      
      // 結合すると元のテキストになることを確認
      expect(result.join('')).toBe(text);
    });

    test('maxChunks制限', () => {
      const text = 'a'.repeat(1000); // 長いテキスト
      const result = chunkText(text, { 
        maxTokens: 1, 
        maxChunks: 5,
        preserveStructure: true 
      });
      
      // チャンク数が制限されることを確認
      expect(result.length).toBeLessThanOrEqual(5);
    });

    test('maxTokens=0のエラー', () => {
      expect(() => {
        chunkText('test', { maxTokens: 0 });
      }).toThrow('maxTokens must be greater than 0');
    });

    test('多言語テキストの分割（UTF-8安全性）', () => {
      const text = 'Hello 世界\n\nこんにちは World\n\n你好 🌍';
      const result = chunkText(text, { maxTokens: 8, preserveStructure: true });
      
      // UTF-8文字が正しく処理されることを確認
      expect(result.join('')).toBe(text);
      
      // 各チャンクが有効な文字列であることを確認
      result.forEach(chunk => {
        expect(typeof chunk).toBe('string');
        expect(chunk.length).toBeGreaterThan(0);
      });
    });

    test('絵文字を含むテキストの分割', () => {
      const text = '🎉 Party time! 🎊\n\nCelebration 🥳 continues\n\n🌟 The end';
      const result = chunkText(text, { maxTokens: 6, preserveStructure: true });
      
      // 絵文字が正しく処理されることを確認
      expect(result.join('')).toBe(text);
    });

    test('空行の処理（連続改行）', () => {
      const text = 'Para 1\n\n\n\nPara 2';
      const result = chunkText(text, { maxTokens: 10, preserveStructure: true });
      
      // 連続改行が段落区切りとして適切に保持されることを確認
      expect(result.join('')).toBe(text);
      expect(result.length).toBe(1); // 1つのチャンクにまとまるはず
    });

    test('3つ以上の連続改行', () => {
      const text = 'A\n\n\nB';
      const result = chunkText(text, { maxTokens: 5 });
      expect(result.join('')).toBe(text);
    });

    test('末尾改行の処理', () => {
      const text = 'Line 1\nLine 2\n';
      const result = chunkText(text, defaultOptions);
      
      // 末尾改行が保持されることを確認
      expect(result.join('')).toBe(text);
    });
  });

  describe('getChunkingStats', () => {
    test('基本的な統計情報', () => {
      const text = 'Short text for stats';
      const stats = getChunkingStats(text, defaultOptions);
      
      expect(stats.originalTokens).toBeGreaterThan(0);
      expect(stats.chunkCount).toBeGreaterThanOrEqual(1);
      expect(stats.averageTokensPerChunk).toBeGreaterThan(0);
      expect(stats.maxChunkTokens).toBeGreaterThanOrEqual(stats.minChunkTokens);
    });

    test('複数チャンクの統計', () => {
      const text = 'a'.repeat(100); // 長いテキスト
      const stats = getChunkingStats(text, { maxTokens: 5 });
      
      expect(stats.chunkCount).toBeGreaterThan(1);
      expect(stats.maxChunkTokens).toBeLessThanOrEqual(5);
      expect(stats.minChunkTokens).toBeGreaterThan(0);
    });

    test('単一チャンクの統計', () => {
      const text = 'Short';
      const stats = getChunkingStats(text, { maxTokens: 10 });
      
      expect(stats.chunkCount).toBe(1);
      expect(stats.averageTokensPerChunk).toBe(stats.originalTokens);
      expect(stats.maxChunkTokens).toBe(stats.minChunkTokens);
    });
  });

  describe('境界値テスト', () => {
    test('単一文字', () => {
      const result = chunkText('A', { maxTokens: 1 });
      expect(result).toEqual(['A']);
    });

    test('単一改行', () => {
      const result = chunkText('\n', defaultOptions);
      expect(result).toEqual(['\n']);
    });

    test('段落区切りのみ', () => {
      const result = chunkText('\n\n', defaultOptions);
      expect(result).toEqual(['\n\n']);
    });

    test('巨大なmaxTokens', () => {
      const text = 'Test text';
      const result = chunkText(text, { maxTokens: 100000 });
      expect(result).toEqual([text]);
    });
  });

  describe('パフォーマンステスト（サンプル）', () => {
    test('中規模テキストの処理', () => {
      // 10KB程度のテキストを生成
      const text = 'Lorem ipsum dolor sit amet. '.repeat(400);
      
      const startTime = Date.now();
      const result = chunkText(text, { maxTokens: 100 });
      const endTime = Date.now();
      
      // 基本的な処理完了確認
      expect(result.length).toBeGreaterThan(1);
      expect(result.join('')).toBe(text);
      
      // パフォーマンス目安（1秒以下）
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('メモリ効率性検証', () => {
    test('結合文字の正しい処理', () => {
      const text = 'café naïve résumé\n\nMore accented text: piñata';
      const result = chunkText(text, { maxTokens: 8 });
      
      // アクセント付き文字が正しく処理されることを確認
      expect(result.join('')).toBe(text);
    });

    test('サロゲートペア（絵文字）の処理', () => {
      const text = '👨‍👩‍👧‍👦 Family\n\n👋🏻 Hand wave\n\n🌈 Rainbow';
      const result = chunkText(text, { maxTokens: 5 });
      
      // 複合絵文字が正しく処理されることを確認
      expect(result.join('')).toBe(text);
    });
  });
});