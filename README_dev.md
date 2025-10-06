# 開発者向けガイド (Developer Guide)

このドキュメントは、gemini-mcp-tool-nano プロジェクトの開発者向けの詳細なガイドです。

## 📋 目次

- [開発環境セットアップ](#開発環境セットアップ)
- [利用可能なコマンド](#利用可能なコマンド)
- [テスト実行](#テスト実行)
- [テストカバレッジ](#テストカバレッジ)
- [プロジェクト構造](#プロジェクト構造)
- [開発時の注意事項](#開発時の注意事項)
- [デバッグ方法](#デバッグ方法)
- [新機能: @-symbol File Path Syntax](#新機能-symbol-file-path-syntax)

## 🔧 開発環境セットアップ

### 必要なツール

- Node.js 16.0.0 以上
- npm (Node.js に付属)
- TypeScript (プロジェクトに含まれています)

### セットアップ手順

```bash
# 依存関係のインストール
npm install

# TypeScript の型チェック
npm run lint

# プロジェクトのビルド
npm run build
```

## 🛠️ 利用可能なコマンド

### ビルド・実行関連

```bash
# TypeScript のコンパイル
npm run build

# MCP サーバーの起動
npm start

# 開発モード（ビルド + 起動）
npm run dev
```

### コード品質

```bash
# TypeScript の型チェック（エラーのみ表示）
npm run lint

# コントリビューションスクリプト実行
npm run contribute
```

### ドキュメント

```bash
# VitePress ドキュメントサーバー起動
npm run docs:dev

# ドキュメントビルド
npm run docs:build

# ビルドしたドキュメントのプレビュー
npm run docs:preview
```

## 🧪 テスト実行

### 基本的なテストコマンド

```bash
# 全テストの実行
npm test

# テストをウォッチモードで実行（ファイル変更時に自動実行）
npm run test:watch

# テストカバレッジ付きで実行
npm run test:coverage
```

### 特定のテストファイルを実行

```bash
# 特定のテストファイルのみ実行
npm test tests/unit/pathUtils.test.ts

# 特定のテストパターンで実行
npm test -- --testNamePattern="PathUtils"

# 特定のディレクトリのテストのみ実行
npm test tests/unit/

# セキュリティテストのみ実行
npm test tests/security/
```

### テストのデバッグ

```bash
# 詳細な出力でテスト実行
npm test -- --verbose

# カバレッジなしでテスト実行（高速）
npm test -- --no-coverage

# 失敗したテストのみ再実行
npm test -- --onlyFailures
```

## 📊 テストカバレッジ

### カバレッジレポートの生成

```bash
# HTMLカバレッジレポートを生成
npm run test:coverage
```

### カバレッジレポートの表示方法

カバレッジレポートは複数の形式で生成されます：

1. **コンソール出力**: テスト実行時にターミナルに表示
2. **HTML レポート**: `coverage/index.html` をブラウザで開く
3. **LCOV レポート**: `coverage/lcov-report/index.html` をブラウザで開く

```bash
# HTMLレポートをブラウザで開く（Linux/macOS）
open coverage/index.html

# HTMLレポートをブラウザで開く（Windows）
start coverage/index.html
```

### カバレッジの基準

現在のカバレッジ目標値：

- **Statements**: 60%
- **Branches**: 60%
- **Functions**: 60%
- **Lines**: 60%

カバレッジ対象ファイル：

- `src/**/*.ts`
- 除外: `src/**/*.d.ts`, `src/**/index.ts`, `src/scripts/**/*`

## 📁 プロジェクト構造

```
gemini-mcp-tool-nano/
├── src/                          # ソースコード
│   ├── tools/                    # MCP ツール実装
│   │   ├── ask-gemini.tool.ts   # Gemini CLI 統合ツール
│   │   ├── fetch-chunk.tool.ts  # チャンク取得ツール
│   │   └── registry.ts          # ツール登録システム
│   ├── utils/                   # ユーティリティ
│   │   ├── filepath/            # ファイルパス処理（新機能）
│   │   │   ├── pathUtils.ts     # クロスプラットフォームパス正規化
│   │   │   ├── pathValidator.ts # セキュリティバリデーション
│   │   │   ├── pathDetector.ts  # パス検出システム
│   │   │   └── atSyntaxProcessor.ts # @構文処理
│   │   ├── geminiExecutor.ts    # Gemini CLI 実行ラッパー
│   │   ├── promptPreprocessor.ts # プロンプト前処理
│   │   └── logger.ts            # ログ機能
│   └── index.ts                 # エントリーポイント
├── tests/                       # テストコード
│   ├── unit/                    # ユニットテスト
│   ├── integration/             # 統合テスト
│   ├── security/                # セキュリティテスト
│   ├── setup.ts                 # テストセットアップ
│   └── global.d.ts              # テスト用型定義
├── docs/                        # VitePress ドキュメント
├── coverage/                    # カバレッジレポート（自動生成）
└── dist/                        # ビルド出力（自動生成）
```

## ⚠️ 開発時の注意事項

### TypeScript 設定

- **isolatedModules**: `true` に設定されています
- **ES2022** ターゲットで **Node16** モジュール解決を使用
- **厳密モード** が有効化されています

### テスト設定

- **Jest** を使用したテストフレームワーク
- **ts-jest** によるTypeScript サポート
- **ESM** モジュール形式対応
- クロスプラットフォームモック機能付き

### コミット前チェック

```bash
# 型チェック
npm run lint

# テスト実行
npm test

# ビルド確認
npm run build
```

## 🐛 デバッグ方法

### ログ出力の有効化

```javascript
// 開発時のログレベル設定
import { Logger } from './src/utils/logger.js';
Logger.setLevel('debug');
```

### テストデバッグ

```bash
# 特定のテストをデバッグモードで実行
npm test -- --testNamePattern="your-test-name" --verbose

# テスト実行時にコンソール出力を表示
npm test -- --silent=false
```

### プロンプト処理のデバッグ

```javascript
import { debugAtSymbolProcessing } from './src/utils/promptPreprocessor.js';

// デバッグモードを有効化
debugAtSymbolProcessing(true);
```

## 🆕 新機能: @-symbol File Path Syntax

### 概要

このプロジェクトには強化された@記号ファイルパス構文処理機能が実装されています。

### 主要機能

1. **クロスプラットフォーム対応**
   - Windows, Linux, WSL, Cygwin のパス形式をサポート
   - 自動的なパス正規化

2. **インテリジェント@構文処理**
   - 有効なファイルパス: `@/path/to/file.txt` → そのまま保持
   - 無効なパス: `@/invalid/path` → `@ /invalid/path` (スペース追加)
   - メールアドレス: `user@domain.com` → `user@ domain.com` (スペース追加)

3. **セキュリティ機能**
   - ディレクトリトラバーサル攻撃防御
   - ReDoS (Regular Expression Denial of Service) 攻撃耐性
   - 許可ディレクトリ外アクセス制限

### 設定方法

```javascript
import { updatePreprocessorConfig } from './src/utils/promptPreprocessor.js';

// 強化モードを有効化
updatePreprocessorConfig({
  useEnhancedProcessor: true,
  filepathConfig: {
    security: {
      allowedDirectories: ['/home/user', '/project'],
      maxPathLength: 1024,
      allowSymlinks: false
    }
  }
});
```

### テスト対象

- **ユニットテスト**: 各モジュールの個別機能
- **統合テスト**: プロンプト前処理の完全フロー
- **セキュリティテスト**: 攻撃耐性とセキュリティ機能
- **クロスプラットフォームテスト**: Windows/Linux環境での動作確認

---

## 🤝 コントリビューション

新しい機能の追加や既存機能の改善を行う場合は、以下の手順に従ってください：

1. テストファーストでの開発（TDD）
2. 型安全性の確保
3. セキュリティ要件の遵守
4. クロスプラットフォーム対応の考慮
5. 適切なテストカバレッジの維持

詳細は `CLAUDE.md` のCLAUDE Rulesを参照してください。
