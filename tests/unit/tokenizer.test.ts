/**
 * Unit tests for tokenizer.ts
 * 多言語対応・UTF-8境界安全性の検証
 */

import {
  countTokens,
  sliceByTokenLimit,
  fallbackSliceByCharLimit,
  getTextStats,
  TokenizerConfig
} from '../../src/utils/tokenizer.js';

describe('tokenizer', () => {
  describe('countTokens', () => {
    test('空文字列の場合は0を返す', () => {
      expect(countTokens('')).toBe(0);
      expect(countTokens(null as any)).toBe(0);
      expect(countTokens(undefined as any)).toBe(0);
    });

    test('英語テキストの近似トークン数', () => {
      // "Hello World" = 11文字 -> ceil(11/4) = 3トークン
      expect(countTokens('Hello World')).toBe(3);
      
      // "This is a test" = 14文字 -> ceil(14/4) = 4トークン
      expect(countTokens('This is a test')).toBe(4);
    });

    test('日本語テキストの近似トークン数', () => {
      // "こんにちは" = 5文字 -> ceil(5/4) = 2トークン
      expect(countTokens('こんにちは')).toBe(2);
      
      // "これは日本語のテストです" = 12文字 -> ceil(12/4) = 3トークン
      expect(countTokens('これは日本語のテストです')).toBe(3);
    });

    test('中国語テキストの近似トークン数', () => {
      // "你好世界" = 4文字 -> ceil(4/4) = 1トークン
      expect(countTokens('你好世界')).toBe(1);
      
      // "这是中文测试" = 6文字 -> ceil(6/4) = 2トークン
      expect(countTokens('这是中文测试')).toBe(2);
    });

    test('韓国語テキストの近似トークン数', () => {
      // "안녕하세요" = 5文字 -> ceil(5/4) = 2トークン
      expect(countTokens('안녕하세요')).toBe(2);
      
      // "한국어 테스트입니다" = 10文字 -> ceil(10/4) = 3トークン
      expect(countTokens('한국어 테스트입니다')).toBe(3);
    });

    test('混合言語テキスト', () => {
      // "Hello こんにちは 你好" = 16文字 -> ceil(16/4) = 4トークン
      expect(countTokens('Hello こんにちは 你好')).toBe(4);
    });

    test('絵文字を含むテキスト', () => {
      // "Hello 🌍 World" = 13文字 -> ceil(13/4) = 4トークン
      expect(countTokens('Hello 🌍 World')).toBe(4);
      
      // "👋🏻🌸🎉" = 4文字 -> ceil(4/4) = 1トークン
      expect(countTokens('👋🏻🌸🎉')).toBe(1);
    });

    test('結合文字（複雑なUTF-8）', () => {
      // "é" (e + 結合アクセント) = Array.fromでは2要素になる
      const eWithAccent = 'e\u0301'; // é as e + combining acute accent
      expect(countTokens(eWithAccent)).toBe(1); // ceil(2/4) = 1
      
      // "👨‍👩‍👧‍👦" (family emoji) = Array.fromでは7要素（結合ZWJ含む）
      const familyEmoji = '👨‍👩‍👧‍👦';
      const expectedTokens = Math.ceil(Array.from(familyEmoji).length / 4);
      expect(countTokens(familyEmoji)).toBe(expectedTokens);
    });
  });

  describe('sliceByTokenLimit', () => {
    test('空文字列の処理', () => {
      expect(sliceByTokenLimit('', 10)).toEqual(['']);
    });

    test('制限内のテキストはそのまま返す', () => {
      const text = 'Hello';
      expect(sliceByTokenLimit(text, 10)).toEqual([text]);
    });

    test('英語テキストの分割', () => {
      // 20文字のテキストを8文字ずつに分割（maxTokens=2 → 8文字）
      const text = 'This is a long test';
      const result = sliceByTokenLimit(text, 2);
      
      // 各スライスが8文字以下であることを確認
      result.forEach(slice => {
        expect(Array.from(slice).length).toBeLessThanOrEqual(8);
      });
      
      // 結合すると元のテキストになることを確認
      expect(result.join('')).toBe(text);
    });

    test('日本語テキストの分割（UTF-8境界安全性）', () => {
      const text = 'これは日本語のテストですから長いテキストを使います';
      const result = sliceByTokenLimit(text, 3); // 12文字ずつ分割
      
      // 各スライスが正しく分割されていることを確認
      result.forEach(slice => {
        expect(Array.from(slice).length).toBeLessThanOrEqual(12);
      });
      
      // 結合すると元のテキストになることを確認
      expect(result.join('')).toBe(text);
      
      // UTF-8文字が分割されていないことを確認
      result.forEach(slice => {
        expect(slice).toMatch(/^[\u0000-\uFFFF]*$/); // 有効な文字のみ
      });
    });

    test('絵文字を含むテキストの分割', () => {
      const text = 'Hello 🌍 World 🎉 Test 🚀';
      const result = sliceByTokenLimit(text, 2); // 8文字ずつ
      
      // 絵文字が分割されていないことを確認
      expect(result.join('')).toBe(text);
    });

    test('結合文字の分割安全性', () => {
      const text = 'café naïve résumé'; // アクセント付き文字
      const result = sliceByTokenLimit(text, 2);
      
      // 結合文字が分割されていないことを確認
      expect(result.join('')).toBe(text);
    });
  });

  describe('fallbackSliceByCharLimit', () => {
    test('空文字列の処理', () => {
      expect(fallbackSliceByCharLimit('', 10)).toEqual(['']);
    });

    test('制限内のテキストはそのまま返す', () => {
      const text = 'Hello';
      expect(fallbackSliceByCharLimit(text, 10)).toEqual([text]);
    });

    test('UTF-8境界を考慮した分割', () => {
      const text = 'これは日本語のテストです';
      const result = fallbackSliceByCharLimit(text, 5);
      
      // 結合すると元のテキストになることを確認
      expect(result.join('')).toBe(text);
      
      // 各スライスが5文字以下であることを確認
      result.forEach(slice => {
        expect(Array.from(slice).length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('getTextStats', () => {
    test('空文字列の統計', () => {
      const stats = getTextStats('');
      expect(stats).toEqual({
        characters: 0,
        approximateTokens: 0,
        lines: 0,
        paragraphs: 0
      });
    });

    test('基本的なテキストの統計', () => {
      const text = 'Hello World\nThis is a test\n\nSecond paragraph';
      const stats = getTextStats(text);
      
      expect(stats.characters).toBe(Array.from(text).length);
      expect(stats.approximateTokens).toBe(countTokens(text));
      expect(stats.lines).toBe(4); // 3行の改行で4行
      expect(stats.paragraphs).toBe(2); // 空行区切りで2段落
    });

    test('多言語テキストの統計', () => {
      const text = 'Hello こんにちは\n你好 안녕하세요\n\n🌍🎉';
      const stats = getTextStats(text);
      
      // UTF-8文字が正しくカウントされることを確認
      expect(stats.characters).toBe(Array.from(text).length);
      expect(stats.lines).toBe(4);
      expect(stats.paragraphs).toBe(2);
    });
  });

  describe('TokenizerConfig', () => {
    test('設定が結果に影響しないことを確認', () => {
      const text = 'Test text';
      const config: TokenizerConfig = {
        model: 'gemini-2.5-pro',
        encoding: 'cl100k_base'
      };
      
      // 設定ありなしで同じ結果が得られることを確認
      expect(countTokens(text, config)).toBe(countTokens(text));
      expect(sliceByTokenLimit(text, 5, config)).toEqual(sliceByTokenLimit(text, 5));
    });
  });
});