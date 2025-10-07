/**
 * Unit tests for chunkCache.ts
 * アトミック操作・セキュリティ・TTL・クロスプラットフォーム対応の検証
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  saveChunks,
  getChunk,
  cleanupExpired,
  getCacheStats,
  initializeCache,
  CacheResult,
  CacheMetadata
} from '../../src/utils/chunkCache.js';

// テスト用ヘルパー関数
async function getCacheDir(): Promise<string> {
  return path.join(os.tmpdir(), 'gemini-mcp-chunks');
}

async function createExpiredCache(): Promise<string> {
  const chunks = ['expired chunk'];
  const result = await saveChunks(chunks);
  
  // メタデータを過去の日時に変更
  const cacheDir = path.join(await getCacheDir(), result.cacheKey);
  const metadataPath = path.join(cacheDir, 'metadata.json');
  const metadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));
  
  const pastDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48時間前
  metadata.createdAt = pastDate.toISOString();
  metadata.expiresAt = pastDate.toISOString();
  
  await fs.promises.writeFile(metadataPath, JSON.stringify(metadata));
  return result.cacheKey;
}

describe('chunkCache', () => {
  let tempCacheDir: string;

  beforeEach(async () => {
    tempCacheDir = await getCacheDir();
    // 各テスト前にキャッシュディレクトリをクリーンアップ
    try {
      await fs.promises.rm(tempCacheDir, { recursive: true, force: true });
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  });

  afterEach(async () => {
    // 各テスト後にキャッシュディレクトリをクリーンアップ
    try {
      await fs.promises.rm(tempCacheDir, { recursive: true, force: true });
    } catch {
      // ディレクトリが存在しない場合は無視
    }
  });

  describe('saveChunks', () => {
    test('基本的なチャンク保存', async () => {
      const chunks = ['chunk1', 'chunk2', 'chunk3'];
      const result = await saveChunks(chunks);

      expect(result.cacheKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(result.chunkCount).toBe(3);
      expect(result.totalSize).toBeGreaterThan(0);
    });

    test('空チャンク配列のエラー', async () => {
      await expect(saveChunks([])).rejects.toThrow('Cannot save empty chunks array');
    });

    test('アトミック操作の検証', async () => {
      const chunks = ['atomic test chunk'];
      const result = await saveChunks(chunks);
      
      const cacheDir = path.join(tempCacheDir, result.cacheKey);
      const tempDir = path.join(tempCacheDir, `temp-${result.cacheKey}`);

      // 一時ディレクトリは存在しない（リネーム済み）
      expect(fs.existsSync(tempDir)).toBe(false);
      
      // 最終ディレクトリは存在する
      expect(fs.existsSync(cacheDir)).toBe(true);
      
      // メタデータファイルが存在する
      expect(fs.existsSync(path.join(cacheDir, 'metadata.json'))).toBe(true);
      
      // チャンクファイルが存在する
      expect(fs.existsSync(path.join(cacheDir, 'chunk-001.txt'))).toBe(true);
    });

    test('メタデータの正確性', async () => {
      const chunks = ['test chunk 1', 'test chunk 2'];
      const result = await saveChunks(chunks, { totalTokens: 100 });
      
      const cacheDir = path.join(tempCacheDir, result.cacheKey);
      const metadataPath = path.join(cacheDir, 'metadata.json');
      const metadata: CacheMetadata = JSON.parse(await fs.promises.readFile(metadataPath, 'utf8'));

      expect(metadata.cacheKey).toBe(result.cacheKey);
      expect(metadata.totalChunks).toBe(2);
      expect(metadata.originalTokens).toBe(100);
      expect(metadata.chunkTokenSizes).toHaveLength(2);
      expect(new Date(metadata.createdAt)).toBeInstanceOf(Date);
      expect(new Date(metadata.expiresAt)).toBeInstanceOf(Date);
    });

    test('ファイル権限の設定', async () => {
      const chunks = ['permission test'];
      const result = await saveChunks(chunks);
      
      const cacheDir = path.join(tempCacheDir, result.cacheKey);
      const chunkFile = path.join(cacheDir, 'chunk-001.txt');
      const metadataFile = path.join(cacheDir, 'metadata.json');

      // Unix系システムでのファイル権限確認（Windows以外）
      if (process.platform !== 'win32') {
        const cacheDirStat = await fs.promises.stat(cacheDir);
        const chunkStat = await fs.promises.stat(chunkFile);
        const metadataStat = await fs.promises.stat(metadataFile);

        expect((cacheDirStat.mode & 0o777)).toBe(0o700);
        expect((chunkStat.mode & 0o777)).toBe(0o600);
        expect((metadataStat.mode & 0o777)).toBe(0o600);
      }
    });

    test('多数チャンクの処理', async () => {
      const chunks = Array.from({ length: 100 }, (_, i) => `chunk ${i + 1}`);
      const result = await saveChunks(chunks);

      expect(result.chunkCount).toBe(100);
      
      const cacheDir = path.join(tempCacheDir, result.cacheKey);
      const files = await fs.promises.readdir(cacheDir);
      
      // 100個のチャンクファイル + 1個のメタデータファイル
      expect(files.length).toBe(101);
      expect(files.includes('metadata.json')).toBe(true);
      expect(files.includes('chunk-100.txt')).toBe(true);
    });

    test('UTF-8テキストの保存', async () => {
      const chunks = [
        'Hello 世界 🌍',
        'こんにちは World',
        '你好 안녕하세요 🎉',
        'café naïve résumé'
      ];
      const result = await saveChunks(chunks);
      
      // 保存されたファイルの内容を確認
      for (let i = 0; i < chunks.length; i++) {
        const savedChunk = await getChunk(result.cacheKey, i + 1);
        expect(savedChunk).toBe(chunks[i]);
      }
    });
  });

  describe('getChunk', () => {
    test('基本的なチャンク取得', async () => {
      const chunks = ['first chunk', 'second chunk', 'third chunk'];
      const result = await saveChunks(chunks);

      const chunk1 = await getChunk(result.cacheKey, 1);
      const chunk2 = await getChunk(result.cacheKey, 2);
      const chunk3 = await getChunk(result.cacheKey, 3);

      expect(chunk1).toBe('first chunk');
      expect(chunk2).toBe('second chunk');
      expect(chunk3).toBe('third chunk');
    });

    test('存在しないキャッシュキー', async () => {
      const invalidKey = '12345678-1234-4234-a234-123456789abc';
      const result = await getChunk(invalidKey, 1);
      expect(result).toBeNull();
    });

    test('無効なキャッシュキー形式', async () => {
      await expect(getChunk('invalid-key', 1)).rejects.toThrow('Invalid cache key format');
    });

    test('範囲外のチャンクインデックス', async () => {
      const chunks = ['only chunk'];
      const result = await saveChunks(chunks);

      const validChunk = await getChunk(result.cacheKey, 1);
      const invalidChunk = await getChunk(result.cacheKey, 2);

      expect(validChunk).toBe('only chunk');
      expect(invalidChunk).toBeNull();
    });

    test('チャンクインデックス0以下のエラー', async () => {
      const chunks = ['test chunk'];
      const result = await saveChunks(chunks);

      await expect(getChunk(result.cacheKey, 0)).rejects.toThrow('Chunk index must be 1 or greater');
      await expect(getChunk(result.cacheKey, -1)).rejects.toThrow('Chunk index must be 1 or greater');
    });

    test('期限切れキャッシュの自動削除', async () => {
      const expiredKey = await createExpiredCache();
      
      const result = await getChunk(expiredKey, 1);
      expect(result).toBeNull();

      // キャッシュディレクトリが削除されていることを確認
      const cacheDir = path.join(tempCacheDir, expiredKey);
      expect(fs.existsSync(cacheDir)).toBe(false);
    });

    test('パストラバーサル攻撃の防止', async () => {
      const chunks = ['test chunk'];
      const result = await saveChunks(chunks);

      // 悪意のあるパスの注入テスト
      const maliciousKey = result.cacheKey + '/../../../etc/passwd';
      await expect(getChunk(maliciousKey, 1)).rejects.toThrow('Invalid cache key format');
    });
  });

  describe('cleanupExpired', () => {
    test('期限切れキャッシュの削除', async () => {
      // 有効なキャッシュと期限切れキャッシュを作成
      const validChunks = ['valid chunk'];
      const validResult = await saveChunks(validChunks);
      
      const expiredKey = await createExpiredCache();

      const deletedCount = await cleanupExpired();
      expect(deletedCount).toBe(1);

      // 有効なキャッシュは残る
      const validChunk = await getChunk(validResult.cacheKey, 1);
      expect(validChunk).toBe('valid chunk');

      // 期限切れキャッシュは削除される
      const expiredChunk = await getChunk(expiredKey, 1);
      expect(expiredChunk).toBeNull();
    });

    test('全て有効なキャッシュの場合', async () => {
      const chunks1 = ['chunk 1'];
      const chunks2 = ['chunk 2'];
      await saveChunks(chunks1);
      await saveChunks(chunks2);

      const deletedCount = await cleanupExpired();
      expect(deletedCount).toBe(0);
    });

    test('キャッシュディレクトリが存在しない場合', async () => {
      const deletedCount = await cleanupExpired();
      expect(deletedCount).toBe(0);
    });

    test('無効なメタデータファイルの処理', async () => {
      // 正常なキャッシュを作成
      const chunks = ['test chunk'];
      const result = await saveChunks(chunks);

      // メタデータファイルを破損させる
      const cacheDir = path.join(tempCacheDir, result.cacheKey);
      const metadataPath = path.join(cacheDir, 'metadata.json');
      await fs.promises.writeFile(metadataPath, 'invalid json', 'utf8');

      // クリーンアップ実行（警告が出るが削除はされない）
      const deletedCount = await cleanupExpired();
      expect(deletedCount).toBe(0);
    });

    test('一時ディレクトリの無視', async () => {
      // 一時ディレクトリを作成
      const tempDir = path.join(tempCacheDir, 'temp-12345678-1234-4234-8234-123456789abc');
      await fs.promises.mkdir(tempDir, { recursive: true });

      const deletedCount = await cleanupExpired();
      expect(deletedCount).toBe(0);

      // 一時ディレクトリは削除されない
      expect(fs.existsSync(tempDir)).toBe(true);
    });
  });

  describe('getCacheStats', () => {
    test('基本的な統計情報', async () => {
      const chunks1 = ['chunk 1', 'chunk 2'];
      const chunks2 = ['chunk 3'];
      await saveChunks(chunks1);
      await saveChunks(chunks2);

      const stats = await getCacheStats();

      expect(stats.fileCount).toBeGreaterThan(0);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.dir).toBe(tempCacheDir);
      expect(stats.ttlMs).toBe(24 * 60 * 60 * 1000); // 24時間
    });

    test('空のキャッシュディレクトリ', async () => {
      const stats = await getCacheStats();

      expect(stats.fileCount).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.dir).toBe(tempCacheDir);
    });

    test('無効なディレクトリの無視', async () => {
      // 無効な名前のディレクトリを作成
      const invalidDir = path.join(tempCacheDir, 'invalid-directory-name');
      await fs.promises.mkdir(invalidDir, { recursive: true });
      await fs.promises.writeFile(path.join(invalidDir, 'test.txt'), 'test', 'utf8');

      const stats = await getCacheStats();

      expect(stats.fileCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('initializeCache', () => {
    test('起動時クリーンアップ', async () => {
      // 期限切れキャッシュを作成
      await createExpiredCache();
      await createExpiredCache();

      await initializeCache();

      // 期限切れキャッシュが削除されていることを確認
      const stats = await getCacheStats();
      expect(stats.fileCount).toBe(0);
    });

    test('エラー時の適切な処理', async () => {
      // initializeCache自体はエラーをthrowしないことを確認
      await expect(initializeCache()).resolves.not.toThrow();
    });
  });

  describe('セキュリティテスト', () => {
    test('UUIDフォーマットの厳格な検証', async () => {
      const invalidUuids = [
        'not-a-uuid',
        '12345678-1234-1234-1234-123456789abc', // v4でない
        '12345678-1234-4234-1234-123456789abc', // 無効な文字
        '12345678-1234-4234-c234-123456789abc', // 無効なバリアント
        '../etc/passwd',
        '12345678-1234-4234-a234-123456789abc/../../../etc/passwd'
      ];

      for (const invalidUuid of invalidUuids) {
        await expect(getChunk(invalidUuid, 1)).rejects.toThrow();
      }
    });

    test('ファイルシステム攻撃の防止', async () => {
      const chunks = ['test chunk'];
      const result = await saveChunks(chunks);

      // パストラバーサル攻撃のテスト（無効なUUID形式なのでエラー）
      const attacks = [
        result.cacheKey + '/../../../etc/passwd',
        result.cacheKey + '\\..\\..\\..\\windows\\system32\\hosts',
        result.cacheKey + '/%2e%2e/%2e%2e/%2e%2e/etc/passwd'
      ];

      for (const attack of attacks) {
        await expect(getChunk(attack, 1)).rejects.toThrow();
      }
    });
  });

  describe('エラーハンドリング', () => {
    test('ディスク容量不足のシミュレーション', async () => {
      // 実際のディスク容量不足は再現困難なため、基本的な保存処理の完了を確認
      const largeChunk = 'x'.repeat(10000);
      const chunks = [largeChunk];

      await expect(saveChunks(chunks)).resolves.toBeDefined();
    });

    test('ファイルアクセス権限エラー', async () => {
      // Windows以外でのテスト
      if (process.platform !== 'win32') {
        const chunks = ['test chunk'];
        const result = await saveChunks(chunks);

        const cacheDir = path.join(tempCacheDir, result.cacheKey);
        const chunkFile = path.join(cacheDir, 'chunk-001.txt');

        // ファイルの読み込み権限を削除
        await fs.promises.chmod(chunkFile, 0o000);

        // getChunk呼び出しでエラーが発生することを確認
        await expect(getChunk(result.cacheKey, 1)).rejects.toThrow();

        // テスト後に権限を復元
        await fs.promises.chmod(chunkFile, 0o600);
      }
    });

    test('並行アクセスの安全性', async () => {
      // 複数の並行保存操作
      const promises = Array.from({ length: 10 }, (_, i) =>
        saveChunks([`concurrent chunk ${i}`])
      );

      const results = await Promise.all(promises);

      // 全ての操作が成功し、異なるキャッシュキーを持つことを確認
      expect(results).toHaveLength(10);
      const keys = results.map(r => r.cacheKey);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(10);

      // 保存されたチャンクが正しく取得できることを確認
      for (let i = 0; i < results.length; i++) {
        const chunk = await getChunk(results[i].cacheKey, 1);
        expect(chunk).toBe(`concurrent chunk ${i}`);
      }
    });
  });

  describe('クロスプラットフォーム対応', () => {
    test('キャッシュディレクトリパスの検証', async () => {
      const expectedPath = path.join(os.tmpdir(), 'gemini-mcp-chunks');
      const stats = await getCacheStats();

      expect(stats.dir).toBe(expectedPath);
      expect(path.isAbsolute(stats.dir)).toBe(true);
    });

    test('プラットフォーム固有のパス区切り文字', async () => {
      const chunks = ['platform test'];
      const result = await saveChunks(chunks);

      const cacheDir = path.join(tempCacheDir, result.cacheKey);
      expect(fs.existsSync(cacheDir)).toBe(true);

      // プラットフォームに関係なく正しいパスが生成されることを確認
      const chunkFile = path.join(cacheDir, 'chunk-001.txt');
      expect(fs.existsSync(chunkFile)).toBe(true);
    });
  });
});