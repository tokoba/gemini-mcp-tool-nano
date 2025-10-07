/**
 * Secure file-based chunk cache with atomic operations
 * クロスプラットフォーム対応・アトミック生成・TTL自動削除
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { countTokens } from './tokenizer.js';

// クロスプラットフォーム対応のキャッシュディレクトリ
const CACHE_BASE_DIR = path.join(os.tmpdir(), 'gemini-mcp-chunks');
const TTL_MS = 24 * 60 * 60 * 1000; // 24時間
const MAX_CACHE_DIRS = 1000; // 最大キャッシュディレクトリ数
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 最大100MB

export interface CacheResult {
  cacheKey: string;   // UUID v4
  chunkCount: number;
  totalSize: number;  // トークン数
}

export interface CacheMetadata {
  cacheKey: string;
  totalChunks: number;
  createdAt: string;
  expiresAt: string;
  originalTokens: number;
  chunkTokenSizes: number[];
}

/**
 * UUIDの検証
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * パス・トラバーサル攻撃防止
 */
function validateCachePath(cacheKey: string): string {
  if (!isValidUUID(cacheKey)) {
    throw new Error('Invalid cache key format');
  }
  
  const cacheDir = path.join(CACHE_BASE_DIR, cacheKey);
  const resolvedPath = path.resolve(cacheDir);
  const basePath = path.resolve(CACHE_BASE_DIR);
  
  if (!resolvedPath.startsWith(basePath + path.sep) && resolvedPath !== basePath) {
    throw new Error('Invalid path detected');
  }
  
  return cacheDir;
}

/**
 * 安全なディレクトリ作成（権限設定付き）
 */
async function createSecureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(dirPath, { mode: 0o700, recursive: true });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code !== 'EEXIST') {
      throw error;
    }
  }
}

/**
 * チャンクを安全に保存（アトミック操作）
 */
export async function saveChunks(
  chunks: string[], 
  meta?: { totalTokens?: number }
): Promise<CacheResult> {
  if (chunks.length === 0) {
    throw new Error('Cannot save empty chunks array');
  }

  // ベースディレクトリの作成
  await createSecureDirectory(CACHE_BASE_DIR);

  // 容量制限チェック
  await enforceCapacityLimits();

  const cacheKey = randomUUID();
  const tempDir = path.join(CACHE_BASE_DIR, `temp-${cacheKey}`);
  const finalDir = validateCachePath(cacheKey);

  try {
    // 一時ディレクトリ作成
    await createSecureDirectory(tempDir);

    // チャンクファイルの並列書き込み
    const savePromises = chunks.map(async (chunk, index) => {
      const fileName = `chunk-${String(index + 1).padStart(3, '0')}.txt`;
      const filePath = path.join(tempDir, fileName);
      await fs.promises.writeFile(filePath, chunk, { 
        mode: 0o600,
        encoding: 'utf8' 
      });
    });

    await Promise.all(savePromises);

    // メタデータの作成
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TTL_MS);
    const totalTokens = meta?.totalTokens ?? chunks.reduce((sum, chunk) => sum + countTokens(chunk), 0);
    const chunkTokenSizes = chunks.map(chunk => countTokens(chunk));

    const metadata: CacheMetadata = {
      cacheKey,
      totalChunks: chunks.length,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      originalTokens: totalTokens,
      chunkTokenSizes
    };

    const metadataPath = path.join(tempDir, 'metadata.json');
    await fs.promises.writeFile(
      metadataPath, 
      JSON.stringify(metadata, null, 2), 
      { mode: 0o600, encoding: 'utf8' }
    );

    // アトミック操作：一時ディレクトリを最終ディレクトリにリネーム
    await fs.promises.rename(tempDir, finalDir);

    return {
      cacheKey,
      chunkCount: chunks.length,
      totalSize: totalTokens
    };

  } catch (error) {
    // 失敗時のクリーンアップ
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      // クリーンアップ失敗は警告レベル
      console.warn(`Failed to cleanup temp directory: ${tempDir}`, cleanupError);
    }
    throw error;
  }
}

/**
 * 指定されたチャンクを取得
 */
export async function getChunk(cacheKey: string, chunkIndex: number): Promise<string | null> {
  if (chunkIndex < 1) {
    throw new Error('Chunk index must be 1 or greater');
  }

  try {
    const cacheDir = validateCachePath(cacheKey);

    // メタデータの確認
    const metadataPath = path.join(cacheDir, 'metadata.json');
    const metadataContent = await fs.promises.readFile(metadataPath, 'utf8');
    const metadata: CacheMetadata = JSON.parse(metadataContent);

    // TTL確認
    const expiresAt = new Date(metadata.expiresAt);
    if (new Date() > expiresAt) {
      // 期限切れキャッシュの削除
      await fs.promises.rm(cacheDir, { recursive: true, force: true });
      return null;
    }

    // インデックス範囲確認
    if (chunkIndex > metadata.totalChunks) {
      return null;
    }

    // チャンクファイルの読み取り
    const fileName = `chunk-${String(chunkIndex).padStart(3, '0')}.txt`;
    const chunkPath = path.join(cacheDir, fileName);
    
    // 最終的なパス検証
    const resolvedChunkPath = path.resolve(chunkPath);
    const resolvedCacheDir = path.resolve(cacheDir);
    if (!resolvedChunkPath.startsWith(resolvedCacheDir + path.sep)) {
      throw new Error('Invalid chunk path detected');
    }

    const chunkContent = await fs.promises.readFile(chunkPath, 'utf8');
    return chunkContent;

  } catch (error) {
    if (error instanceof Error && 'code' in error && 
        (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return null;
    }
    // Node.js fs errors might have different structure
    if (error && typeof error === 'object' && 'code' in error &&
        (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return null;
    }
    throw error;
  }
}

/**
 * 期限切れキャッシュのクリーンアップ
 */
export async function cleanupExpired(): Promise<number> {
  let deletedCount = 0;

  try {
    await createSecureDirectory(CACHE_BASE_DIR);
    const entries = await fs.promises.readdir(CACHE_BASE_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('temp-')) {
        continue; // 一時ディレクトリや非ディレクトリはスキップ
      }

      if (!isValidUUID(entry.name)) {
        continue; // 無効なUUIDディレクトリはスキップ
      }

      try {
        const cacheDir = path.join(CACHE_BASE_DIR, entry.name);
        const metadataPath = path.join(cacheDir, 'metadata.json');
        
        const metadataContent = await fs.promises.readFile(metadataPath, 'utf8');
        const metadata: CacheMetadata = JSON.parse(metadataContent);
        
        const expiresAt = new Date(metadata.expiresAt);
        if (new Date() > expiresAt) {
          await fs.promises.rm(cacheDir, { recursive: true, force: true });
          deletedCount++;
        }
      } catch (error) {
        // 個別のディレクトリ処理エラーは警告レベル
        console.warn(`Failed to process cache directory: ${entry.name}`, error);
      }
    }
  } catch (error) {
    console.error('Failed to cleanup expired caches:', error);
    throw error;
  }

  return deletedCount;
}

/**
 * キャッシュ統計情報の取得
 */
export async function getCacheStats(): Promise<{
  fileCount: number;
  totalSize: number;
  dir: string;
  ttlMs: number;
}> {
  let fileCount = 0;
  let totalSize = 0;

  try {
    await createSecureDirectory(CACHE_BASE_DIR);
    const entries = await fs.promises.readdir(CACHE_BASE_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && isValidUUID(entry.name)) {
        try {
          const cacheDir = path.join(CACHE_BASE_DIR, entry.name);
          const files = await fs.promises.readdir(cacheDir);
          fileCount += files.length;

          // ディレクトリサイズの計算
          for (const file of files) {
            const filePath = path.join(cacheDir, file);
            const stats = await fs.promises.stat(filePath);
            totalSize += stats.size;
          }
        } catch (error) {
          // 個別の統計取得エラーは無視
          console.warn(`Failed to get stats for directory: ${entry.name}`, error);
        }
      }
    }
  } catch (error) {
    // 統計取得の失敗は警告レベル
    console.warn('Failed to get cache stats:', error);
  }

  return {
    fileCount,
    totalSize,
    dir: CACHE_BASE_DIR,
    ttlMs: TTL_MS
  };
}

/**
 * 容量制限の強制（古いキャッシュから削除）
 */
async function enforceCapacityLimits(): Promise<void> {
  try {
    await createSecureDirectory(CACHE_BASE_DIR);
    const entries = await fs.promises.readdir(CACHE_BASE_DIR, { withFileTypes: true });
    const validCaches: Array<{ name: string; createdAt: Date }> = [];

    // 有効なキャッシュディレクトリの収集
    for (const entry of entries) {
      if (!entry.isDirectory() || !isValidUUID(entry.name) || entry.name.startsWith('temp-')) {
        continue;
      }

      try {
        const metadataPath = path.join(CACHE_BASE_DIR, entry.name, 'metadata.json');
        const metadataContent = await fs.promises.readFile(metadataPath, 'utf8');
        const metadata: CacheMetadata = JSON.parse(metadataContent);
        
        validCaches.push({
          name: entry.name,
          createdAt: new Date(metadata.createdAt)
        });
      } catch (error) {
        // メタデータが読めないディレクトリは削除対象
        try {
          await fs.promises.rm(path.join(CACHE_BASE_DIR, entry.name), { recursive: true, force: true });
        } catch (deleteError) {
          console.warn(`Failed to delete invalid cache directory: ${entry.name}`, deleteError);
        }
      }
    }

    // ディレクトリ数制限
    if (validCaches.length > MAX_CACHE_DIRS) {
      validCaches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const toDelete = validCaches.slice(0, validCaches.length - MAX_CACHE_DIRS);
      
      for (const cache of toDelete) {
        try {
          await fs.promises.rm(path.join(CACHE_BASE_DIR, cache.name), { recursive: true, force: true });
        } catch (error) {
          console.warn(`Failed to delete cache directory: ${cache.name}`, error);
        }
      }
    }

    // サイズ制限は統計情報で概算チェック（詳細実装は必要に応じて）
    const stats = await getCacheStats();
    if (stats.totalSize > MAX_CACHE_SIZE) {
      console.warn(`Cache size (${stats.totalSize} bytes) exceeds limit (${MAX_CACHE_SIZE} bytes)`);
    }

  } catch (error) {
    console.warn('Failed to enforce capacity limits:', error);
  }
}

/**
 * 定期クリーンアップの開始（バックグラウンド実行）
 */
export function startPeriodicCleanup(intervalMs: number = 60 * 60 * 1000): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const deletedCount = await cleanupExpired();
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} expired cache entries`);
      }
    } catch (error) {
      console.error('Periodic cleanup failed:', error);
    }
  }, intervalMs);
}

/**
 * 起動時クリーンアップ
 */
export async function initializeCache(): Promise<void> {
  try {
    const deletedCount = await cleanupExpired();
    if (deletedCount > 0) {
      console.log(`Startup cleanup: removed ${deletedCount} expired cache entries`);
    }
  } catch (error) {
    console.warn('Startup cache cleanup failed:', error);
  }
}