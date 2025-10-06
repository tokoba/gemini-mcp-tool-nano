/**
 * 警告: このコードは個人用ローカルPC環境専用です
 * セキュリティ対応は一切行われていません
 * 本番環境や信頼できない入力には使用しないでください
 */

import path from 'path';
import { promises as fs } from 'fs';
import { normalizePath, expandHome } from './pathUtils.js';

/**
 * 基本設定（個人用ローカルPC向け）
 * 注意: セキュリティ機能は意図的に削除されています
 */
export interface SecurityConfig {
  allowedDirectories: string[]; // テスト互換性のため保持（実際は制限なし）
  maxPathLength: number;        // デフォルト: 1024
  maxFileSize: number;          // デフォルト: 10MB (bytes)
  allowSymlinks: boolean;       // テスト互換性のため保持（個人用PCでは制限なし）
  allowHiddenFiles: boolean;    // テスト互換性のため保持（個人用PCでは制限なし）
  allowBinaryFiles: boolean;    // テスト互換性のため保持（個人用PCでは制限なし）
}

/**
 * バリデーション結果（個人用ローカルPC向け - セキュリティチェックなし）
 */
export interface ValidationResult {
  valid: boolean;
  normalizedPath?: string;
  realPath?: string;      // 追加: 実際のファイルパス
  errors: string[];
  isSafeToRead: boolean;
}

/**
 * 基本エラークラス（個人用ローカルPC向け）
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * パス基本バリデータ（個人用ローカルPC向け）
 * 
 * 注意: セキュリティ機能は一切含まれていません
 * 基本機能のみ:
 * 1. 基本的な入力検証
 * 2. パス正規化
 * 3. ファイル存在確認
 * 4. 読み込み可能性チェック
 */
export class PathValidator {
  private readonly config: SecurityConfig;

  constructor(config: SecurityConfig) {
    this.config = config;
  }

  /**
   * ReDoS攻撃対策: 入力文字列長をチェック
   * @param input チェックする文字列
   * @returns 安全かどうか
   */
  checkInputLength(input: string): boolean {
    if (typeof input !== 'string') {
      return false;
    }
    return input.length <= this.config.maxPathLength;
  }

  /**
   * 基本的なパス検証
   * @param filepath 検証するパス
   * @returns 基本検証結果
   */
  private basicPathValidation(filepath: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 型チェック
    if (typeof filepath !== 'string') {
      errors.push('Path must be a string');
      return { valid: false, errors };
    }

    // 空文字チェック
    if (!filepath.trim()) {
      errors.push('Path cannot be empty');
      return { valid: false, errors };
    }

    // 長さチェック (ReDoS対策)
    if (!this.checkInputLength(filepath)) {
      errors.push(`Path exceeds maximum length of ${this.config.maxPathLength} characters`);
      return { valid: false, errors };
    }

    // ヌル文字チェック (Null Byte Injection対策)
    if (filepath.includes('\x00')) {
      errors.push('Path contains null bytes');
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  }

  /**
   * 個人用PC向け: すべてのパスを許可（セキュリティチェックなし）
   * @param absolutePath チェックする絶対パス
   * @param allowedDirectories 未使用（個人用PC向けのため制限なし）
   * @returns 常にtrue（制限なし）
   */
  isPathWithinAllowedDirectories(absolutePath: string, allowedDirectories: string[]): boolean {
    // 個人用PC向け: 基本的な型検証のみ、制限なし
    if (typeof absolutePath !== 'string') {
      return false;
    }

    // 個人用PC向け: セキュリティチェックなし、すべてのパスを許可
    return true;
  }

  /**
   * 個人用PC向け: パストラバーサルチェックなし
   * @param filepath チェックするパス
   * @returns 常にtrue（制限なし）
   */
  preventDirectoryTraversal(filepath: string): boolean {
    // 個人用PC向け: セキュリティチェックなし、すべてのパスを許可
    return true;
  }

  /**
   * 個人用PC向け: 基本的なファイル情報チェック（設定に基づく制限）
   * @param filepath チェックするファイルパス
   * @returns 基本的なファイル情報
   */
  async validateFileContentSafety(filepath: string): Promise<ValidationResult & { reason?: string }> {
    try {
      const stats = await fs.stat(filepath);
      
      // ファイルサイズチェック
      if (stats.size > this.config.maxFileSize) {
        return {
          valid: false,
          isSafeToRead: false,
          errors: [`File size ${stats.size} exceeds maximum ${this.config.maxFileSize}`],
          reason: 'isTooLarge'
        };
      }

      // デバイスファイルチェック
      if (stats.isCharacterDevice() || stats.isBlockDevice()) {
        return {
          valid: false,
          isSafeToRead: false,
          errors: ['Device files are not supported'],
          reason: 'isDeviceFile'
        };
      }

      // シンボリックリンクチェック
      if (stats.isSymbolicLink() && !this.config.allowSymlinks) {
        return {
          valid: false,
          isSafeToRead: false,
          errors: ['Symbolic links are not allowed'],
          reason: 'isSymlink'
        };
      }

      // 隠しファイルチェック
      const basename = path.basename(filepath);
      if (basename.startsWith('.') && !this.config.allowHiddenFiles) {
        return {
          valid: false,
          isSafeToRead: false,
          errors: ['Hidden files are not allowed'],
          reason: 'isHidden'
        };
      }

      // バイナリファイルチェック（簡易版）
      if (!this.config.allowBinaryFiles) {
        try {
          const buffer = await fs.readFile(filepath, { encoding: 'utf8' });
          // バイナリ文字が含まれているかチェック
          if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(buffer)) {
            return {
              valid: false,
              isSafeToRead: false,
              errors: ['Binary files are not allowed'],
              reason: 'isBinary'
            };
          }
        } catch (error) {
          // 読み込みエラーの場合はバイナリファイルと判定
          return {
            valid: false,
            isSafeToRead: false,
            errors: ['Binary files are not allowed'],
            reason: 'isBinary'
          };
        }
      }

      return {
        valid: true,
        isSafeToRead: true,
        errors: []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        isSafeToRead: false,
        errors: [`File access failed: ${errorMessage}`]
      };
    }
  }

  /**
   * 個人用PC向け: 簡素化されたパスバリデーション（セキュリティ制限なし）
   * @param filepath 検証するパス
   * @returns バリデーション結果
   */
  async validatePath(filepath: string): Promise<ValidationResult> {
    // 1. 基本検証のみ
    const basicValidation = this.basicPathValidation(filepath);
    if (!basicValidation.valid) {
      return {
        valid: false,
        isSafeToRead: false,
        errors: basicValidation.errors
      };
    }

    try {
      // 2. パス展開と正規化
      const expandedPath = expandHome(filepath);
      const normalizedPath = normalizePath(expandedPath);
      
      // 3. 絶対パスに変換 (クロスプラットフォーム対応)
      const isWindowsPath = path.win32.isAbsolute(normalizedPath);
      const isUnixPath = path.posix.isAbsolute(normalizedPath);

      let absolutePath: string;
      if (isWindowsPath || isUnixPath) {
        // 絶対パスはそのまま使用
        absolutePath = normalizedPath;
      } else {
        // 相対パスのみ CWD と結合
        absolutePath = path.resolve(process.cwd(), normalizedPath);
      }

      // 4. ファイル存在確認（個人用PC向け: セキュリティチェックなし）
      try {
        await fs.access(absolutePath);
        const safetyCheck = await this.validateFileContentSafety(absolutePath);
        
        return {
          valid: safetyCheck.valid,
          normalizedPath: absolutePath,
          realPath: absolutePath,  // 個人用PC向け: 正規化パスと同じ
          errors: safetyCheck.errors,
          isSafeToRead: safetyCheck.isSafeToRead
        };
      } catch {
        // ファイルが存在しない場合（個人用PC向け: パス形式は無効だが安全）
        return {
          valid: false,  // ファイルが存在しないため無効
          normalizedPath: absolutePath,
          realPath: absolutePath,  // 個人用PC向け: 正規化パスと同じ
          errors: ['File not found'],  // ファイル未存在エラー
          isSafeToRead: false  // 読み込み不可
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        isSafeToRead: false,
        errors: [`Path validation failed: ${errorMessage}`]
      };
    }
  }
}

/**
 * デフォルト設定（個人用ローカルPC向け）
 * 注意: セキュリティ制限は一切設けていません
 */
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  allowedDirectories: [process.cwd()], // テスト互換性のため保持（実際は制限なし）
  maxPathLength: 1024,
  maxFileSize: 100 * 1024 * 1024, // 100MB（個人用PC向けに大きく設定）
  allowSymlinks: true,             // 個人用PCでは制限なし
  allowHiddenFiles: true,          // 個人用PCでは制限なし
  allowBinaryFiles: true,          // 個人用PCでは制限なし
};