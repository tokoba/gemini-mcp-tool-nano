/**
 * 警告: このコードは個人用ローカルPC環境専用です
 * セキュリティ対応は一切行われていません
 * 本番環境や信頼できない入力には使用しないでください
 * 
 * 基本的なパス検出システム
 * 参考実装: reference_crates/shimai-mcp/typescript/src/file-processor.ts
 * 
 * 階層化された正規表現システム:
 * 1. EXPLICIT_PATTERNS: 明示的マーカー付き（最優先）
 * 2. GENERAL_PATH_PATTERNS: 一般的なパス形式（中優先）
 * 3. FILENAME_PATTERNS: ファイル名形式（低優先）
 */

// プラットフォーム検出
const isWindows = process.platform === 'win32';
const isCygwin = !!(process.env.CYGWIN || process.env.MSYSTEM);

// Unicode対応の文字クラス（日本語ファイル名対応、スペース除外）
// Unicodeプロパティエスケープを使用した堅牢な国際化対応
const unicodeChar = '[\\w\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FAF\\u002E\\u002D\\u005F]';
const pathSeparator = '[/\\\\]';

// 正規表現パターン（モジュールトップレベルでコンパイル・キャッシュ）

// 1. 明示的なマーカー付きパターン（最優先）
export const EXPLICIT_PATTERNS = [
  // filepath: 指定（全プラットフォーム対応）
  new RegExp(`filepath:\\s*([^\\s]+)`, 'g'),
  
  // @マーカー付きパス（全プラットフォーム対応）
  // Windows ドライブレターパス: @C:\Users\Name\file.txt, @C:/Users/Name/file.txt
  new RegExp(`@([a-zA-Z]:${pathSeparator}${unicodeChar}+(?:${pathSeparator}${unicodeChar}+)*)`, 'gu'),
  
  // Windows UNCパス: @\\server\share\folder\file.txt
  new RegExp(`@(\\\\\\\\[^\\s\\\\]+\\\\[^\\s\\\\]+(?:\\\\${unicodeChar}+)*)`, 'gu'),
  
  // Cygwin パス: @/cygdrive/c/Users/Name/file.txt
  new RegExp(`@(\\/cygdrive\\/[a-zA-Z](?:\\/${unicodeChar}+)+)`, 'gu'),
  
  // Unix/Linux 絶対パス: @/home/user/file.txt
  new RegExp(`@(\\/${unicodeChar}+(?:\\/${unicodeChar}+)*)`, 'gu'),
  
  // 相対パス: @./relative/path, @../parent/path
  new RegExp(`@(\\.\\.?\\/${unicodeChar}*(?:\\/${unicodeChar}+)*)`, 'gu'),
  
  // ファイル名形式: @filename.ext
  new RegExp(`@(${unicodeChar}+\\.\\w{1,6})`, 'gu'),
];

// 2. 一般的なパスパターン（@マーカーなし）
export const GENERAL_PATH_PATTERNS = [
  // Windows ドライブレターパス（両方の区切り文字対応）
  new RegExp(`(?:^|\\s)([a-zA-Z]:${pathSeparator}${unicodeChar}+(?:${pathSeparator}${unicodeChar}+)*)(?=\\s|$)`, 'gu'),
  
  // Windows UNCパス
  new RegExp(`(?:^|\\s)(\\\\\\\\[^\\s\\\\]+\\\\[^\\s\\\\]+(?:\\\\${unicodeChar}+)*)(?=\\s|$)`, 'gu'),
  
  // Cygwin パス
  new RegExp(`(?:^|\\s)(\\/cygdrive\\/[a-zA-Z](?:\\/${unicodeChar}+)+)(?=\\s|$)`, 'gu'),
  
  // Unix/Linux 絶対パス
  new RegExp(`(?:^|\\s)(\\/${unicodeChar}+(?:\\/${unicodeChar}+)+)(?=\\s|$)`, 'gu'),
  
  // 相対パス（./relative, ../parent）
  new RegExp(`(?:^|\\s)(\\.\\.?\\/${unicodeChar}*(?:\\/${unicodeChar}+)*)(?=\\s|$)`, 'gu'),
  
  // ディレクトリパス（dir/subdir/file形式）
  new RegExp(`(?:^|\\s)(${unicodeChar}+${pathSeparator}${unicodeChar}+(?:${pathSeparator}${unicodeChar}+)*)(?=\\s|$)`, 'gu'),
];

// 3. ファイル名っぽいパターン（拡張子付き）
export const FILENAME_PATTERNS = [
  // Unicode対応ファイル名パターン
  new RegExp(`(?:^|\\s)(${unicodeChar}+\\.\\w{1,6})(?=\\s|$)`, 'gu'),
];

// 除外すべき一般的な単語・パターン（クロスプラットフォーム対応）
export const EXCLUSION_PATTERNS = [
  /^https?:\/\//,                    // URL
  /^ftp:\/\//,                       // FTP URL  
  /^mailto:/,                        // メールアドレス
  /^\w+@\w+\.\w+/,                   // メールアドレス形式
  /^[0-9\.]+$/,                      // 数値のみ
  /^[a-zA-Z]{1,3}$/,                 // 短すぎる単語
  
  // Windows特有の除外パターン
  /^[a-zA-Z]:$/,                     // ドライブレターのみ（C:）
  /^\d{1,2}:\d{2}$/,                 // 時刻表示（12:34）
  /^\d{1,2}:\d{2}:\d{2}$/,           // 時刻表示（12:34:56）
  /^\d+:\d+$/,                       // アスペクト比等（16:9）
  /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i, // Windows予約名
  
  // 除外すべき拡張子のみのパターン
  /^\.\w{1,6}$/,                     // .txt, .log等の拡張子のみ
  
  // 単純な区切り文字のみ
  /^[\/\\]+$/,                       // スラッシュやバックスラッシュのみ
];

// 除外する一般的な英単語
export const COMMON_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'has', 'was', 'one', 'our', 'out', 'day', 'get', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'her', 'him', 'his', 'how', 'let', 'may', 'run', 'sit', 'try', 'ask', 'end', 'far', 'fun', 'got', 'own', 'red', 'run', 'set', 'six', 'top', 'yes', 'yet'
]);

// 全パターンを優先度順に結合
export const FILE_PATH_PATTERNS = [
  ...EXPLICIT_PATTERNS,     // 最優先：明示的マーカー付き
  ...GENERAL_PATH_PATTERNS, // 中優先：一般的なパス形式
  ...FILENAME_PATTERNS      // 低優先：ファイル名形式
];

/**
 * パス検出設定
 */
export interface PathDetectionConfig {
  enableUnicode: boolean;
  platformSupport: Array<'windows' | 'unix' | 'cygwin' | 'wsl'>;
  exclusionPatterns: RegExp[];
  commonWords: Set<string>;
  enableLightweightMode: boolean; // EXPLICIT_PATTERNSのみ使用
}

/**
 * パス検出結果
 */
export interface PathDetectionResult {
  match: string;          // マッチした全体
  filepath: string;       // 抽出されたファイルパス
  priority: number;       // 優先度 (1: 高, 2: 中, 3: 低)
  type: 'explicit' | 'general' | 'filename';
  platform: 'windows' | 'unix' | 'cygwin' | 'wsl' | 'unknown';
  startIndex: number;     // 元のテキストでの開始位置
  endIndex: number;       // 元のテキストでの終了位置
}

/**
 * パス検出クラス
 */
export class PathDetector {
  private readonly config: PathDetectionConfig;

  constructor(config: Partial<PathDetectionConfig> = {}) {
    this.config = {
      enableUnicode: true,
      platformSupport: ['windows', 'unix', 'cygwin', 'wsl'],
      exclusionPatterns: [...EXCLUSION_PATTERNS],
      commonWords: new Set([...COMMON_WORDS]),
      enableLightweightMode: false,
      ...config
    };
  }

  /**
   * パスが除外対象かどうかを判定
   * @param filePath 判定するパス
   * @returns 除外すべきかどうか
   */
  private shouldExcludePath(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') {
      return true;
    }
    
    // 除外パターンをチェック
    for (const exclusionPattern of this.config.exclusionPatterns) {
      if (exclusionPattern.test(filePath)) {
        return true;
      }
    }
    
    // 一般的な英単語をチェック（ファイル名パターンでマッチした場合）
    const fileName = filePath.includes('/') || filePath.includes('\\') 
      ? filePath.split(/[/\\]/).pop()! 
      : filePath;
    const baseName = fileName.replace(/\.[^.]*$/, '').toLowerCase();
    if (this.config.commonWords.has(baseName)) {
      return true;
    }
    
    // 短すぎるパス（1-2文字）を除外
    if (filePath.length <= 2) {
      return true;
    }
    
    return false;
  }

  /**
   * パスのプラットフォームを判定
   * @param filePath 判定するパス
   * @returns プラットフォーム
   */
  private detectPlatform(filePath: string): PathDetectionResult['platform'] {
    if (filePath.match(/^[a-zA-Z]:[/\\]/)) return 'windows';
    if (filePath.startsWith('\\\\')) return 'windows'; // UNC
    if (filePath.startsWith('/mnt/')) return 'wsl';
    if (filePath.startsWith('/cygdrive/')) return 'cygwin';
    if (filePath.startsWith('/')) return 'unix';
    return 'unknown';
  }

  /**
   * 文字列内のファイルパスを検出
   * @param content 検索対象の文字列
   * @returns 検出されたパスのリスト
   */
  detectFilePaths(content: string): PathDetectionResult[] {
    if (typeof content !== 'string') {
      return [];
    }

    const results: PathDetectionResult[] = [];
    
    // 使用するパターンを決定
    const patterns = this.config.enableLightweightMode 
      ? EXPLICIT_PATTERNS 
      : FILE_PATH_PATTERNS;

    // 各パターングループを処理
    const patternGroups = [
      { patterns: EXPLICIT_PATTERNS, type: 'explicit' as const, priority: 1 },
      { patterns: GENERAL_PATH_PATTERNS, type: 'general' as const, priority: 2 },
      { patterns: FILENAME_PATTERNS, type: 'filename' as const, priority: 3 }
    ];

    for (const group of patternGroups) {
      // 軽量モードの場合、EXPLICIT_PATTERNSのみ処理
      if (this.config.enableLightweightMode && group.type !== 'explicit') {
        continue;
      }

      for (const pattern of group.patterns) {
        // 正規表現をリセット
        pattern.lastIndex = 0;
        let match;
        
        while ((match = pattern.exec(content)) !== null) {
          const filePath = match[1]; // 第1キャプチャグループ
          
          // 除外フィルタリング
          if (this.shouldExcludePath(filePath)) {
            continue;
          }

          // プラットフォーム判定
          const platform = this.detectPlatform(filePath);
          
          // プラットフォームサポートチェック
          if (!this.config.platformSupport.includes(platform as any) && platform !== 'unknown') {
            continue;
          }

          results.push({
            match: match[0],
            filepath: filePath,
            priority: group.priority,
            type: group.type,
            platform,
            startIndex: match.index!,
            endIndex: match.index! + match[0].length
          });
        }
      }
    }

    // 重複除去とソート
    const uniqueResults = this.deduplicateResults(results);
    return this.sortResults(uniqueResults);
  }

  /**
   * 検出結果の重複を除去
   * @param results 検出結果
   * @returns 重複除去済みの結果
   */
  private deduplicateResults(results: PathDetectionResult[]): PathDetectionResult[] {
    const seen = new Set<string>();
    const uniqueResults: PathDetectionResult[] = [];

    for (const result of results) {
      const key = `${result.filepath}:${result.startIndex}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.push(result);
      }
    }

    return uniqueResults;
  }

  /**
   * 検出結果をソート（優先度順、位置順）
   * @param results ソート対象の結果
   * @returns ソート済みの結果
   */
  private sortResults(results: PathDetectionResult[]): PathDetectionResult[] {
    return results.sort((a, b) => {
      // 優先度でソート（数値が小さいほど高優先度）
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // 同じ優先度の場合は位置でソート
      return a.startIndex - b.startIndex;
    });
  }

  /**
   * デバッグ情報を含む詳細な検出を実行
   * @param content 検索対象の文字列
   * @returns 詳細な検出結果
   */
  detectWithDebugInfo(content: string): {
    results: PathDetectionResult[];
    stats: {
      totalMatches: number;
      excludedMatches: number;
      byType: Record<string, number>;
      byPlatform: Record<string, number>;
    };
  } {
    const results = this.detectFilePaths(content);
    
    const stats = {
      totalMatches: results.length,
      excludedMatches: 0, // 実装の簡易化のため省略
      byType: results.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byPlatform: results.reduce((acc, r) => {
        acc[r.platform] = (acc[r.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return { results, stats };
  }
}

/**
 * デフォルト設定を使用したPathDetectorインスタンスを作成
 */
export function createDefaultPathDetector(): PathDetector {
  return new PathDetector();
}

/**
 * 軽量モード用のPathDetectorインスタンスを作成
 */
export function createLightweightPathDetector(): PathDetector {
  return new PathDetector({ enableLightweightMode: true });
}