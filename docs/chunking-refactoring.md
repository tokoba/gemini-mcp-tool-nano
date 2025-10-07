# changeModeの完全廃止と新チャンキング機能実装計画

## 概要

本プロジェクトの`changeMode`機能には重大なセキュリティ脆弱性と設計上の問題が発見されました。そのため、`changeMode`を完全に廃止し、より汎用的で安全なチャンキング機能に置き換える大規模なリファクタリングを実施します。

## 現状の問題点

### changeModeの問題
1. **重大なセキュリティ脆弱性**
   - 正規表現ReDoS攻撃の可能性
   - パスインジェクション脆弱性
   - 無制限メモリ使用によるDoS攻撃リスク

2. **機能的制限**
   - コード編集専用で汎用性に欠ける
   - 質問・調査タスクに不適切な出力
   - Geminiの出力形式に過度に依存

3. **保守性の問題**
   - 複雑な正規表現パーシング
   - 脆弱なエラーハンドリング
   - テストカバレッジ不足

## 新設計方針

### 設計原則
- **セキュリティファースト**: 脆弱性を根本的に排除
- **汎用性**: あらゆる種類のGemini応答に対応
- **堅牢性**: 予測可能で安定した動作
- **多言語対応**: Unicode境界を考慮した処理

### 技術的決定事項

#### 1. チャンキング戦略: 段落区切り（Recursive）
**選択理由**: 
- 意味的まとまりを保持
- コード、マークダウン、自然言語すべてに最適
- ユーザー体験の向上

**実装方法**:
```
1. 段落区切り（\n\n）で分割
2. トークン数超過時は改行（\n）で再分割  
3. さらに超過時は文単位で分割
4. 最終的には行単位まで分割
```

#### 2. トークン計算: tiktoken使用
**選択理由**:
- 文字数近似では多言語で大きな誤差
- 特に日本語では正確性が重要
- デファクトスタンダードライブラリ

**実装**:
- 実トークン数による正確な20,000トークン分割
- モデル別エンコーディング対応

#### 3. ファイルベースキャッシュ
**選択理由**:
- インメモリキャッシュの制限解消
- 永続化による安定性向上
- 大容量応答への対応

**実装**:
- `os.tmpdir()`ベースの安全なファイル管理
- UUID基準cacheKey生成
- 24時間TTL自動クリーンアップ

## 実装計画

### フェーズ1: 依存関係準備
**期間**: 1日
**作業内容**:
- [ ] `npm install tiktoken` 実行
- [ ] 型定義確認
- [ ] プロジェクト設定更新

### フェーズ2: 新ユーティリティ作成  
**期間**: 3-4日
**作業内容**:

#### `src/utils/tokenizer.ts`
```typescript
// トークン計算機能
export interface TokenizerConfig {
  model: string;
  encoding?: string;
}

export function countTokens(text: string, config?: TokenizerConfig): number;
export function splitByTokens(text: string, maxTokens: number, config?: TokenizerConfig): string[];
```

#### `src/utils/chunker.ts`  
```typescript
// 段落区切りチャンキング
export interface ChunkingOptions {
  maxTokens: number;
  maxChunks: number;
  preserveStructure: boolean;
}

export function chunkText(text: string, options: ChunkingOptions): string[];
```

#### `src/utils/chunkCache.ts`（完全リライト）
```typescript
// ファイルベースキャッシュ
export interface CacheResult {
  cacheKey: string;
  chunkCount: number;
  totalSize: number;
}

export function saveChunks(chunks: string[]): CacheResult;
export function getChunk(cacheKey: string, chunkIndex: number): string | null;
export function cleanupExpired(): Promise<number>;
```

### フェーズ3: changeMode完全除去
**期間**: 2日
**作業内容**:

#### 削除対象ファイル
- [x] `src/utils/changeModeChunker.ts`
- [x] `src/utils/changeModeParser.ts` 
- [x] `src/utils/changeModeTranslator.ts`

#### 依存関係クリーンアップ
- [ ] `geminiExecutor.ts`からchangeMode関連削除
- [ ] `ask-gemini.tool.ts`からchangeMode引数削除
- [ ] 全import文、型定義、関数呼び出し除去

### フェーズ4: ツール機能改修
**期間**: 3日
**作業内容**:

#### `ask-gemini.tool.ts`改修
```typescript
// changeModeパラメータ削除
const askGeminiArgsSchema = z.object({
  prompt: z.string().min(1).describe("..."),
  model: z.string().default("gemini-2.5-pro").describe("..."),
  sandbox: z.boolean().default(false).describe("..."),
  // changeMode削除
});
```

**新機能**:
- 応答の自動チャンキング判定
- チャンク情報を含む応答フォーマット
- ユーザーへの取得指示

#### `fetch-chunk.tool.ts`改修
```typescript
// 簡潔な実装に変更
export const fetchChunkTool: UnifiedTool = {
  name: "fetch-chunk",
  description: "Retrieve cached chunks from large responses",
  zodSchema: fetchChunkArgsSchema,
  execute: async (args) => {
    const chunk = getChunk(args.cacheKey, args.chunkIndex);
    if (!chunk) {
      throw new Error(`Chunk not found: ${args.cacheKey}#${args.chunkIndex}`);
    }
    return chunk;
  }
};
```

#### `cleanup-cache.tool.ts`新規作成
```typescript
// 手動キャッシュクリーンアップ
export const cleanupCacheTool: UnifiedTool = {
  name: "cleanup-cache", 
  description: "Manually clean up response cache files",
  execute: async () => {
    const cleaned = await cleanupExpired();
    const stats = getCacheStats();
    return `Cleaned ${cleaned} expired files. Current: ${stats.fileCount} files, ${stats.totalSize} bytes`;
  }
};
```

### フェーズ5: テスト・検証
**期間**: 2日
**作業内容**:
- [ ] 新ユーティリティの単体テスト作成
- [ ] 大規模応答での動作検証  
- [ ] 多言語テキストでのチャンキング検証
- [ ] エラーハンドリング・境界値テスト
- [ ] パフォーマンステスト

## 技術仕様詳細

### ファイル構造

#### Windows環境
```
%TEMP%\gemini-mcp-chunks\
├── {uuid-cacheKey}\
│   ├── chunk-001.txt
│   ├── chunk-002.txt  
│   ├── chunk-003.txt
│   └── metadata.json
└── .tmp-{uuid}/          # アトミック生成用一時ディレクトリ
```

想定パス例: `C:\Users\username\AppData\Local\Temp\gemini-mcp-chunks\`

#### Linux環境  
```
/tmp/gemini-mcp-chunks/
├── {uuid-cacheKey}/
│   ├── chunk-001.txt
│   ├── chunk-002.txt  
│   ├── chunk-003.txt
│   └── metadata.json
└── .tmp-{uuid}/          # アトミック生成用一時ディレクトリ
```

想定パス例: `/tmp/gemini-mcp-chunks/` (Linux/macOS共通)

### metadata.json形式
```json
{
  "cacheKey": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "totalChunks": 3,
  "createdAt": "2024-01-15T10:30:00.000Z", 
  "expiresAt": "2024-01-16T10:30:00.000Z",
  "originalSize": 65432,
  "chunkSizes": [20000, 20000, 25432]
}
```

### 応答フォーマット
```
[RESPONSE CHUNKED] Gemini's response was split into 3 chunks due to size.
Cache Key: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Total Size: 65,432 characters

To retrieve chunks, use:
fetch-chunk cacheKey=a1b2c3d4-e5f6-7890-abcd-ef1234567890 chunkIndex=1

[CHUNK 1 of 3]
{最初のチャンク内容}
```

### エラーハンドリング戦略
1. **入力検証**: 不正なcacheKey、chunkIndex値の検出
2. **ファイル操作**: 権限エラー、ディスク容量不足への対応
3. **トークン計算**: エンコーディングエラーの処理
4. **分割失敗**: 最小単位まで分割できない場合の処理

## セキュリティ強化

### 対策済み脆弱性
1. **ReDoS攻撃**: 正規表現削除により根本解決
2. **パスインジェクション**: UUID基準ファイル名で解決
3. **メモリ枯渇**: トークン数制限とチャンク数上限で解決
4. **コマンドインジェクション**: ファイルベース処理で解決

### 新たなセキュリティ機能
1. **ファイル権限**: 0o600で他ユーザーアクセス防止
2. **サイズ制限**: 最大チャンク数・ファイルサイズ制限
3. **TTL自動削除**: 古いキャッシュの確実な削除
4. **入力サニタイズ**: 全ユーザー入力の検証
5. **アトミックキャッシュ生成**: 不完全状態を防ぐ2段階書き込み

### アトミックキャッシュ生成プロセス
```
1. 一時ディレクトリ生成: .tmp-{uuid}/
2. 全チャンクファイルとmetadata.jsonを一時ディレクトリに書き込み完了
3. 権限設定適用（0o700/0o600）
4. 一時ディレクトリを最終的なUUIDディレクトリにリネーム
5. 失敗時は一時ディレクトリを削除
```

**利点**:
- 書き込み途中での読み取り防止
- 不完全なキャッシュデータの回避
- システム障害時の整合性保持

## 期待効果

### 機能面
- **汎用性**: あらゆるGemini応答に対応
- **意味保持**: 自然な境界での分割
- **多言語対応**: Unicode完全対応
- **大規模対応**: 無制限サイズの応答処理

### 技術面  
- **セキュリティ**: 脆弱性完全解決
- **安定性**: ファイルベース永続化
- **保守性**: シンプルで理解しやすい実装
- **テスト性**: 単体テスト可能な設計

### ユーザー体験
- **透明性**: チャンキング状況の明確な表示
- **制御性**: 手動キャッシュ管理オプション
- **予測性**: 一貫した動作保証
- **効率性**: 最適化されたトークン使用

## リスク分析と対策

### 実装リスク
1. **tiktoken依存**: ライブラリ更新への追従
   - **対策**: 抽象化レイヤーで依存度最小化

2. **ファイルI/O性能**: 大量チャンクでの性能劣化
   - **対策**: アトミック書き込み + 非同期処理での最適化

3. **ディスク容量**: キャッシュ蓄積による容量圧迫  
   - **対策**: TTL + 手動クリーンアップのデュアル管理

4. **クロスプラットフォーム差異**: Windows/Linux環境での挙動違い
   - **対策**: Node.jsのos.tmpdir()による統一API、権限設定の環境別対応

### 移行リスク
1. **後方互換性**: 既存キャッシュの無効化
   - **対策**: 段階的移行とアナウンス

2. **ユーザー体験変化**: changeModeユーザーの混乱
   - **対策**: 詳細なドキュメント提供

## 成功指標

### 技術指標
- [ ] セキュリティ脆弱性0件
- [ ] テストカバレッジ90%以上
- [ ] 大規模応答（100KB+）の安定処理
- [ ] メモリ使用量50%削減

### ユーザー指標  
- [ ] エラー発生率90%削減
- [ ] 応答時間の改善
- [ ] ユーザーサポート問い合わせ削減

## 今後の拡張可能性

### 短期拡張
- カスタムチャンク分割戦略
- 圧縮によるディスク使用量削減
- 並列チャンク処理

### 長期拡張
- クロスプラットフォーム対応
- クラウドキャッシュ連携
- AI支援によるスマート分割

---

## 実装開始

この計画書の承認後、フェーズ1から順次実装を開始します。各フェーズの完了時にレビューとテストを実施し、品質を保証しながら進めていきます。

---

# 付録A: 詳細設計・実務ガイド（改訂）

本付録は、changeMode廃止と新チャンキング/キャッシュ機能への移行を、実装担当者が迷わず進められる粒度で具体化した詳細設計です。目的、スコープ、段階的な作業手順、API仕様、テスト戦略、移行上の注意点、受け入れ基準を明確化します。

## 1. 目的と非目的（スコープ定義）

- 目的
  - changeMode機能（構造化編集）を安全上の理由で完全撤廃する。
  - Geminiの任意応答を「一定トークン数以下」で段落優先にチャンキングし、ファイルベースでキャッシュする仕組みを導入する。
  - MCPクライアントからは「大応答時はチャンク化され、fetch-chunkで続きが取得できる」という単純なUXを提供する。

- 非目的
  - 旧changeModeの編集適用や編集フォーマットの維持・互換は対象外。
  - LLM応答の再構造化や要約など分析的後処理は行わない（薄いヘッダのみ）。

## 2. 現行コードの依存関係マッピング（着手前に必読）

- changeMode依存（削除対象・影響大）
  - `src/utils/geminiExecutor.ts`
    - `changeMode`分岐/`processChangeModeOutput()`/`changeMode*`系import（parser/chunker/translator/chunkCache依存）
  - `src/tools/ask-gemini.tool.ts`
    - zod引数: `changeMode`, `chunkIndex`, `chunkCacheKey`
    - `processChangeModeOutput` 分岐
  - `src/tools/fetch-chunk.tool.ts`
    - `changeModeTranslator`を使った表示装飾（編集向け）
  - `src/utils/changeModeParser.ts`, `src/utils/changeModeChunker.ts`, `src/utils/changeModeTranslator.ts`
    - 旧処理の中核（完全削除）
  - `src/utils/chunkCache.ts`
    - 旧changeMode用（EditChunk配列を1ファイルに保存）。新仕様へ全面置換。
  - `src/constants.ts`
    - `ToolArguments` に `changeMode`, `chunkIndex`, `chunkCacheKey` が残存
  - ログ
    - `src/utils/logger.ts` に changeMode表示あり

これらは順序依存があるため、「新機能の導入 → 呼び出し切替 → 旧コード削除」の順で実施すると安全です。

## 3. 作業ブレークダウン（ステップと目的）

1) 新チャンカー実装（目的: 段落優先の安定分割）
   - 追加: `src/utils/chunker.ts`
   - 方針: CRLF正規化 → 段落(`\n\n`)で分割 → 各段落が閾値超過なら行(`\n`)で再分割 → なお超過は固定長スライスで分割
   - 目的: トークンベースで意味的まとまりを最大限保持し、あらゆる言語で破綻しない堅牢な分割を実現

2) 新キャッシュ実装（目的: 大応答の永続・取得の単純化）
   - 置換: `src/utils/chunkCache.ts`（全面リライト）
   - 仕様: `/tmp/gemini-mcp-chunks/{uuid}/chunk-001.txt` + `metadata.json`、TTL=24h、権限強制(ディレクトリ0o700/ファイル0o600)
   - 目的: 大きな応答でも安定して保存/取得でき、セキュアで可観測な仕組みを提供

3) askツール改修（目的: changeMode撤廃＋自動チャンキング）
   - 更新: `src/tools/ask-gemini.tool.ts`（zodから旧引数削除、実行後に新チャンカーと新キャッシュを適用）
   - 返却: 非分割なら素の応答、分割なら [RESPONSE CHUNKED] + cacheKey + 取得手順 + [CHUNK 1 of N] を返す
   - 目的: 利用者に破壊的な行動変更を要求せず、自然に大出力を扱えるようにする

4) fetch-chunkツール改修（目的: 汎用チャンク取得の単純化）
   - 更新: `src/tools/fetch-chunk.tool.ts`（旧changeMode前提を除去し、`getChunk(cacheKey, index)`の結果のみ返す）
   - 目的: 装飾を排し、どのような応答でも素直に続きを取得できる最小実装にする

5) 旧changeMode実装の完全削除（目的: 脆弱性・負債の除去）
   - 削除: `src/utils/changeMode*.ts` 一式
   - 更新: `src/utils/geminiExecutor.ts` からchangeMode分岐＆`processChangeModeOutput`削除
   - 更新: `src/constants.ts` から旧フィールド削除
   - 更新: `src/utils/logger.ts` のchangeMode表記を削除/中立化

6) ドキュメント更新（目的: 利用者/開発者への周知と合意形成）
   - 本ファイル・README・CLAUDE.md の整合更新
   - 破壊的変更（changeMode削除）についての告知と回避策（fetch-chunk利用）

## 4. 新API仕様（ドラフト）

### 4.1 chunker.ts

```ts
export interface ChunkingOptions {
  maxTokens: number;           // 1チャンクの最大トークン数
  maxChunks?: number;          // 緊急遮断用（未指定推奨）
  preserveStructure?: boolean; // 段落・行優先分割を有効化（既定: true）
}

export function chunkText(text: string, options: ChunkingOptions): string[];
```

参考アルゴリズム（疑似コード）:

```
normalizeCRLF(text)
if countTokens(text) <= maxTokens: return [text]

segments = splitByParagraph(text)              // '\n\n'
chunks = []
for seg in segments:
  if countTokens(seg) <= maxTokens: push(chunks, seg); continue
  lines = splitByLine(seg)                     // '\n'
  acc = ''
  for line in lines:
    if countTokens(acc + line + '\n') <= maxTokens: acc += line + '\n'
    else: push(chunks, acc); acc = line + '\n'
  if acc: push(chunks, acc)

// 万一の過大要素を固定長で最終分割
chunks = flatten(chunks.flatMap(c => countTokens(c) <= maxTokens ? [c] : sliceByTokenLimit(c, maxTokens)))
return chunks
```

備考:
- 多言語/絵文字を壊さないため、文字境界での分割を維持（サロゲートペアは文字列スライスで保持される）。
- tiktokenを使用した正確なトークン計算により、モデルの制限に合わせた最適な分割を実現。
- `Tokenizer`抽象により、将来的に他のトークナイザーライブラリに切替可能な拡張性を確保。

### 4.2 chunkCache.ts（新）

```ts
export interface CacheResult {
  cacheKey: string;   // uuid v4
  chunkCount: number;
  totalSize: number;  // トークン数
}

export function saveChunks(chunks: string[]): CacheResult;
export function getChunk(cacheKey: string, chunkIndex: number): string | null;
export function cleanupExpired(): Promise<number>;
export function getCacheStats(): { fileCount: number; totalSize: number; dir: string; ttlMs: number };
```

ファイル構造・metadata.jsonは本文の「技術仕様詳細」に準拠。`cacheKey`はUUID v4を採用し、パスインジェクションを回避。

### 4.3 ask-gemini.tool.ts（新挙動）

- 引数: `prompt: string`, `model?: string`, `sandbox?: boolean`
- 動作: CLI実行 → 出力文字列 → `chunkText`でトークン数判定 → 閾値超過時のみ `saveChunks` → 初回応答に以下を返却:

```
[RESPONSE CHUNKED] Gemini's response was split into N chunks due to size.
Cache Key: <uuid>
Total Size: <tokens> tokens

To retrieve chunks, use:
fetch-chunk cacheKey=<uuid> chunkIndex=1

[CHUNK 1 of N]
<chunk_1_contents>
```

- 非分割時は `Gemini response:\n<full_text>` を返却。

### 4.4 fetch-chunk.tool.ts（新挙動）

- 引数: `cacheKey: string`, `chunkIndex: number (>=1)`
- 動作: `getChunk` を呼び、見つからなければ `Chunk not found: <key>#<index>` を返す。装飾や編集向けヘッダは付与しない。

### 4.5 cleanup-cache.tool.ts（新規）

- 引数: なし
- 動作: `cleanupExpired()` 実行 → `getCacheStats()` で現状を整形して返却

## 5. セキュリティ設計

- **権限**: ディレクトリ`0o700`、ファイル`0o600`で作成。別ユーザからの読み取りを抑止。
- **入力検証**: `cacheKey` はUUID v4のフォーマット検証。`chunkIndex` は `[1..N]` 範囲チェック。
- **パス結合**: ユーザー入力をそのままパス結合しない。適切なベースパス以外を指し示せない実装にする。
- **容量対策**: TTL=24h、自動クリーンアップ、最大ディレクトリ数/総容量の上限を設定。
- **ログ**: 本文は記録しない。長文は末尾プレビューのみ（既存の150文字プレビューを踏襲）。
- **アトミック書き込み**: 一時ディレクトリでの完全書き込み後、最終パスにリネーム。

### クロスプラットフォーム対応
```typescript
// Node.jsのos.tmpdir()を使用したベースパス取得
const baseDir = path.join(os.tmpdir(), 'gemini-mcp-chunks');

// Windows: C:\Users\username\AppData\Local\Temp\gemini-mcp-chunks
// Linux:   /tmp/gemini-mcp-chunks  
// macOS:   /var/folders/.../T/gemini-mcp-chunks
```

### アトミック生成フロー
```typescript
1. tempDir = path.join(baseDir, `.tmp-${uuid()}`);
2. await fs.mkdir(tempDir, { recursive: true, mode: 0o700 });
3. 全チャンクファイル + metadata.json書き込み完了
4. await fs.chmod(各ファイル, 0o600);
5. finalDir = path.join(baseDir, cacheKey);
6. await fs.rename(tempDir, finalDir);  // アトミック操作
```

## 6. テスト戦略（詳細）

- 単体テスト
  - `chunker.ts`
    - 小応答（閾値未満）→ チャンク1
    - 大応答（段落/行/固定長の各ケース）→ 期待通り分割
    - 多言語/絵文字/CRLF混在 → 文字化けなし、境界破壊なし
    - 空テキスト/空行のみ/極端に長い1行 → 劣化せず分割
  - `chunkCache.ts`
    - save/get（1-based index）
    - TTL切れ → 取得不可
    - metadata破損/欠損 → 予防的削除 + 取得不可
    - 権限エラー（モック）→ 例外伝播・ログ
    - 上限超過（ファイル数/容量）→ 古いキャッシュが削除される

- 結合テスト（ツール）
  - `ask`
    - 小応答 → 非分割返却
    - 境界サイズ → 分割/非分割の閾値挙動
    - 大応答 → [RESPONSE CHUNKED] 形式、`cacheKey` 付与、`[CHUNK 1 of N]` 添付
  - `fetch-chunk`
    - 正常取得（1..N）
    - 範囲外/存在しないキー/TTL切れ → 適切なエラー文言
  - `cleanup-cache`
    - 戻り値に削除件数と現状サマリ

- パフォーマンス/負荷
  - 100KB～数MB級の連続保存・取得で所要時間とメモリを計測（目標: 応答性を阻害しない）

## 7. 受け入れ基準（Acceptance Criteria）

- 旧changeModeのファイルと分岐が全廃されている（grepで検出0）。
- 大応答時に `[RESPONSE CHUNKED]` 形式で返却され、`fetch-chunk` で全チャンクを完全再現できる。
- キャッシュは24hで自動削除され、壊れたメタデータは安全に自己回復（削除）する。
- 主要ユーティリティに単体テストがあり、閾値ケース・多言語ケース・TTL/エラーケースを網羅。
- ドキュメント（本書、README、CLAUDE.md）がchangeMode削除後の挙動に整合。

## 8. ロールアウトと移行上の注意

- 破壊的変更: `ask` の引数から `changeMode`, `chunkIndex`, `chunkCacheKey` を削除。既存クライアントは zod によりエラーとなるため、リリースノートで明記。
- 回避策: 大応答は自動的にチャンク化され、`fetch-chunk` で続きを取得可能。利用者の行動変更は最小限。
- バージョニング: マイナー/メジャーのいずれかで公開。既存ユーザー影響度を鑑み、メジャーを推奨。

## 9. リスクと緩和

- トークン化差異: モデルやエンコーディングの差により、同一文字列でもトークン数がわずかに変動する可能性。
  - 緩和: モデル→エンコーディングのマッピングを明示化・固定。`token-counter`のバージョンを固定し、閾値周辺でのオフバイワンを許容（安全側へ丸め）。
- tiktoken依存: ネイティブ/WASM初期化コストや将来の仕様変更に追従が必要。
  - 緩和: `tokenizer.ts` を抽象レイヤーとして設計し、互換実装への切替余地を確保。初期化失敗時はフォールバック（固定長分割）で継続。
- ディスク圧迫: 長時間・高頻度の大応答蓄積
  - 緩和: TTLと上限のデュアル制御、`cleanup-cache` の提供
- ユーザー混乱: changeMode廃止
  - 緩和: ドキュメントと返却ヘッダの明確表示、移行手順の明記

## 10. 実装順序の推奨（参考）

1) `chunker.ts` 追加 → 単体テスト
2) `chunkCache.ts` 置換 → 単体テスト
3) `ask-gemini.tool.ts` を新経路に切替（返却整形含む）
4) `fetch-chunk.tool.ts` を簡素化
5) `geminiExecutor.ts` から changeMode 関連を削除
6) 旧 `changeMode*.ts` 削除
7) `constants.ts`/`logger.ts` の整合
8) ドキュメント更新・サンプル出力整備

---

# 付録B: データフロー（概念図）

```
ask-gemini.tool
  └─ executeGeminiCLI(prompt) → rawText
     └─ chunkText(rawText, maxTokens)
        ├─ [<= max] 返却: "Gemini response:\n<rawText>"
        └─ [>  max] saveChunks(chunks)
             └─ { cacheKey, N }
                 返却: [RESPONSE CHUNKED] + cacheKey + [CHUNK 1 of N]

fetch-chunk.tool
  └─ getChunk(cacheKey, i) → chunk_i | null
```

---

# 付録C: メッセージ例（利用者向け）

大応答時の初回返答（例）:

```
[RESPONSE CHUNKED] Gemini's response was split into 3 chunks due to size.
Cache Key: a1b2c3d4-e5f6-7890-abcd-ef1234567890
Total Size: 65,432 tokens

To retrieve chunks, use:
fetch-chunk cacheKey=a1b2c3d4-e5f6-7890-abcd-ef1234567890 chunkIndex=1

[CHUNK 1 of 3]
<本文>
```

---

# 付録D: 将来拡張の指針

- Tokenizer 抽象の導入（`countTokens/splitByTokens`）
- 圧縮保存（可逆）と遅延解凍
- 並列読み書き最適化/ストリーム化
- 断片復元/検証用のハッシュ付与（各chunkのSHA-256）
