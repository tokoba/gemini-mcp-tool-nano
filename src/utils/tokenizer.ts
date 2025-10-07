/**
 * Simple character-based tokenizer for text chunking
 * 
 * This provides a simplified approach to text tokenization without external dependencies
 * or API keys. Uses character count as a proxy for token count with reasonable approximation.
 */

export interface TokenizerConfig {
  model: string;       // モデル名（参考用、実際の処理には影響しない）
  encoding?: string;   // エンコーディング（参考用、実際の処理には影響しない）
}

/**
 * 文字数ベースの簡易トークン数計算
 * UTF-8文字境界を考慮した正確な文字数カウント
 * 
 * 多言語対応：
 * - 英語: 平均4-5文字/トークン
 * - 日本語: 平均2-3文字/トークン（ひらがな・カタカナ・漢字）
 * - 中国語: 平均1-2文字/トークン（漢字）
 * - 韓国語: 平均2-3文字/トークン（ハングル）
 * 
 * 安全性を考慮し、やや少なめの係数を使用（4.0を採用）
 */
export function countTokens(text: string, config?: TokenizerConfig): number {
  if (!text) return 0;
  
  // Array.fromでUTF-8文字境界を考慮した正確な文字数を取得
  const charCount = Array.from(text).length;
  
  // 簡易近似：4文字 ≈ 1トークン（安全側に少なめ）
  const approximateTokens = Math.ceil(charCount / 4.0);
  
  return approximateTokens;
}

/**
 * 指定されたトークン制限で文字列を分割
 * UTF-8文字境界を考慮して安全に分割
 * 
 * @param text 分割対象のテキスト
 * @param maxTokens 各スライスの最大トークン数
 * @param config トークナイザー設定（参考用）
 * @returns 分割されたテキスト配列
 */
export function sliceByTokenLimit(
  text: string, 
  maxTokens: number, 
  config?: TokenizerConfig
): string[] {
  if (!text) return [""];
  
  const totalTokens = countTokens(text, config);
  
  // 分割不要の場合
  if (totalTokens <= maxTokens) {
    return [text];
  }
  
  const slices: string[] = [];
  
  // 1トークン = 4文字で逆算し、各スライスの最大文字数を計算
  const maxCharsPerSlice = maxTokens * 4;
  
  // Array.fromでUTF-8文字境界を考慮した文字配列に変換
  const chars = Array.from(text);
  
  for (let i = 0; i < chars.length; i += maxCharsPerSlice) {
    const slice = chars.slice(i, i + maxCharsPerSlice).join('');
    slices.push(slice);
  }
  
  return slices;
}

/**
 * エラー処理用：フォールバック分割
 * UTF-8文字境界を考慮した安全な文字数制限分割
 */
export function fallbackSliceByCharLimit(
  text: string, 
  maxChars: number
): string[] {
  if (!text) return [""];
  
  // Array.fromでUTF-8文字境界を考慮した文字配列に変換
  const chars = Array.from(text);
  
  if (chars.length <= maxChars) {
    return [text];
  }
  
  const slices: string[] = [];
  
  for (let i = 0; i < chars.length; i += maxChars) {
    const slice = chars.slice(i, i + maxChars).join('');
    slices.push(slice);
  }
  
  return slices;
}

/**
 * デバッグ用：テキストの統計情報を取得
 */
export function getTextStats(text: string): {
  characters: number;
  approximateTokens: number;
  lines: number;
  paragraphs: number;
} {
  if (!text) {
    return {
      characters: 0,
      approximateTokens: 0,
      lines: 0,
      paragraphs: 0
    };
  }
  
  // UTF-8文字境界を考慮した正確な文字数
  const characters = Array.from(text).length;
  const approximateTokens = countTokens(text);
  const lines = text.split('\n').length;
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0).length;
  
  return {
    characters,
    approximateTokens,
    lines,
    paragraphs
  };
}