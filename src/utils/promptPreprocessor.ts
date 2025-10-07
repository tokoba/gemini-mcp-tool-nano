import { Logger } from './logger.js';
import { 
  FilepathProcessor, 
  createDefaultFilepathProcessor, 
  createLightweightFilepathProcessor,
  DEFAULT_FILEPATH_CONFIG,
  type FilepathProcessingConfig,
  type PathModification
} from './filepath/index.js';

/**
 * 智的@記号処理ユーティリティ
 * 
 * 機能:
 * - 堅牢なセキュリティ検証
 * - クロスプラットフォーム対応
 * - Unicode/国際化サポート
 * - 階層化された正規表現システム
 */

/**
 * プロセッサ設定
 */
export interface PreprocessorConfig {
  lightweightMode: boolean;      // 軽量モード（パフォーマンス重視）
  filepathConfig?: Partial<FilepathProcessingConfig>; // ファイルパス処理設定
}

/**
 * デフォルト設定
 */
const DEFAULT_PREPROCESSOR_CONFIG: PreprocessorConfig = {
  lightweightMode: false,
  filepathConfig: DEFAULT_FILEPATH_CONFIG
};

/**
 * 設定可能なプロセッサインスタンス
 */
let currentConfig: PreprocessorConfig = { ...DEFAULT_PREPROCESSOR_CONFIG };
let processor: FilepathProcessor | null = null;

/**
 * @記号を含むプロンプトを処理
 * 
 * 処理ロジック:
 * 1. 階層化されたパターン検出（explicit > general > filename）
 * 2. セキュリティ検証（ディレクトリトラバーサル、許可ディレクトリ）
 * 3. クロスプラットフォーム対応（Windows, Unix, WSL, Cygwin）
 * 4. Unicode/国際化サポート
 * 5. インテリジェントな@記号処理
 * 
 * @param prompt The prompt string to process
 * @param config Optional configuration for processing behavior
 * @returns Prompt string with @ symbols properly processed
 */
export async function preprocessAtSymbols(
  prompt: string,
  config?: Partial<PreprocessorConfig>
): Promise<string> {
  // 設定の更新
  if (config) {
    updatePreprocessorConfig(config);
  }

  return await processAtSymbols(prompt);
}

/**
 * @記号処理の実装
 */
async function processAtSymbols(prompt: string): Promise<string> {
  try {
    // プロセッサの初期化（必要に応じて）
    if (!processor) {
      processor = currentConfig.lightweightMode 
        ? createLightweightFilepathProcessor()
        : createDefaultFilepathProcessor();
      
      if (currentConfig.filepathConfig) {
        processor.updateConfig(currentConfig.filepathConfig);
      }
    }

    Logger.debug('promptPreprocessor: Processing @ symbols');
    
    const result = await processor.processContent(prompt);
    
    Logger.debug(`promptPreprocessor: Processing complete. ${result.modifications.length} modifications made`);
    
    // 詳細ログ出力
    for (const modification of result.modifications) {
      Logger.debug(`promptPreprocessor: ${modification.action} - ${modification.original} → ${modification.modified} (${modification.reason})`);
    }

    return result.processedContent;
    
  } catch (error) {
    Logger.error(`promptPreprocessor: Processing failed: ${error}`);
    throw error;
  }
}


/**
 * 設定を更新
 * @param config 新しい設定
 */
export function updatePreprocessorConfig(config: Partial<PreprocessorConfig>): void {
  // ネストされたfilepathConfigを正しくマージする
  const newFilepathConfig: Partial<FilepathProcessingConfig> = config.filepathConfig
    ? {
        // 既存のfilepathConfigを維持
        ...(currentConfig.filepathConfig || {}),
        // 新しいfilepathConfig設定をマージ
        ...config.filepathConfig,
        // securityオブジェクトをディープマージ
        security: {
          ...DEFAULT_FILEPATH_CONFIG.security,
          ...(currentConfig.filepathConfig?.security || {}),
          ...(config.filepathConfig.security || {}),
        },
      }
    : (currentConfig.filepathConfig || {});

  // 全体の設定を更新
  currentConfig = {
    ...currentConfig,
    ...config,
    filepathConfig: newFilepathConfig,
  };
  
  // プロセッサのリセット（設定変更時）
  if (processor) {
    if (config.filepathConfig) {
      // マージ後の完全な設定をプロセッサに渡す
      processor.updateConfig(currentConfig.filepathConfig!);
    } else if (config.lightweightMode !== undefined) {
      processor = null; // 再初期化を促す
    }
  }
  
  Logger.debug('promptPreprocessor: Configuration updated', currentConfig);
  // デバッグ用に更新後のセキュリティ設定をログ出力
  if (config.filepathConfig?.security) {
    Logger.debug('promptPreprocessor: Security config updated:', currentConfig.filepathConfig?.security);
  }
}

/**
 * 現在の設定を取得
 * @returns 現在の設定
 */
export function getPreprocessorConfig(): PreprocessorConfig {
  return { ...currentConfig };
}

/**
 * 軽量モードを設定（便利関数）
 * @param lightweight 軽量モードを使用するか
 */
export function setLightweightMode(lightweight: boolean = false): void {
  updatePreprocessorConfig({
    lightweightMode: lightweight
  });
}

/**
 * @記号処理のデバッグヘルパー関数
 * 
 * @param prompt The prompt to test
 * @returns Detailed processing results
 */
export async function debugAtSymbolProcessing(
  prompt: string
): Promise<{
  original: string;
  processed: string;
  changes: Array<{ pattern: string; action: string; reason: string }>;
  statistics?: {
    totalAtSymbols: number;
    detectedPaths: number;
    validPaths: number;
    safePaths: number;
    byType: Record<string, number>;
  };
}> {
  const original = prompt;
  
  try {
    const tempProcessor = currentConfig.lightweightMode 
      ? createLightweightFilepathProcessor()
      : createDefaultFilepathProcessor();
    
    // Apply the current configuration to the temporary processor for accurate debugging
    // これにより、デバッグ実行が実際の前処理と同じ設定を使用することが保証されます
    if (currentConfig.filepathConfig) {
      tempProcessor.updateConfig(currentConfig.filepathConfig);
      Logger.debug('debugAtSymbolProcessing: Applied current filepathConfig to tempProcessor:', JSON.stringify(currentConfig.filepathConfig, null, 2));
    } else {
      Logger.debug('debugAtSymbolProcessing: No specific filepathConfig to apply to tempProcessor. Using defaults.');
    }
    
    const result = await tempProcessor.processContent(prompt);
    const statistics = await tempProcessor.getStatistics(prompt);
    
    const changes = result.modifications.map((mod: PathModification) => ({
      pattern: mod.original,
      action: mod.action,
      reason: mod.reason
    }));
    
    return {
      original,
      processed: result.processedContent,
      changes,
      statistics
    };
  } catch (error) {
    Logger.error(`debugAtSymbolProcessing: Processing failed: ${error}`);
    throw error;
  }
}

