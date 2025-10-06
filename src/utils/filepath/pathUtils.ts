/**
 * 警告: このコードは個人用ローカルPC環境専用です
 * セキュリティ対応は一切行われていません
 * 本番環境や信頼できない入力には使用しないでください
 */

import path from "path";
import os from 'os';

/**
 * クロスプラットフォームパス正規化ユーティリティ
 * 参考実装: reference_crates/shimai-mcp/typescript/src/path-utils.ts
 */

/**
 * WSLまたはUnix-style WindowsパスをWindows形式に変換
 * @param p 変換するパス
 * @returns 変換されたWindowsパス
 */
export function convertToWindowsPath(p: string): string {
  // WSLパス (/mnt/c/...) を処理
  if (p.startsWith('/mnt/')) {
    const driveLetter = p.charAt(5).toUpperCase();
    const pathPart = p.slice(6).replace(/\//g, '\\');
    return `${driveLetter}:${pathPart}`;
  }
  
  // Cygwinパス (/cygdrive/c/...) を処理
  if (p.startsWith('/cygdrive/')) {
    const driveLetter = p.charAt(10).toUpperCase();
    const pathPart = p.slice(11).replace(/\//g, '\\');
    return `${driveLetter}:${pathPart}`;
  }
  
  // Unix-style Windowsパス (/c/...) を処理
  if (p.match(/^\/[a-zA-Z]\//)) {
    const driveLetter = p.charAt(1).toUpperCase();
    const pathPart = p.slice(2).replace(/\//g, '\\');
    return `${driveLetter}:${pathPart}`;
  }

  // 標準的なWindowsパスの場合、スラッシュをバックスラッシュに変換
  if (p.match(/^[a-zA-Z]:/)) {
    return p.replace(/\//g, '\\');
  }

  // 非Windowsパスはそのまま
  return p;
}

/**
 * OS特有の動作を保ちながらパスを正規化
 * @param p 正規化するパス
 * @returns 正規化されたパス
 */
export function normalizePath(p: string): string {
  // 周囲のクォート文字と空白を除去
  p = p.trim().replace(/^["']|["']$/g, '');
  
  // Unixパスかどうかを判定 (/ で始まるが、Windows、WSL、Cygwinパスではない)
  const isUnixPath = p.startsWith('/') && 
                    !p.match(/^\/mnt\/[a-z]\//i) && 
                    !p.match(/^\/[a-zA-Z]\//) &&
                    !p.startsWith('/cygdrive/');
  
  if (isUnixPath) {
    // Unixパスの場合、Windowsフォーマットに変換せずに正規化
    // Node.jsのpath.posix.normalizeを使用して . と .. を正しく処理
    const normalized = path.posix.normalize(p);
    // ルートディレクトリ以外の場合、末尾のスラッシュを除去
    return normalized === '/' ? normalized : normalized.replace(/\/+$/, '');
  }
  
  // WSLまたはUnix-style WindowsパスをWindows形式に変換
  p = convertToWindowsPath(p);
  
  // 先頭のUNC \\を保護しながら、重複するバックスラッシュを処理
  if (p.startsWith('\\\\')) {
    // UNCパスの場合、先頭を正確に\\に正規化
    // その後、パスの残りの部分の重複バックスラッシュを正規化
    let uncPath = p;
    // 複数の先頭バックスラッシュを正確に2つに置換
    uncPath = uncPath.replace(/^\\{2,}/, '\\\\');
    // パスの残りの部分の重複バックスラッシュを正規化
    const restOfPath = uncPath.substring(2).replace(/\\\\/g, '\\');
    p = '\\\\' + restOfPath;
  } else {
    // 非UNCパスの場合、すべての重複バックスラッシュを正規化
    p = p.replace(/\\\\/g, '\\');
  }
  
  // Node.jsのpath正規化を使用し、. と .. セグメントを処理
  // ただし、相対パスの先頭 ./ や ../ は保持する
  const isRelativePath = p.startsWith('./') || p.startsWith('../');
  let normalized = path.normalize(p);
  
  // 相対パス記号が削除された場合は復元
  if (isRelativePath && !normalized.startsWith('./') && !normalized.startsWith('../') && !path.isAbsolute(normalized)) {
    normalized = './' + normalized;
  }
  
  // 正規化後のUNCパス修正 (path.normalizeが先頭バックスラッシュを削除する場合がある)
  if (p.startsWith('\\\\') && !normalized.startsWith('\\\\')) {
    normalized = '\\' + normalized;
  }
  
  // Windowsパス: スラッシュを変換し、ドライブ文字を大文字化
  if (normalized.match(/^[a-zA-Z]:/)) {
    let result = normalized.replace(/\//g, '\\');
    // ドライブ文字が存在する場合は大文字化
    if (/^[a-z]:/.test(result)) {
      result = result.charAt(0).toUpperCase() + result.slice(1);
    }
    return result;
  }
  
  // その他のパス (相対パスを含む)
  // 現在のプラットフォームに応じてパス区切り文字を変換
  if (process.platform === 'win32') {
    return normalized.replace(/\//g, '\\');
  } else {
    return normalized;
  }
}

/**
 * パス内のホームディレクトリチルダを展開
 * @param filepath 展開するパス
 * @returns 展開されたパス
 */
export function expandHome(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(1));
  }
  return filepath;
}

/**
 * プラットフォーム情報を取得
 */
export function getPlatformInfo() {
  return {
    isWindows: process.platform === 'win32',
    isCygwin: !!(process.env.CYGWIN || process.env.MSYSTEM),
    isLinux: process.platform === 'linux',
    isMacOS: process.platform === 'darwin'
  };
}

/**
 * パスがプラットフォームに適したフォーマットかチェック
 * @param filepath チェックするパス
 * @returns プラットフォーム互換性情報
 */
export function checkPathCompatibility(filepath: string) {
  const platformInfo = getPlatformInfo();
  
  return {
    hasWindowsDrive: /^[a-zA-Z]:/.test(filepath),
    hasUNCPath: filepath.startsWith('\\\\'),
    hasWSLPath: filepath.startsWith('/mnt/'),
    hasUnixPath: filepath.startsWith('/') && !filepath.startsWith('/mnt/') && !filepath.match(/^\/[a-zA-Z]\//),
    isRelativePath: !path.isAbsolute(filepath),
    platformInfo
  };
}