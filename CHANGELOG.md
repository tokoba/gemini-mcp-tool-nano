# Changelog

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
