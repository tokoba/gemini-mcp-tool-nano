/**
 * 警告: このコードは個人用ローカルPC環境専用です
 * セキュリティ対応は一切行われていません
 * 本番環境や信頼できない入力には使用しないでください
 */

import { PathDetector, PathDetectionResult, createDefaultPathDetector, createLightweightPathDetector } from './pathDetector.js';
import { PathValidator, SecurityConfig, ValidationResult, DEFAULT_SECURITY_CONFIG } from './pathValidator.js';
import { Logger } from '../logger.js';

/**
 * @シンタックス処理設定
 */
export interface AtSyntaxConfig {
  preserveValidPaths: boolean;     // 有効なパスは@を保持
  addSpaceAfterInvalid: boolean;   // 無効な@の後にスペースを追加
  escapeInvalidPaths: boolean;     // 無効なパスをエスケープ
  enableFileExpansion: boolean;    // ファイル内容展開機能
  enableLightweightMode: boolean;  // 軽量モード（EXPLICIT_PATTERNSのみ）
}

/**
 * パス修正情報
 */
export interface PathModification {
  original: string;
  modified: string;
  action: 'preserved' | 'spaced' | 'escaped' | 'expanded';
  reason: string;
  startIndex: number;
  endIndex: number;
}

/**
 * @シンタックス処理結果
 */
export interface AtSyntaxProcessingResult {
  processedContent: string;
  detectedPaths: PathDetectionResult[];
  modifications: PathModification[];
  validationResults: ValidationResult[];
  expandedContent?: string;
}

/**
 * 智的@シンタックスプロセッサ
 * 
 * 処理フロー:
 * 1. @記号の検出と分類
 * 2. ファイルパスの抽出と検証
 * 3. 有効/無効パスの適切な処理
 * 4. オプション: ファイル内容の展開
 */
export class AtSyntaxProcessor {
  private readonly pathDetector: PathDetector;
  private pathValidator: PathValidator;
  private readonly config: AtSyntaxConfig;
  private securityConfig: SecurityConfig;

  constructor(
    config: Partial<AtSyntaxConfig> = {},
    securityConfig: SecurityConfig = DEFAULT_SECURITY_CONFIG
  ) {
    this.config = {
      preserveValidPaths: true,
      addSpaceAfterInvalid: true,
      escapeInvalidPaths: false,
      enableFileExpansion: false,
      enableLightweightMode: false,
      ...config
    };
    
    this.securityConfig = securityConfig;
    
    // パス検出器の初期化
    this.pathDetector = this.config.enableLightweightMode 
      ? createLightweightPathDetector()
      : createDefaultPathDetector();
    
    // パスバリデーターの初期化  
    this.pathValidator = new PathValidator(this.securityConfig);
  }

  /**
   * @記号を含むコンテンツを処理
   * @param content 処理対象のコンテンツ
   * @returns 処理結果
   */
  async process(content: string): Promise<AtSyntaxProcessingResult> {
    Logger.debug('AtSyntaxProcessor: Starting @ syntax processing');
    
    if (typeof content !== 'string') {
      throw new Error('Content must be a string');
    }

    // 1. パス検出
    const detectedPaths = this.pathDetector.detectFilePaths(content);
    Logger.debug(`AtSyntaxProcessor: Detected ${detectedPaths.length} potential paths`);

    // 2. パス検証
    const validationResults = await this.validateDetectedPaths(detectedPaths);
    
    // 3. コンテンツ修正
    const { processedContent, modifications } = await this.processContent(
      content, 
      detectedPaths, 
      validationResults
    );

    // 4. オプション: ファイル内容展開
    let expandedContent: string | undefined;
    if (this.config.enableFileExpansion) {
      expandedContent = await this.expandFileContent(processedContent, validationResults);
    }

    Logger.debug(`AtSyntaxProcessor: Processing complete. ${modifications.length} modifications made`);

    return {
      processedContent,
      detectedPaths,
      modifications,
      validationResults,
      expandedContent
    };
  }

  /**
   * 検出されたパスを検証
   * @param detectedPaths 検出されたパス
   * @returns 検証結果
   */
  private async validateDetectedPaths(detectedPaths: PathDetectionResult[]): Promise<ValidationResult[]> {
    const validationResults: ValidationResult[] = [];

    for (const detectedPath of detectedPaths) {
      try {
        const validation = await this.pathValidator.validatePath(detectedPath.filepath);
        validationResults.push(validation);
        
        Logger.debug(`AtSyntaxProcessor: Validated path "${detectedPath.filepath}" - ${validation.valid ? 'VALID' : 'INVALID'}`);
        
        if (!validation.valid) {
          Logger.debug(`AtSyntaxProcessor: Validation errors: ${validation.errors.join(', ')}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        validationResults.push({
          valid: false,
          isSafeToRead: false,
          errors: [`Validation failed: ${errorMessage}`]
        });
        
        Logger.debug(`AtSyntaxProcessor: Validation exception for "${detectedPath.filepath}": ${errorMessage}`);
      }
    }

    return validationResults;
  }

  /**
   * コンテンツを処理して@記号を適切に変更
   * @param content 元のコンテンツ
   * @param detectedPaths 検出されたパス
   * @param validationResults 検証結果
   * @returns 処理されたコンテンツと修正情報
   */
  private async processContent(
    content: string,
    detectedPaths: PathDetectionResult[],
    validationResults: ValidationResult[]
  ): Promise<{ processedContent: string; modifications: PathModification[] }> {
    let processedContent = content;
    const modifications: PathModification[] = [];

    // 1. 全ての修正候補を収集
    const allModifications: {
      startIndex: number;
      endIndex: number;
      modification: Omit<PathModification, 'startIndex' | 'endIndex'>;
    }[] = [];

    // 1a. 検出されたパスからの修正
    for (let i = 0; i < detectedPaths.length; i++) {
      const detectedPath = detectedPaths[i];
      const validation = validationResults[i];
      const mod = this.createModification(detectedPath, validation);
      if (mod) {
        allModifications.push({
          startIndex: detectedPath.startIndex,
          endIndex: detectedPath.endIndex,
          modification: mod,
        });
      }
    }

    // 1b. 検出されなかった@記号からの修正
    if (this.config.addSpaceAfterInvalid) {
      const regex = /@/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        const index = match.index;
        
        // 既に処理済みのパスに含まれているかチェック
        const isProcessed = detectedPaths.some(path => index >= path.startIndex && index < path.endIndex);
        if (isProcessed) {
          continue;
        }

        // 既にスペースが後ろにある場合は処理しない
        if (index < content.length - 1 && /\s/.test(content[index + 1])) {
          continue;
        }

        allModifications.push({
          startIndex: index,
          endIndex: index + 1,
          modification: {
            original: '@',
            modified: '@ ',
            action: 'spaced',
            reason: 'Non-filepath @ symbol',
          },
        });
      }
    }

    // 2. 修正を位置でソートして適用
    allModifications.sort((a, b) => b.startIndex - a.startIndex);

    for (const { startIndex, endIndex, modification } of allModifications) {
      const before = processedContent.substring(0, startIndex);
      const after = processedContent.substring(endIndex);
      processedContent = before + modification.modified + after;
      
      modifications.unshift({
        ...modification,
        startIndex,
        endIndex,
      });
    }

    return { processedContent, modifications };
  }

  /**
   * パス検出結果と検証結果から修正情報を作成
   * @param detectedPath 検出されたパス
   * @param validation 検証結果
   * @returns 修正情報
   */
  private createModification(
    detectedPath: PathDetectionResult,
    validation: ValidationResult
  ): Omit<PathModification, 'startIndex' | 'endIndex'> | null {
    const original = detectedPath.match;
    
    // 1. 有効なパスの処理 - ユーザー仕様「存在するファイルの場合はスペース不要」
    if (validation.valid) {
      // 1a. 安全なパス
      if (validation.isSafeToRead) {
        if (this.config.preserveValidPaths) {
          return null; // 修正なし
        }
        return {
          original,
          modified: original,
          action: 'preserved',
          reason: 'Valid and safe path preserved'
        };
      }
      
      // 1b. 安全でないパス
      // ユーザー仕様: 存在するファイルはスペース挿入の対象外
      // エスケープ設定がある場合のみエスケープ、それ以外は保持
      if (this.config.escapeInvalidPaths) {
        return {
          original,
          modified: `\\${original}`,
          action: 'escaped',
          reason: 'Valid but unsafe path escaped'
        };
      }
      // 存在するファイルはスペース追加しない（修正なし）
      return null;
    }

    // 2. 無効なパスの処理 (validation.valid === false の場合)
    if (detectedPath.type === 'explicit' && original.startsWith('@')) {
      // @マーカー付きの無効パス
      if (this.config.escapeInvalidPaths) {
        return {
          original,
          modified: `\\${original}`,
          action: 'escaped',
          reason: 'Invalid path escaped'
        };
      } else if (this.config.addSpaceAfterInvalid) {
        return {
          original,
          modified: original.replace('@', '@ '),
          action: 'spaced',
          reason: 'Invalid path'
        };
      }
    }

    // その他の無効パス（一般形式、ファイル名形式）
    if (this.config.addSpaceAfterInvalid && original.includes('@')) {
      return {
        original,
        modified: original.replace('@', '@ '),
        action: 'spaced',
        reason: 'Non-filepath @ symbol'
      };
    }

    // 修正不要
    return null;
  }

  /**
   * ファイル内容を展開（オプション機能）
   * @param processedContent 処理済みコンテンツ
   * @param validationResults 検証結果
   * @returns 展開されたコンテンツ
   */
  private async expandFileContent(
    processedContent: string,
    validationResults: ValidationResult[]
  ): Promise<string> {
    if (!this.config.enableFileExpansion) {
      return processedContent;
    }

    // 実装は簡易版（参考実装のPathProcessorを利用することを想定）
    Logger.debug('AtSyntaxProcessor: File expansion not implemented in this version');
    return processedContent;
  }

  /**
   * 処理設定を更新
   * @param newConfig 新しい設定
   * @param newSecurityConfig 新しいセキュリティ設定（オプション）
   */
  updateConfig(newConfig: Partial<AtSyntaxConfig>, newSecurityConfig?: SecurityConfig): void {
    Object.assign(this.config, newConfig);
    
    // セキュリティ設定が提供された場合、PathValidatorを再初期化
    if (newSecurityConfig) {
      this.securityConfig = newSecurityConfig;
      this.pathValidator = new PathValidator(this.securityConfig);
      Logger.debug('AtSyntaxProcessor: PathValidator re-initialized with new security config');
    }
    
    Logger.debug('AtSyntaxProcessor: Configuration updated');
  }

  /**
   * 現在の設定を取得
   * @returns 現在の設定
   */
  getConfig(): AtSyntaxConfig {
    return { ...this.config };
  }

  /**
   * 統計情報を取得
   * @param content 分析対象のコンテンツ
   * @returns 統計情報
   */
  async getStatistics(content: string): Promise<{
    totalAtSymbols: number;
    detectedPaths: number;
    validPaths: number;
    safePaths: number;
    byType: Record<string, number>;
    byPlatform: Record<string, number>;
  }> {
    const atSymbolCount = (content.match(/@/g) || []).length;
    const detectedPaths = this.pathDetector.detectFilePaths(content);
    const validationResults = await this.validateDetectedPaths(detectedPaths);
    
    const validPaths = validationResults.filter(v => v.valid).length;
    const safePaths = validationResults.filter(v => v.valid && v.isSafeToRead).length;
    
    const byType = detectedPaths.reduce((acc, p) => {
      acc[p.type] = (acc[p.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const byPlatform = detectedPaths.reduce((acc, p) => {
      acc[p.platform] = (acc[p.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAtSymbols: atSymbolCount,
      detectedPaths: detectedPaths.length,
      validPaths,
      safePaths,
      byType,
      byPlatform
    };
  }
}

/**
 * デフォルト設定でAtSyntaxProcessorを作成
 */
export function createDefaultAtSyntaxProcessor(securityConfig?: SecurityConfig): AtSyntaxProcessor {
  return new AtSyntaxProcessor({}, securityConfig);
}

/**
 * 軽量モードでAtSyntaxProcessorを作成
 */
export function createLightweightAtSyntaxProcessor(securityConfig?: SecurityConfig): AtSyntaxProcessor {
  return new AtSyntaxProcessor({ enableLightweightMode: true }, securityConfig);
}

/**
 * ファイル展開機能付きでAtSyntaxProcessorを作成
 */
export function createExpandingAtSyntaxProcessor(securityConfig?: SecurityConfig): AtSyntaxProcessor {
  return new AtSyntaxProcessor({ enableFileExpansion: true }, securityConfig);
}