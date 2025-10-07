/**
 * Text chunker with paragraph-first recursive splitting
 * メモリ効率とUTF-8安全性を重視した実装
 */

import { countTokens, sliceByTokenLimit, TokenizerConfig } from './tokenizer.js';

export interface ChunkingOptions {
  maxTokens: number;            // 各チャンクの最大トークン数
  maxChunks?: number;           // 最大チャンク数（安全制限）
  preserveStructure?: boolean;  // 構造保持優先（デフォルト: true）
  tokenizer?: TokenizerConfig;  // トークナイザー設定
}

/**
 * テキストを段落→行→文字の優先順位で分割
 * メモリ効率を重視したインデックスベース処理
 * 
 * @param text 分割対象テキスト
 * @param opts チャンク分割オプション
 * @returns 分割されたチャンク配列
 */
export function chunkText(text: string, opts: ChunkingOptions): string[] {
  if (!text) {
    return [""];
  }
  
  // 空白のみの文字列も有効なテキストとして処理
  if (!text.trim() && text.length > 0) {
    return [text];
  }

  // オプションのデフォルト値設定
  const {
    maxTokens,
    maxChunks = 1000,
    preserveStructure = true,
    tokenizer
  } = opts;

  // 極端に小さいmaxTokensの処理
  if (maxTokens <= 0) {
    throw new Error('maxTokens must be greater than 0');
  }

  // 分割不要の判定
  const totalTokens = countTokens(text, tokenizer);
  if (totalTokens <= maxTokens) {
    return [text];
  }

  // CRLF→LFの正規化
  const normalizedText = text.replace(/\r\n/g, '\n');

  const chunks: string[] = [];
  
  if (preserveStructure) {
    // 段落優先分割
    chunkByParagraphs(normalizedText, maxTokens, maxChunks, tokenizer, chunks);
  } else {
    // 強制的文字分割
    const forceChunks = sliceByTokenLimit(normalizedText, maxTokens, tokenizer);
    chunks.push(...forceChunks);
  }

  // 安全制限の適用
  if (chunks.length > maxChunks) {
    console.warn(`Chunk count (${chunks.length}) exceeded maxChunks (${maxChunks}). Truncating.`);
    return chunks.slice(0, maxChunks);
  }

  return chunks.filter(chunk => chunk.length > 0);
}

/**
 * 段落優先分割の実装（簡素化版）
 * 段落単位で分割し、大きすぎる段落は行レベルで処理
 */
function chunkByParagraphs(
  text: string,
  maxTokens: number,
  maxChunks: number,
  tokenizer: TokenizerConfig | undefined,
  chunks: string[]
): void {
  // 2つ以上の連続改行を段落区切りとみなし、区切り文字も保持
  const paragraphs = text.split(/(\n{2,})/).filter(p => p);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // 空の段落（連続改行による）はスキップ
    if (!paragraph.trim() && paragraph.includes('\n')) {
      currentChunk += paragraph;
      continue;
    }

    const chunkWithParagraph = currentChunk + paragraph;
    const tokens = countTokens(chunkWithParagraph, tokenizer);

    if (tokens <= maxTokens) {
      currentChunk = chunkWithParagraph;
    } else {
      // 現在のチャンクを先に処理
      if (currentChunk) {
        processTextSegment(currentChunk, maxTokens, tokenizer, chunks);
      }
      // 新しい段落を単独で処理
      processTextSegment(paragraph, maxTokens, tokenizer, chunks);
      currentChunk = '';
    }
  }

  // 最後のチャンクを処理
  if (currentChunk) {
    processTextSegment(currentChunk, maxTokens, tokenizer, chunks);
  }
}


/**
 * テキストセグメントの行レベル分割処理
 * 段落が大きすぎる場合の分割ロジック
 */
function processTextSegment(
  segment: string,
  maxTokens: number,
  tokenizer: TokenizerConfig | undefined,
  chunks: string[]
): void {
  // 空セグメントの処理
  if (!segment || !segment.trim()) {
    return;
  }

  // セグメント全体が制限内の場合
  const segmentTokens = countTokens(segment, tokenizer);
  if (segmentTokens <= maxTokens) {
    chunks.push(segment);
    return;
  }

  // 行レベル分割
  chunkByLines(segment, maxTokens, tokenizer, chunks);
}

/**
 * 行レベルでの貪欲分割
 * 連続する行を可能な限りまとめてチャンク化
 */
function chunkByLines(
  text: string,
  maxTokens: number,
  tokenizer: TokenizerConfig | undefined,
  chunks: string[]
): void {
  const lines = text.split('\n');
  let currentChunk: string[] = [];
  let currentTokens = 0;
  const newlineTokens = countTokens('\n', tokenizer);

  for (const line of lines) {
    const lineTokens = countTokens(line, tokenizer);
    const additionalTokens = currentChunk.length > 0 ? newlineTokens + lineTokens : lineTokens;

    if (currentTokens + additionalTokens <= maxTokens) {
      currentChunk.push(line);
      currentTokens += additionalTokens;
    } else {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join('\n'));
      }

      if (lineTokens > maxTokens) {
        const forceSplit = sliceByTokenLimit(line, maxTokens, tokenizer);
        chunks.push(...forceSplit);
        currentChunk = [];
        currentTokens = 0;
      } else {
        currentChunk = [line];
        currentTokens = lineTokens;
      }
    }
  }

  // 最後の蓄積をチャンク化
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }
}

/**
 * チャンク分割の統計情報を取得
 */
export function getChunkingStats(text: string, opts: ChunkingOptions): {
  originalTokens: number;
  chunkCount: number;
  averageTokensPerChunk: number;
  maxChunkTokens: number;
  minChunkTokens: number;
} {
  const chunks = chunkText(text, opts);
  const originalTokens = countTokens(text, opts.tokenizer);
  
  const chunkTokenCounts = chunks.map(chunk => countTokens(chunk, opts.tokenizer));
  const totalChunkTokens = chunkTokenCounts.reduce((sum, count) => sum + count, 0);
  
  return {
    originalTokens,
    chunkCount: chunks.length,
    averageTokensPerChunk: chunks.length > 0 ? totalChunkTokens / chunks.length : 0,
    maxChunkTokens: chunkTokenCounts.length > 0 ? Math.max(...chunkTokenCounts) : 0,
    minChunkTokens: chunkTokenCounts.length > 0 ? Math.min(...chunkTokenCounts) : 0
  };
}