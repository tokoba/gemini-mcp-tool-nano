/**
 * Secure file-based chunk cache with atomic operations
 * クロスプラットフォーム対応・アトミック生成・TTL自動削除
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { countTokens } from './tokenizer.js';
import { Logger } from './logger.js';

function debugLog(...args: unknown[]) {
  if (process.env.CHUNK_CACHE_DEBUG === '1') {
    Logger.debug(`[chunkCache] ${args.join(' ')}`);
  }
}

// 軽量化: 容量制限チェックの実行頻度を抑制（デフォルト60秒に1回）
let lastEnforceAt = 0;
function shouldEnforceCapacityNow(): boolean {
  if (process.env.CHUNK_CACHE_FORCE_ENFORCE === '1') return true;
  const now = Date.now();
  const intervalMs = 60_000; // 60s
  if (now - lastEnforceAt > intervalMs) {
    lastEnforceAt = now;
    return true;
  }
  return false;
}

async function listCandidateStorageDirs(): Promise<string[]> {
  const tmp = os.tmpdir();
  const entries = await fs.promises.readdir(tmp, { withFileTypes: true });
  const dirs: string[] = [];
  for (const e of entries) {
    if (e.isDirectory() && e.name.startsWith('gemini-mcp-chunks-')) {
      dirs.push(path.join(tmp, e.name));
    }
  }
  // 現在のストレージベースを優先
  const current = getStorageBaseDir();
  if (!dirs.includes(current)) dirs.unshift(current);
  return dirs;
}

async function restorePublicLink(cacheKey: string): Promise<boolean> {
  const publicBase = getPublicBaseDir();
  const linkPath = path.join(publicBase, cacheKey);
  try {
    await fs.promises.access(linkPath, fs.constants.F_OK);
    return true; // 既に存在
  } catch {}

  const candidates = await listCandidateStorageDirs();
  for (const base of candidates) {
    const target = path.join(base, cacheKey);
    try {
      await fs.promises.access(target, fs.constants.F_OK);
      await createSecureDirectory(publicBase);
      try {
        await fs.promises.symlink(target, linkPath, 'dir');
      } catch (e: unknown) {
        if (e && typeof e === 'object' && 'code' in e && (e as {code: string}).code === 'EPERM') {
          // フォールバック：コピー
          await createSecureDirectory(linkPath);
          const files = await fs.promises.readdir(target);
          for (const f of files) {
            const src = path.join(target, f);
            const dst = path.join(linkPath, f);
            const buf = await fs.promises.readFile(src);
            await fs.promises.writeFile(dst, buf, { mode: 0o600 });
          }
        } else {
          throw e;
        }
      }
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

// クロスプラットフォーム対応のキャッシュディレクトリ
// 公開ルート（クライアントが参照するルート）
const CACHE_BASE_ROOT = path.join(os.tmpdir(), 'gemini-mcp-chunks');

// 実ストレージルート（並列ワーカー干渉を回避）
function getStorageBaseDir(): string {
  const workerId = process.env.JEST_WORKER_ID?.trim();
  if (workerId && workerId.length > 0) {
    return path.join(os.tmpdir(), `gemini-mcp-chunks-${workerId}`);
  }
  return path.join(os.tmpdir(), 'gemini-mcp-chunks-main');
}

// 公開ベース（APIやテストが参照する固定の見た目のパス）
function getPublicBaseDir(): string {
  return CACHE_BASE_ROOT;
}
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
  
  const baseDir = getPublicBaseDir();
  const cacheDir = path.join(baseDir, cacheKey);
  const resolvedPath = path.resolve(cacheDir);
  const basePath = path.resolve(baseDir);
  
  if (!resolvedPath.startsWith(basePath + path.sep) && resolvedPath !== basePath) {
    throw new Error('Invalid path detected');
  }
  
  return cacheDir;
}

/**
 * 安全なディレクトリ作成（権限設定付き）
 */
async function createSecureDirectory(dirPath: string): Promise<void> {
  const maxAttempts = 5;
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      await fs.promises.mkdir(dirPath, { mode: 0o700, recursive: true });
      // 成功 or 既に存在
      return;
    } catch (error: unknown) {
      // すでに存在 → OK
      if (error && typeof error === 'object' && 'code' in error && (error as {code: string}).code === 'EEXIST') {
        return;
      }
      // 一時的なENOENT/ENOTDIR（親ディレクトリの並行削除等）→ リトライ
      if (error && typeof error === 'object' && 'code' in error && 
          ((error as {code: string}).code === 'ENOENT' || (error as {code: string}).code === 'ENOTDIR')) {
        attempt++;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 10 * attempt));
          continue;
        }
      }
      // 最後に存在確認してから投げる
      try {
        await fs.promises.access(dirPath, fs.constants.F_OK);
        return;
      } catch {
        throw error;
      }
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

  // 常に動的にルートを解決し、外部削除に耐える
  const publicBase = getPublicBaseDir();
  const storageBase = getStorageBaseDir();
  await createSecureDirectory(storageBase);
  await createSecureDirectory(publicBase);
  if (shouldEnforceCapacityNow()) {
    await enforceCapacityLimits();
  }

  const cacheKey = randomUUID();
  const finalDir = validateCachePath(cacheKey); // public link path

  const maxOverallAttempts = 3;
  let attempt = 0;
  while (attempt < maxOverallAttempts) {
    const tempDir = path.join(storageBase, `temp-${cacheKey}`);
    try {
      debugLog('saveChunks begin', { cacheKey, attempt: attempt + 1 });
      // 一時ディレクトリ作成（複数回リトライ）
      let dirAttempts = 0;
      const maxDirAttempts = 3;
      while (dirAttempts < maxDirAttempts) {
        try {
          await createSecureDirectory(storageBase);
          await createSecureDirectory(tempDir);
          await fs.promises.access(tempDir, fs.constants.F_OK);
          break;
        } catch (dirError) {
          dirAttempts++;
          if (dirAttempts >= maxDirAttempts) {
            throw dirError;
          }
          await new Promise((r) => setTimeout(r, 10 * dirAttempts));
        }
      }

      // チャンクファイルの直列書き込み（安全性重視）
      for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        const fileName = `chunk-${String(index + 1).padStart(3, '0')}.txt`;
        const filePath = path.join(tempDir, fileName);

        // 途中でディレクトリが削除されていないか検査
        await fs.promises.access(tempDir, fs.constants.F_OK);
        await fs.promises.writeFile(filePath, chunk, { mode: 0o600, encoding: 'utf8' });
      }

      // メタデータの作成
      const now = new Date();
      const expiresAt = new Date(now.getTime() + TTL_MS);
      const totalTokens = meta?.totalTokens ?? chunks.reduce((sum, chunk) => sum + countTokens(chunk), 0);
      const chunkTokenSizes = chunks.map((chunk) => countTokens(chunk));

      const metadata: CacheMetadata = {
        cacheKey,
        totalChunks: chunks.length,
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        originalTokens: totalTokens,
        chunkTokenSizes,
      };

      await fs.promises.access(tempDir, fs.constants.F_OK);
      const metadataPath = path.join(tempDir, 'metadata.json');
      await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), { mode: 0o600, encoding: 'utf8' });

      // アトミック操作：一時ディレクトリを最終ディレクトリにリネーム
      debugLog('rename temp -> storageFinal', { tempDir, storageBase, cacheKey });
      const storageFinalDir = path.join(storageBase, cacheKey);
      let storageFinalReady = false;

      // 事前に既存の最終ディレクトリがあるか確認（前回試行が成功済みの可能性）
      try {
        await fs.promises.access(storageFinalDir, fs.constants.F_OK);
        // 既に存在する場合はメタデータの可視性で判定
        const existedMeta = await fs.promises.readFile(path.join(storageFinalDir, 'metadata.json'), 'utf8');
        JSON.parse(existedMeta);
        storageFinalReady = true;
        debugLog('storageFinalDir already exists and is valid', { storageFinalDir });
      } catch {
        // 無ければリネームで作成
      }

      if (!storageFinalReady) {
        try {
          await fs.promises.rename(tempDir, storageFinalDir);
          storageFinalReady = true;
        } catch (renameErr: unknown) {
          // 既に存在している場合や一時的な不整合を吸収
          if (renameErr && typeof renameErr === 'object' && 'code' in renameErr && 
              ((renameErr as {code: string}).code === 'EEXIST' || (renameErr as {code: string}).code === 'ENOTEMPTY')) {
            try {
              await fs.promises.access(storageFinalDir, fs.constants.F_OK);
              const metaText = await fs.promises.readFile(path.join(storageFinalDir, 'metadata.json'), 'utf8');
              JSON.parse(metaText);
              storageFinalReady = true; // 既に正しく存在
              // 残ってしまったtempは掃除
              try { await fs.promises.rm(tempDir, { recursive: true, force: true }); } catch {}
            } catch {
              // 破損している場合は削除して再試行
              try { await fs.promises.rm(storageFinalDir, { recursive: true, force: true }); } catch {}
              await fs.promises.rename(tempDir, storageFinalDir);
              storageFinalReady = true;
            }
          } else {
            throw renameErr;
          }
        }
      }

      // 公開ベースにシンボリックリンクを作成（存在時のみ置き換え）。
      // 親ディレクトリが外部で削除される場合があるため、再試行を行う。
      {
        const maxLinkAttempts = 5;
        let linkAttempt = 0;
        while (linkAttempt < maxLinkAttempts) {
          try {
            // 親ディレクトリの存在を都度保証
            try { await createSecureDirectory(path.dirname(finalDir)); } catch {}
            await fs.promises.symlink(storageFinalDir, finalDir, 'dir');
            break;
          } catch (e: unknown) {
            // 既に存在 → 置き換え
            if (e && typeof e === 'object' && 'code' in e && (e as {code: string}).code === 'EEXIST') {
              try { await fs.promises.rm(finalDir, { recursive: true, force: true }); } catch {}
              continue; // 次のループで再試行
            }
            // 親が消えた/一時的な不整合 → 親を再作成してリトライ
            if (e && typeof e === 'object' && 'code' in e && 
                ((e as {code: string}).code === 'ENOENT' || (e as {code: string}).code === 'ENOTDIR')) {
              linkAttempt++;
              if (linkAttempt >= maxLinkAttempts) throw e;
              await new Promise((r) => setTimeout(r, 10 * linkAttempt));
              continue;
            }
            // Windows等での権限問題 → コピーでフォールバック
            if (e && typeof e === 'object' && 'code' in e && (e as {code: string}).code === 'EPERM') {
              try { await createSecureDirectory(finalDir); } catch {}
              const files = await fs.promises.readdir(storageFinalDir);
              for (const file of files) {
                const src = path.join(storageFinalDir, file);
                const dst = path.join(finalDir, file);
                const content = await fs.promises.readFile(src);
                await fs.promises.writeFile(dst, content, { mode: 0o600 });
              }
              break;
            }
            throw e;
          }
        }
      }

      // リネーム後の可視性確認（ディレクトリ + metadata.json の両方）
      let postRenameAttempts = 0;
      const maxPostRenameAttempts = 7;
      const finalMetadataPath = path.join(finalDir, 'metadata.json');
      while (postRenameAttempts < maxPostRenameAttempts) {
        try {
          await fs.promises.access(finalDir, fs.constants.F_OK);
          // metadata.json の可視性と読み取り確認
          const content = await fs.promises.readFile(finalMetadataPath, 'utf8');
          // JSONとしてパースできれば十分に可視
          JSON.parse(content);
          debugLog('post-rename metadata visible', { finalMetadataPath, attempts: postRenameAttempts + 1 });
          break;
        } catch (accessError: unknown) {
          postRenameAttempts++;
          if (postRenameAttempts >= maxPostRenameAttempts) {
            throw accessError;
          }
          await new Promise((resolve) => setTimeout(resolve, 10 * postRenameAttempts));
        }
      }

      return { cacheKey, chunkCount: chunks.length, totalSize: totalTokens };
    } catch (error: unknown) {
      // 失敗時のクリーンアップ
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        Logger.warn(`Failed to cleanup temp directory: ${tempDir}`, cleanupError);
      }

      if (error && typeof error === 'object' && 'code' in error && 
          ((error as {code: string}).code === 'ENOENT' || (error as {code: string}).code === 'ENOTDIR')) {
        debugLog('saveChunks transient fs error, retrying', { code: (error as {code: string}).code, attempt });
        attempt++;
        if (attempt < maxOverallAttempts) {
          await new Promise((r) => setTimeout(r, 15 * attempt));
          continue; // 外部削除に遭遇。全体を再試行
        }
      }
      throw error;
    }
  }
  // 全ての試行が失敗した場合
  throw new Error('Failed to save chunks after retries');
}

/**
 * 指定されたチャンクを取得
 */
export async function getChunk(cacheKey: string, chunkIndex: number, isRetry = false): Promise<string | null> {
  if (chunkIndex < 1 || !Number.isInteger(chunkIndex) || isNaN(chunkIndex)) {
    throw new Error('Chunk index must be 1 or greater');
  }

  try {
    const cacheDir = validateCachePath(cacheKey);

    // メタデータの確認（再試行付き）
    const metadataPath = path.join(cacheDir, 'metadata.json');
    let metadata: CacheMetadata | undefined;
    let readAttempts = 0;
    const maxReadAttempts = 10;
    
    while (readAttempts < maxReadAttempts) {
      try {
        const metadataContent = await fs.promises.readFile(metadataPath, 'utf8');
        metadata = JSON.parse(metadataContent);
        break;
      } catch (readError) {
        readAttempts++;
        debugLog('getChunk metadata read retry', { cacheKey, readAttempts });
        if (readAttempts >= maxReadAttempts) {
          throw readError;
        }
        await new Promise(resolve => setTimeout(resolve, 20 * readAttempts));
      }
    }
    
    if (!metadata) {
      throw new Error('Failed to read metadata after retries');
    }

    // TTL確認
    const expiresAt = new Date(metadata.expiresAt);
    if (new Date() > expiresAt) {
      // 期限切れキャッシュの削除
      await fs.promises.rm(cacheDir, { recursive: true, force: true });
      throw new Error(`Cache expired: TTL expired at ${expiresAt.toISOString()}`);
    }

    // インデックス範囲確認
    if (chunkIndex > metadata.totalChunks) {
      return null; // 範囲外の場合はnullを返す
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
    // フォールバック: 公開リンクが消えている場合、ストレージ側を探索して再生成
    const isFsNotFound = (error instanceof Error && 'code' in error && (error as any).code && ((error as any).code === 'ENOENT' || (error as any).code === 'ENOTDIR'))
      || (error && typeof error === 'object' && 'code' in error && ((error as any).code === 'ENOENT' || (error as any).code === 'ENOTDIR'));
    if (isFsNotFound && !isRetry) {
      try {
        const restored = await restorePublicLink(cacheKey);
        if (restored) {
          // リンクを再生成できたので、もう一度読み直す（再帰防止でisRetryをtrueに）
          return await getChunk(cacheKey, chunkIndex, true);
        }
      } catch {}
      throw new Error(`Cache not found: directory or metadata file does not exist for cache ID '${cacheKey}'`);
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
    const baseDir = getPublicBaseDir();
    await createSecureDirectory(baseDir);
    const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('temp-')) {
        continue; // 一時ディレクトリはスキップ
      }
      if (!isValidUUID(entry.name)) {
        continue; // 無効なUUIDディレクトリはスキップ
      }

      try {
        const cacheDir = path.join(baseDir, entry.name);
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
        Logger.warn(`Failed to process cache directory: ${entry.name}`, error);
      }
    }
  } catch (error) {
    Logger.error('Failed to cleanup expired caches:', error);
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
    const baseDir = getPublicBaseDir();
    await createSecureDirectory(baseDir);
    const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (isValidUUID(entry.name)) {
        try {
          const cacheDir = path.join(baseDir, entry.name);
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
          Logger.warn(`Failed to get stats for directory: ${entry.name}`, error);
        }
      }
    }
  } catch (error) {
    // 統計取得の失敗は警告レベル
    Logger.warn('Failed to get cache stats:', error);
  }

  return {
    fileCount,
    totalSize,
    // 統計のパスはルートを返す（テスト期待値に合わせる）
    dir: CACHE_BASE_ROOT,
    ttlMs: TTL_MS
  };
}

/**
 * 容量制限の強制（古いキャッシュから削除）
 */
async function enforceCapacityLimits(): Promise<void> {
  try {
    const baseDir = getPublicBaseDir();
    await createSecureDirectory(baseDir);
    const entries = await fs.promises.readdir(baseDir, { withFileTypes: true });
    const validCaches: Array<{ name: string; createdAt: Date }> = [];

    // 有効なキャッシュディレクトリの収集
    for (const entry of entries) {
      if (entry.name.startsWith('temp-') || !isValidUUID(entry.name)) {
        continue; // 無効 or temp はスキップ
      }

      try {
        const metadataPath = path.join(baseDir, entry.name, 'metadata.json');
        const metadataContent = await fs.promises.readFile(metadataPath, 'utf8');
        const metadata: CacheMetadata = JSON.parse(metadataContent);
        
        validCaches.push({
          name: entry.name,
          createdAt: new Date(metadata.createdAt)
        });
      } catch (error) {
        // メタデータが読めないディレクトリは削除対象
        try {
          await fs.promises.rm(path.join(baseDir, entry.name), { recursive: true, force: true });
        } catch (deleteError) {
          Logger.warn(`Failed to delete invalid cache directory: ${entry.name}`, deleteError);
        }
      }
    }

    // ディレクトリ数制限
    if (validCaches.length > MAX_CACHE_DIRS) {
      validCaches.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const toDelete = validCaches.slice(0, validCaches.length - MAX_CACHE_DIRS);
      
      for (const cache of toDelete) {
        try {
          await fs.promises.rm(path.join(baseDir, cache.name), { recursive: true, force: true });
        } catch (error) {
          Logger.warn(`Failed to delete cache directory: ${cache.name}`, error);
        }
      }
    }

    // サイズ制限は高水準のディレクトリ数制御を優先し、
    // サイズ上限チェックは多数ディレクトリ時のみに限定して負荷を抑える
    if (validCaches.length > MAX_CACHE_DIRS) {
      const stats = await getCacheStats();
      if (stats.totalSize > MAX_CACHE_SIZE) {
        Logger.warn(`Cache size (${stats.totalSize} bytes) exceeds limit (${MAX_CACHE_SIZE} bytes)`);
      }
    }

  } catch (error) {
    Logger.warn('Failed to enforce capacity limits:', error);
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
        Logger.log(`Cleaned up ${deletedCount} expired cache entries`);
      }
    } catch (error) {
      Logger.error('Periodic cleanup failed:', error);
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
      Logger.log(`Startup cleanup: removed ${deletedCount} expired cache entries`);
    }
  } catch (error) {
    Logger.warn('Startup cache cleanup failed:', error);
  }
}
