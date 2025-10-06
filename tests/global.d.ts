/**
 * グローバル型定義ファイル
 */

declare global {
  var mockPlatform: (platform: NodeJS.Platform, envVars?: Record<string, string>) => void;
  var resetPlatform: () => void;
  var mockFileSystem: (files: Record<string, any>) => void;
  var silenceConsole: () => void;
  var mockLogger: () => void;
}

export {};