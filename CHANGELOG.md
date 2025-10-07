# Changelog

## [2.0.0] - Major Chunking System Release

### 🚀 **New Features**
- **Token-Based Response Chunking**: Automatically chunks large Gemini responses (>16,000 tokens) for easy handling
- **fetch-chunk Tool**: New tool to retrieve cached chunks from large responses with `cacheId` and `chunkNumber` parameters
- **Cross-Platform Secure Cache**: UUID-based file caching with atomic operations, 24-hour TTL, and cross-platform support (Windows/Linux/macOS)
- **Multilingual Support**: Full UTF-8 safe processing for Japanese, Chinese, Korean, emoji, and Unicode characters
- **Progress Tracking**: Real-time progress notifications for all long-running operations

### 🔧 **Technical Improvements**
- **UTF-8 Safe Tokenizer**: Character-based token counting (4 chars ≈ 1 token) using `Array.from()` for proper Unicode handling
- **Paragraph-First Chunker**: Intelligent text splitting that preserves document structure and paragraph boundaries
- **Atomic Cache Operations**: Secure file operations with temporary directory creation and atomic renaming
- **Comprehensive Testing**: 388+ tests covering unit, integration, performance, security, and multilingual scenarios

### ⚠️ **Breaking Changes**
- **Removed changeMode System**: Completely removed changeMode functionality due to security vulnerabilities (ReDoS attacks, path injection, memory exhaustion)
- **File Reference Syntax**: Changed from `@file/path` to `[filepath: /path/to/file]` syntax for improved security
- **Tool Name**: `ask-gemini` now has short name `ask` for better usability
- **Removed brainstorm Tool**: Removed brainstorm functionality to focus on core Gemini integration

### 🛡️ **Security Enhancements**
- **Path Traversal Protection**: Prevents malicious cache key attempts (e.g., `../../../etc/passwd`)
- **ReDoS Attack Prevention**: Removed vulnerable regex patterns from changeMode system
- **Memory Exhaustion Protection**: Capacity limits and resource management in cache system
- **Secure File Permissions**: 0o700 directories and 0o600 files for cache security

### 📦 **Dependencies**
- **Removed**: `tiktoken`, `@google/generative-ai` for simpler, API-key-free implementation
- **Added**: Comprehensive Jest testing framework with cross-platform support

### 🔄 **Migration Guide**
- **File References**: Update `@path/to/file` to `[filepath: /path/to/file]`
- **Large Responses**: Use `fetch-chunk` tool with `cacheId` from chunked responses
- **changeMode**: No longer available - use structured prompting instead

## [1.1.6]
- **Enhanced @ Symbol Handling**: Added `preprocessAtSymbols` function to prevent Gemini CLI errors when @ symbols are used in non-file contexts
- **Lightweight Configuration**: Disabled resource-intensive `brainstormTool` and `timeoutTestTool` by default for improved performance
- **Cross-Platform Stability**: Merged Windows compatibility improvements with robust @ symbol preprocessing
- **Improved Reliability**: File existence validation before passing @ references to Gemini CLI

## [1.1.5]
- windows compatibility

## [1.1.4]
- skipped

## [1.1.3]
- "gemini reads, claude edits"
- Added `changeMode` parameter to ask-gemini tool for structured edit responses using claude edit diff.
- Testing intelligent parsing and chunking for large edit responses (>25k characters). I recommend you provide a focused prompt, although large (2000+) line edits have had success in testing.
- Added structured response format with Analysis, Suggested Changes, and Next Steps sections
- Improved guidance for applying edits using Claude's Edit/MultiEdit tools, avoids reading...
- Testing token limit handling with continuation support for large responses

## [1.1.2]
- Gemini-2.5-pro quota limit exceeded now falls back to gemini-2.5-flash automatically. Unless you ask for pro or flash, it will default to pro.

## [1.1.1]

- Public
- Basic Gemini CLI integration
- Support for file analysis with @ syntax
- Sandbox mode support
