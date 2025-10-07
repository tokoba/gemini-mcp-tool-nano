/**
 * 構造化エラー分類システム
 * 
 * 全モジュール間での一貫したエラー処理パターンを提供します。
 * エラーの分類、重要度、対処法を標準化します。
 */

import { Logger } from './logger.js';

/**
 * エラー分類カテゴリ
 */
export enum ErrorCategory {
  /** ユーザー入力の検証エラー */
  VALIDATION = 'validation',
  /** 外部コマンド実行エラー */
  COMMAND_EXECUTION = 'command_execution', 
  /** ファイルシステム操作エラー */
  FILE_SYSTEM = 'file_system',
  /** ネットワーク・API通信エラー */
  NETWORK = 'network',
  /** キャッシュ操作エラー */
  CACHE = 'cache',
  /** 設定・構成エラー */
  CONFIGURATION = 'configuration',
  /** システム内部エラー */
  INTERNAL = 'internal',
  /** MCP プロトコルエラー */
  PROTOCOL = 'protocol',
  /** クォータ・レート制限エラー */
  QUOTA = 'quota',
  /** タイムアウトエラー */
  TIMEOUT = 'timeout'
}

/**
 * エラー重要度レベル
 */
export enum ErrorSeverity {
  /** 情報 - 処理は継続可能 */
  INFO = 'info',
  /** 警告 - 処理は継続可能だが注意が必要 */
  WARNING = 'warning',
  /** エラー - 処理は失敗するが回復可能 */
  ERROR = 'error',
  /** 致命的エラー - 処理は失敗し回復不可能 */
  CRITICAL = 'critical'
}

/**
 * エラー復旧戦略
 */
export enum RecoveryStrategy {
  /** 再試行可能 */
  RETRY = 'retry',
  /** フォールバック処理可能 */
  FALLBACK = 'fallback',
  /** ユーザー対処が必要 */
  USER_ACTION = 'user_action',
  /** 復旧不可能 */
  NONE = 'none'
}

/**
 * 分類済みエラーの詳細情報
 */
export interface ClassifiedError {
  /** エラーカテゴリ */
  category: ErrorCategory;
  /** 重要度レベル */
  severity: ErrorSeverity;
  /** 復旧戦略 */
  recovery: RecoveryStrategy;
  /** エラーコード */
  code: string;
  /** ユーザー向けメッセージ */
  userMessage: string;
  /** 開発者向け詳細メッセージ */
  devMessage: string;
  /** 元のエラー */
  originalError?: Error;
  /** コンテキスト情報 */
  context?: Record<string, unknown>;
  /** 対処法の提案 */
  suggestions?: string[];
}

/**
 * エラー分類器クラス
 */
export class ErrorClassifier {
  /**
   * エラーメッセージからエラーを分類する
   * @param error エラーオブジェクトまたはメッセージ
   * @param context 追加のコンテキスト情報
   * @returns 分類済みエラー情報
   */
  static classify(error: Error | string, context?: Record<string, unknown>): ClassifiedError {
    const errorMessage = error instanceof Error ? error.message : error;
    const originalError = error instanceof Error ? error : undefined;

    // エラーメッセージパターンマッチング（具体的なエラーから先にチェック）
    if (this.isCacheError(errorMessage)) {
      return this.createCacheError(errorMessage, originalError, context);
    }
    
    if (this.isQuotaError(errorMessage)) {
      return this.createQuotaError(errorMessage, originalError, context);
    }
    
    if (this.isProtocolError(errorMessage)) {
      return this.createProtocolError(errorMessage, originalError, context);
    }
    
    if (this.isCommandExecutionError(errorMessage)) {
      return this.createCommandExecutionError(errorMessage, originalError, context);
    }
    
    if (this.isTimeoutError(errorMessage)) {
      return this.createTimeoutError(errorMessage, originalError, context);
    }
    
    if (this.isFileSystemError(errorMessage)) {
      return this.createFileSystemError(errorMessage, originalError, context);
    }
    
    if (this.isNetworkError(errorMessage)) {
      return this.createNetworkError(errorMessage, originalError, context);
    }
    
    if (this.isValidationError(errorMessage)) {
      return this.createValidationError(errorMessage, originalError, context);
    }

    // デフォルト: 内部エラーとして分類
    return this.createInternalError(errorMessage, originalError, context);
  }

  // パターンマッチング用のヘルパーメソッド群

  private static isValidationError(message: string): boolean {
    const patterns = [
      /invalid\s+arguments/i,
      /must be greater than/i,
      /must be a string/i,
      /chunk index must be/i,
      /please provide/i,
      /invalid path detected/i,
      /content must be/i,
      /invalid.*format/i  // 順序を最後に移動（cache errorとの競合を避ける）
    ];
    return patterns.some(pattern => pattern.test(message));
  }

  private static isCommandExecutionError(message: string): boolean {
    const patterns = [
      /failed to spawn command/i,
      /command failed with exit code/i,
      /command.*not found/i,
      /command execution failed/i,  // より具体的に
      /execution.*failed/i
    ];
    return patterns.some(pattern => pattern.test(message));
  }

  private static isFileSystemError(message: string): boolean {
    const patterns = [
      /ENOENT/i,
      /EACCES/i,
      /EISDIR/i,
      /failed to read/i,
      /failed to write/i,
      /file.*not found/i,
      /directory.*not exist/i
    ];
    return patterns.some(pattern => pattern.test(message));
  }

  private static isNetworkError(message: string): boolean {
    const patterns = [
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /network/i,
      /connection.*failed/i,
      /request.*failed/i
    ];
    return patterns.some(pattern => pattern.test(message));
  }

  private static isCacheError(message: string): boolean {
    const patterns = [
      /cache.*expired/i,
      /cache.*not found/i,
      /invalid cache key/i,
      /failed to save chunks/i,
      /failed to read metadata/i,
      /cannot save empty chunks/i
    ];
    return patterns.some(pattern => pattern.test(message));
  }

  private static isQuotaError(message: string): boolean {
    const patterns = [
      /quota exceeded/i,
      /rate limit/i,
      /too many requests/i,
      /daily limit/i
    ];
    return patterns.some(pattern => pattern.test(message));
  }

  private static isTimeoutError(message: string): boolean {
    const patterns = [
      /timeout/i,
      /timed out/i,
      /deadline exceeded/i
    ];
    return patterns.some(pattern => pattern.test(message));
  }

  private static isProtocolError(message: string): boolean {
    const patterns = [
      /unknown tool/i,
      /unknown prompt/i,
      /not found in registry/i,
      /no prompt defined/i,
      /protocol.*error/i
    ];
    return patterns.some(pattern => pattern.test(message));
  }

  // 各エラーカテゴリーのClassifiedError作成メソッド群

  private static createValidationError(
    message: string, 
    originalError?: Error, 
    context?: Record<string, unknown>
  ): ClassifiedError {
    return {
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.ERROR,
      recovery: RecoveryStrategy.USER_ACTION,
      code: 'VALIDATION_001',
      userMessage: '入力データに問題があります。入力内容を確認してください。',
      devMessage: `Validation failed: ${message}`,
      originalError,
      context,
      suggestions: [
        '入力パラメータの型と形式を確認してください',
        'API仕様書を参照して正しい値を入力してください'
      ]
    };
  }

  private static createCommandExecutionError(
    message: string, 
    originalError?: Error, 
    context?: Record<string, unknown>
  ): ClassifiedError {
    return {
      category: ErrorCategory.COMMAND_EXECUTION,
      severity: ErrorSeverity.ERROR,
      recovery: RecoveryStrategy.RETRY,
      code: 'COMMAND_001',
      userMessage: 'コマンドの実行に失敗しました。しばらく待ってから再試行してください。',
      devMessage: `Command execution failed: ${message}`,
      originalError,
      context,
      suggestions: [
        'Gemini CLIが正しくインストールされているか確認してください',
        'ネットワーク接続を確認してください',
        'しばらく待ってから再試行してください'
      ]
    };
  }

  private static createFileSystemError(
    message: string, 
    originalError?: Error, 
    context?: Record<string, unknown>
  ): ClassifiedError {
    return {
      category: ErrorCategory.FILE_SYSTEM,
      severity: ErrorSeverity.ERROR,
      recovery: RecoveryStrategy.USER_ACTION,
      code: 'FS_001',
      userMessage: 'ファイルまたはディレクトリの操作に失敗しました。',
      devMessage: `File system operation failed: ${message}`,
      originalError,
      context,
      suggestions: [
        'ファイルパスが正しいか確認してください',
        'ファイルの読み書き権限を確認してください',
        'ディスク容量を確認してください'
      ]
    };
  }

  private static createNetworkError(
    message: string, 
    originalError?: Error, 
    context?: Record<string, unknown>
  ): ClassifiedError {
    return {
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.ERROR,
      recovery: RecoveryStrategy.RETRY,
      code: 'NETWORK_001',
      userMessage: 'ネットワーク接続に問題があります。接続を確認して再試行してください。',
      devMessage: `Network operation failed: ${message}`,
      originalError,
      context,
      suggestions: [
        'インターネット接続を確認してください',
        'プロキシ設定を確認してください',
        'しばらく待ってから再試行してください'
      ]
    };
  }

  private static createCacheError(
    message: string, 
    originalError?: Error, 
    context?: Record<string, unknown>
  ): ClassifiedError {
    return {
      category: ErrorCategory.CACHE,
      severity: ErrorSeverity.WARNING,
      recovery: RecoveryStrategy.FALLBACK,
      code: 'CACHE_001',
      userMessage: 'キャッシュ操作に失敗しました。処理を続行します。',
      devMessage: `Cache operation failed: ${message}`,
      originalError,
      context,
      suggestions: [
        'キャッシュディレクトリの権限を確認してください',
        'ディスク容量を確認してください',
        'キャッシュが古い場合は削除してください'
      ]
    };
  }

  private static createQuotaError(
    message: string, 
    originalError?: Error, 
    context?: Record<string, unknown>
  ): ClassifiedError {
    return {
      category: ErrorCategory.QUOTA,
      severity: ErrorSeverity.ERROR,
      recovery: RecoveryStrategy.FALLBACK,
      code: 'QUOTA_001',
      userMessage: 'API使用量が上限に達しました。しばらく待つか、別のモデルを使用してください。',
      devMessage: `Quota exceeded: ${message}`,
      originalError,
      context,
      suggestions: [
        'しばらく待ってから再試行してください',
        'gemini-2.5-flashモデルを使用してください',
        '明日以降に再試行してください'
      ]
    };
  }

  private static createTimeoutError(
    message: string, 
    originalError?: Error, 
    context?: Record<string, unknown>
  ): ClassifiedError {
    return {
      category: ErrorCategory.TIMEOUT,
      severity: ErrorSeverity.ERROR,
      recovery: RecoveryStrategy.RETRY,
      code: 'TIMEOUT_001',
      userMessage: '処理がタイムアウトしました。再試行するか、より小さなデータで試してください。',
      devMessage: `Operation timed out: ${message}`,
      originalError,
      context,
      suggestions: [
        '処理する内容を小さく分割してください',
        'ネットワーク接続を確認してください',
        'しばらく待ってから再試行してください'
      ]
    };
  }

  private static createProtocolError(
    message: string, 
    originalError?: Error, 
    context?: Record<string, unknown>
  ): ClassifiedError {
    return {
      category: ErrorCategory.PROTOCOL,
      severity: ErrorSeverity.ERROR,
      recovery: RecoveryStrategy.USER_ACTION,
      code: 'PROTOCOL_001',
      userMessage: '指定されたツールまたはコマンドが見つかりません。',
      devMessage: `Protocol error: ${message}`,
      originalError,
      context,
      suggestions: [
        'ツール名のスペルを確認してください',
        '利用可能なツール一覧を確認してください',
        'ヘルプコマンドを実行してください'
      ]
    };
  }

  private static createInternalError(
    message: string, 
    originalError?: Error, 
    context?: Record<string, unknown>
  ): ClassifiedError {
    return {
      category: ErrorCategory.INTERNAL,
      severity: ErrorSeverity.CRITICAL,
      recovery: RecoveryStrategy.NONE,
      code: 'INTERNAL_001',
      userMessage: '内部エラーが発生しました。開発者にお問い合わせください。',
      devMessage: `Internal error: ${message}`,
      originalError,
      context,
      suggestions: [
        'エラー内容を開発者に報告してください',
        'システムを再起動してみてください',
        '最新版にアップデートしてください'
      ]
    };
  }

  /**
   * 分類済みエラーをログに記録する
   * @param classifiedError 分類済みエラー
   */
  static logError(classifiedError: ClassifiedError): void {
    const logMessage = `[${classifiedError.category}:${classifiedError.code}] ${classifiedError.devMessage}`;
    
    switch (classifiedError.severity) {
      case ErrorSeverity.INFO:
        Logger.log(logMessage, { context: classifiedError.context });
        break;
      case ErrorSeverity.WARNING:
        Logger.warn(logMessage, { context: classifiedError.context });
        break;
      case ErrorSeverity.ERROR:
        Logger.error(logMessage, { context: classifiedError.context });
        break;
      case ErrorSeverity.CRITICAL:
        Logger.error(`🚨 CRITICAL: ${logMessage}`, { 
          context: classifiedError.context,
          suggestions: classifiedError.suggestions 
        });
        break;
    }
  }

  /**
   * エラーハンドリングのためのヘルパー関数
   * エラーを分類し、ログ記録し、適切な例外を投げる
   * @param error エラーオブジェクトまたはメッセージ
   * @param context 追加のコンテキスト情報
   * @throws 分類済みエラー情報を含む新しいエラー
   */
  static handleError(error: Error | string, context?: Record<string, unknown>): never {
    const classifiedError = this.classify(error, context);
    this.logError(classifiedError);
    
    // 分類済み情報を含む新しいエラーを作成
    const enhancedError = new Error(classifiedError.userMessage) as Error & {
      classification?: ClassifiedError;
    };
    enhancedError.classification = classifiedError;
    
    throw enhancedError;
  }

  /**
   * エラー統計情報を取得（将来的な拡張用）
   * @returns エラー統計
   */
  static getErrorStats(): Record<ErrorCategory, number> {
    // 実装は将来的に追加（メモリ内統計、または永続化統計）
    return {} as Record<ErrorCategory, number>;
  }
}

/**
 * 分類済みエラーの型ガード
 * @param error エラーオブジェクト
 * @returns 分類済みエラー情報があるかどうか
 */
export function hasClassification(error: unknown): error is Error & { classification: ClassifiedError } {
  return error instanceof Error && 'classification' in error && !!error.classification;
}

/**
 * ユーザーフレンドリーなエラーメッセージを取得
 * @param error エラーオブジェクト
 * @returns ユーザー向けメッセージ
 */
export function getUserMessage(error: unknown): string {
  if (hasClassification(error)) {
    return error.classification.userMessage;
  }
  
  if (error instanceof Error) {
    const classified = ErrorClassifier.classify(error);
    return classified.userMessage;
  }
  
  return '予期しないエラーが発生しました。';
}

/**
 * エラーの復旧戦略を取得
 * @param error エラーオブジェクト
 * @returns 復旧戦略
 */
export function getRecoveryStrategy(error: unknown): RecoveryStrategy {
  if (hasClassification(error)) {
    return error.classification.recovery;
  }
  
  if (error instanceof Error) {
    const classified = ErrorClassifier.classify(error);
    return classified.recovery;
  }
  
  return RecoveryStrategy.NONE;
}