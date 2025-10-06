/** @type {import('jest').Config} */
export default {
  // TypeScript サポート
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  
  // テスト環境
  testEnvironment: 'node',
  
  // テストファイルのパターン
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.spec.ts'
  ],
  
  // TypeScript 変換設定
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        module: 'ESNext',
        moduleResolution: 'node',
        allowSyntheticDefaultImports: true,
        isolatedModules: true
      }
    }]
  },
  
  // モジュール名マッピング（.js 拡張子対応）
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  
  // カバレッジ設定
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/scripts/**/*'
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  
  // テストタイムアウト（ReDoSテスト用）
  testTimeout: 30000,
  
  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  setupFiles: ['<rootDir>/tests/global.d.ts'],
  
  // 並列実行
  maxWorkers: '50%',
  
  // 詳細レポート
  verbose: true,
  
  // 失敗時の詳細表示
  errorOnDeprecated: true
};