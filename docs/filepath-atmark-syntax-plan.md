# ファイルパス@記号シンタックス設計変更計画

## 概要

本プロジェクト`gemini-mcp-tool-nano`における`@`記号を使用したファイルパス指定機能の大幅な改良計画。参考実装`reference_crates/shimai-mcp/typescript/`の堅牢な設計を基に、より高度で信頼性の高いファイルパス処理システムを構築する。

## 現状分析

### 問題点

1. **単純な正規表現**: `/@([a-zA-Z0-9\/\.\-_]+)/g` は基本的なパスのみ対応
2. **Unicode未対応**: 日本語ファイル名、国際化文字への対応不足
3. **プラットフォーム依存**: Windows UNC、Cygwin、WSLパス未対応
4. **セキュリティ脆弱性**: ディレクトリトラバーサル等の検証不足
5. **誤検知**: メールアドレス、URL等の`@`記号を誤認識
6. **単純な例外処理**: ファイル存在チェックのみで包括的フィルタリング不足
7. **ReDoS脆弱性**: 悪意のある入力による正規表現処理でのDoS攻撃リスク
8. **リソース消費攻撃**: 巨大ファイル・バイナリファイル処理による過剰リソース消費
9. **コマンドインジェクション**: `geminiExecutor.ts` でのシェル文字列エスケープ不足

### 現在のアーキテクチャ

```
promptPreprocessor.ts
├── FILEPATH_PATTERN: 単一の正規表現
├── preprocessAtSymbols(): 基本的な存在チェック
└── debugAtSymbolProcessing(): デバッグヘルパー
```

## 参考実装解析結果

### shimai-mcp/typescript の優れた設計パターン

1. **階層化された正規表現システム**
   - EXPLICIT_PATTERNS: 明示的マーカー付き（最優先）
   - GENERAL_PATH_PATTERNS: 一般的なパス形式（中優先）
   - FILENAME_PATTERNS: ファイル名形式（低優先）

2. **包括的除外システム**
   - URL、メールアドレス、時刻表示の除外
   - 一般的な英単語の除外
   - Windows予約名の除外
   - 短すぎる/意味のない文字列の除外

3. **クロスプラットフォーム対応**
   - Windows ドライブレターパス
   - Windows UNCパス
   - Cygwin パス
   - Unix/Linux 絶対パス
   - 相対パス

4. **セキュリティ機能**
   - パス正規化
   - 許可ディレクトリチェック
   - ヌル文字検証
   - ディレクトリトラバーサル防止

5. **Unicode対応**
   - 日本語文字クラス: `\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF`
   - 国際化ファイル名サポート

## 新アーキテクチャ設計

### モジュール構成

```
src/utils/filepath/
├── pathUtils.ts          # クロスプラットフォームパス正規化
├── pathValidator.ts      # セキュリティ検証・許可ディレクトリチェック
├── pathDetector.ts       # 高度なパターン検出システム
├── atSyntaxProcessor.ts  # 智的@記号処理
├── pathProcessor.ts      # ファイル内容展開機能
└── index.ts             # エクスポート統一
```

### 核心コンポーネント

#### 1. PathDetector (pathDetector.ts)

```typescript
interface PathDetectionConfig {
  enableUnicode: boolean;
  platformSupport: Array<'windows' | 'unix' | 'cygwin' | 'wsl'>;
  exclusionPatterns: RegExp[];
  commonWords: Set<string>;
}

class PathDetector {
  detectFilePaths(content: string): Array<{
    match: string;
    filepath: string;
    priority: number;
    type: 'explicit' | 'general' | 'filename';
    platform: string;
  }>;
}
```

#### 2. PathValidator (pathValidator.ts)

```typescript
interface SecurityConfig {
  allowedDirectories: string[];
  maxPathLength: number;
  maxFileSize: number;
  allowSymlinks: boolean;
  allowHiddenFiles: boolean;
  allowBinaryFiles: boolean;
}

interface ValidationResult {
  valid: boolean;
  normalizedPath?: string;
  errors: string[];
  isSafeToRead: boolean;
  reason?: 'isBinary' | 'isTooLarge' | 'isDeviceFile';
}

class PathValidator {
  validatePath(filepath: string): Promise<ValidationResult>;
  validateFileContentSafety(filepath: string): Promise<ValidationResult>;
  isWithinAllowedDirectories(path: string): boolean;
  preventDirectoryTraversal(path: string): boolean;
  checkInputLength(input: string): boolean; // ReDoS対策
}
```

#### 3. AtSyntaxProcessor (atSyntaxProcessor.ts)

```typescript
interface AtSyntaxConfig {
  preserveValidPaths: boolean;
  addSpaceAfterInvalid: boolean;
  escapeInvalidPaths: boolean;
}

class AtSyntaxProcessor {
  process(content: string): Promise<{
    processedContent: string;
    detectedPaths: PathDetectionResult[];
    modifications: Array<{
      original: string;
      modified: string;
      action: 'preserved' | 'spaced' | 'escaped';
      reason: string;
    }>;
  }>;
}
```

#### 4. PathUtils (pathUtils.ts)

参考実装からポート:
- `normalizePath()`: プラットフォーム依存パス正規化
- `convertToWindowsPath()`: WSL/Unix-style Windows パス変換
- `expandHome()`: チルダ展開

#### 5. PathProcessor (pathProcessor.ts)

参考実装からポート:
- `processFilePath()`: 単一ファイル処理
- `processDirectoryPath()`: ディレクトリ処理
- `getLanguageFromExtension()`: 言語推定

### 統合設計

#### promptPreprocessor.ts の拡張

```typescript
import { AtSyntaxProcessor, PathDetector, PathValidator, PathProcessor } from './filepath/index.js';

export class EnhancedPromptPreprocessor {
  private atSyntaxProcessor: AtSyntaxProcessor;
  private pathDetector: PathDetector;
  private pathValidator: PathValidator;
  private pathProcessor: PathProcessor;

  async preprocessAtSymbols(prompt: string, config: ProcessingConfig): Promise<{
    processedPrompt: string;
    expandedContent?: string;
    pathModifications: PathModification[];
    validationResults: ValidationResult[];
  }>;
}
```

## 実装計画

### Phase 1: 基盤モジュール作成

1. **PathUtils** (1-2日)
   - 参考実装からのクロスプラットフォーム対応ポート
   - テストケース作成（Windows, Unix, WSL, Cygwin）

2. **PathValidator** (2-3日)
   - セキュリティ検証機能実装
   - 許可ディレクトリチェック
   - ディレクトリトラバーサル防止
   - ReDoS対策・リソース消費攻撃対策

3. **PathDetector** (3-4日)
   - 階層化された正規表現システム実装
   - Unicode対応（Unicodeプロパティエスケープ使用）
   - 除外パターン実装
   - 正規表現の最適化とキャッシュ機構

### Phase 2: 高レベル処理

4. **AtSyntaxProcessor** (2日)
   - 智的@記号処理ロジック
   - パス検出とバリデーションの統合
   - コンテンツ修正機能

5. **PathProcessor** (1日)
   - ファイル内容展開機能（オプション）
   - ディレクトリ処理
   - 言語検出

### Phase 3: 統合とテスト

6. **promptPreprocessor.ts 更新** (1日)
   - 新アーキテクチャとの統合
   - 後方互換性保証
   - 設定可能なオプション追加

7. **包括的テストスイート** (3-4日)
   - ユニットテスト（各モジュール）
   - インテグレーションテスト
   - クロスプラットフォーム互換性テスト
   - セキュリティテスト（ReDoS、リソース消費攻撃）
   - パフォーマンステスト

### Phase 4: 最適化と文書化

8. **パフォーマンス最適化** (1日)
   - 正規表現のコンパイル最適化
   - 非同期処理の効率化
   - メモリ使用量削減

9. **文書化** (1日)
   - API ドキュメント
   - 設定ガイド
   - 移行ガイド

## 移行戦略

### 段階的導入

1. **現行システム維持**
   - `preprocessAtSymbols` の既存機能保持
   - 新システムはオプション機能として追加

2. **設定による切り替え**
   ```typescript
   interface AtSyntaxConfig {
     useEnhancedProcessor: boolean; // default: false
     legacyMode: boolean;           // default: true
   }
   ```

3. **段階的機能有効化**
   - Phase 1: 基本的なUnicode対応
   - Phase 2: クロスプラットフォーム対応
   - Phase 3: 高度な除外システム
   - Phase 4: ファイル内容展開（オプション）

### リスク管理

#### 技術的リスク

1. **後方互換性**
   - 既存の動作を変更しない
   - デフォルトで従来動作

2. **パフォーマンス**
   - 新機能はオプトイン
   - 軽量モードの提供（EXPLICIT_PATTERNSのみ有効）

3. **実装の複雑性**
   - 多数の正規表現とクロスプラットフォーム差異によるバグリスク
   - 継続的な進捗確認と計画見直し

#### セキュリティリスク

4. **ReDoS（Regular Expression Denial of Service）**
   - 悪意のある入力による正規表現処理でのハング
   - 対策：入力文字列長制限（1024文字）、効率的正規表現設計

5. **リソース消費攻撃**
   - 巨大ファイル・バイナリファイル処理による過剰リソース消費
   - 対策：`fs.stat`による事前チェック、ファイルサイズ制限

6. **コマンドインジェクション**
   - シェル文字列エスケープ不足による実行時セキュリティリスク
   - 対策：常時stdin使用、シェル引数渡し廃止

#### 運用リスク

7. **テスト戦略**
   - 既存機能のリグレッションテスト
   - 新機能の段階的テスト
   - セキュリティテスト（攻撃シナリオ）

## 期待される効果

### 機能向上

1. **正確性向上**
   - 誤検知の大幅削減
   - ファイルパス検出精度向上

2. **国際化対応**
   - 日本語ファイル名サポート
   - Unicode文字対応

3. **プラットフォーム対応**
   - Windows環境での信頼性向上
   - WSL、Cygwin環境サポート

4. **セキュリティ強化**
   - ディレクトリトラバーサル防止
   - 不正パス検証

### 開発者体験向上

1. **デバッグ機能**
   - 詳細なパス検出ログ
   - 修正内容の可視化

2. **設定柔軟性**
   - 環境に応じた最適化
   - 段階的機能有効化

3. **保守性**
   - モジュール化された設計
   - テスタブルなアーキテクチャ

## 設定管理の強化

### 統合設定オブジェクト

```typescript
// src/config/atSyntaxConfig.ts
interface AtSyntaxConfiguration {
  // 機能制御
  useEnhancedProcessor: boolean;  // デフォルト: false
  legacyMode: boolean;           // デフォルト: true
  enableFileExpansion: boolean;  // デフォルト: false
  
  // セキュリティ設定
  security: {
    allowedDirectories: string[];
    maxPathLength: number;       // デフォルト: 1024
    maxFileSize: number;         // デフォルト: 10MB
    allowSymlinks: boolean;
    allowHiddenFiles: boolean;
    allowBinaryFiles: boolean;
  };
  
  // パフォーマンス設定
  performance: {
    enablePatternCaching: boolean;
    enableParallelProcessing: boolean;
    lightweightMode: boolean;    // EXPLICIT_PATTERNSのみ
  };
  
  // 国際化設定
  internationalization: {
    enableUnicodeSupport: boolean;
    useUnicodePropertyEscapes: boolean; // \p{Script=Hiragana}等
    supportedScripts: string[];
  };
}
```

## 実装ガイドライン

### 正規表現設計原則

1. **効率性**: バックトラッキングを最小化、アトミックグループ使用
2. **国際化**: Unicodeプロパティエスケープと`u`/`v`フラグ使用
3. **キャッシュ**: モジュールトップレベルでの正規表現コンパイル・再利用
4. **ReDoS対策**: 入力長制限、複雑度制限

### セキュリティ実装要件

1. **多層防御**: 入力検証→正規化→セキュリティチェック→実行前再検証
2. **ファイルアクセス制限**: `fs.stat`による事前チェック必須
3. **コマンド実行**: 常時stdin使用、シェル引数渡し禁止

## 次のステップ

1. ✅ レビュー実施（gemini-cli、code-reviewer）
2. ✅ レビュー結果を基にした設計詳細化
3. 🔄 実装開始（Phase 1から段階的に）
4. 継続的テストとフィードバック収集

---

**更新履歴**
- 2025-01-06: 初版作成
- 2025-01-06: レビュー結果反映（セキュリティ強化、リスク分析詳細化、実装ガイドライン追加）