/**
 * ファイルパス処理モジュール統合エクスポート
 * 
 * 設計アーキテクチャ:
 * - PathUtils: クロスプラットフォームパス正規化
 * - PathValidator: セキュリティ検証機能
 * - PathDetector: 階層化された正規表現パターンシステム
 * - AtSyntaxProcessor: 智的@記号処理
 */

// PathUtils
export {
  convertToWindowsPath,
  normalizePath,
  expandHome,
  getPlatformInfo,
  checkPathCompatibility
} from './pathUtils.js';

// PathValidator
export {
  PathValidator,
  ValidationError,
  DEFAULT_SECURITY_CONFIG,
  type SecurityConfig,
  type ValidationResult
} from './pathValidator.js';

// For internal use
import { DEFAULT_SECURITY_CONFIG } from './pathValidator.js';
import { AtSyntaxProcessor } from './atSyntaxProcessor.js';

// PathDetector
export {
  PathDetector,
  createDefaultPathDetector,
  createLightweightPathDetector,
  EXPLICIT_PATTERNS,
  GENERAL_PATH_PATTERNS,
  FILENAME_PATTERNS,
  FILE_PATH_PATTERNS,
  EXCLUSION_PATTERNS,
  COMMON_WORDS,
  type PathDetectionConfig,
  type PathDetectionResult
} from './pathDetector.js';

// AtSyntaxProcessor
export {
  AtSyntaxProcessor,
  createDefaultAtSyntaxProcessor,
  createLightweightAtSyntaxProcessor,
  createExpandingAtSyntaxProcessor,
  type AtSyntaxConfig,
  type PathModification,
  type AtSyntaxProcessingResult
} from './atSyntaxProcessor.js';

// Forward declarations (removed - using direct imports above)

// 統合設定
export interface FilepathProcessingConfig {
  // セキュリティ設定
  security: import('./pathValidator.js').SecurityConfig;
  
  // @シンタックス設定
  atSyntax: {
    preserveValidPaths: boolean;
    addSpaceAfterInvalid: boolean;
    escapeInvalidPaths: boolean;
    enableFileExpansion: boolean;
    enableLightweightMode: boolean;
  };
  
  // パス検出設定
  detection: {
    enableUnicode: boolean;
    platformSupport: Array<'windows' | 'unix' | 'cygwin' | 'wsl'>;
    enableLightweightMode: boolean;
  };
}

/**
 * デフォルト統合設定
 */
export const DEFAULT_FILEPATH_CONFIG: FilepathProcessingConfig = {
  security: DEFAULT_SECURITY_CONFIG,
  atSyntax: {
    preserveValidPaths: true,
    addSpaceAfterInvalid: true,
    escapeInvalidPaths: false,
    enableFileExpansion: false,
    enableLightweightMode: false
  },
  detection: {
    enableUnicode: true,
    platformSupport: ['windows', 'unix', 'cygwin', 'wsl'],
    enableLightweightMode: false
  }
};

/**
 * 統合ファイルパス処理クラス
 */
export class FilepathProcessor {
  private readonly atSyntaxProcessor: any;
  private readonly config: FilepathProcessingConfig;

  constructor(config: Partial<FilepathProcessingConfig> = {}) {
    this.config = {
      ...DEFAULT_FILEPATH_CONFIG,
      ...config,
      security: { ...DEFAULT_FILEPATH_CONFIG.security, ...config.security },
      atSyntax: { ...DEFAULT_FILEPATH_CONFIG.atSyntax, ...config.atSyntax },
      detection: { ...DEFAULT_FILEPATH_CONFIG.detection, ...config.detection }
    };

    this.atSyntaxProcessor = new AtSyntaxProcessor(
      this.config.atSyntax,
      this.config.security
    );
  }

  /**
   * @記号を含むコンテンツを処理
   * @param content 処理対象のコンテンツ
   * @returns 処理結果
   */
  async processContent(content: string) {
    return await this.atSyntaxProcessor.process(content);
  }

  /**
   * 設定を更新
   * @param newConfig 新しい設定
   */
  updateConfig(newConfig: Partial<FilepathProcessingConfig>): void {
    Object.assign(this.config, newConfig);
    
    // AtSyntaxProcessorの設定更新
    if (newConfig.atSyntax || newConfig.security) {
      this.atSyntaxProcessor.updateConfig(
        newConfig.atSyntax || {},
        newConfig.security || this.config.security
      );
    }
  }

  /**
   * 現在の設定を取得
   * @returns 現在の設定
   */
  getConfig(): FilepathProcessingConfig {
    return { ...this.config };
  }

  /**
   * 統計情報を取得
   * @param content 分析対象のコンテンツ
   * @returns 統計情報
   */
  async getStatistics(content: string) {
    return await this.atSyntaxProcessor.getStatistics(content);
  }
}

/**
 * デフォルト設定でFilepathProcessorを作成
 */
export function createDefaultFilepathProcessor(): FilepathProcessor {
  return new FilepathProcessor();
}

/**
 * 軽量モードでFilepathProcessorを作成
 */
export function createLightweightFilepathProcessor(): FilepathProcessor {
  return new FilepathProcessor({
    atSyntax: { 
      enableLightweightMode: true,
      preserveValidPaths: true,
      addSpaceAfterInvalid: true,
      escapeInvalidPaths: false,
      enableFileExpansion: false
    },
    detection: {
      enableUnicode: true,
      platformSupport: ['windows', 'unix', 'cygwin', 'wsl'],
      enableLightweightMode: true
    }
  });
}