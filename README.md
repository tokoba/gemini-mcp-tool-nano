
# Gemini MCP Tool

original gemini-mcp-tool: <https://github.com/jamubc/gemini-mcp-tool.git>

This `gemini-mcp-tool-nano` is a fork version which provide mainly `ask-gemini` to preserve context.

## difference

total: 1108 tokens

```sh
> /context
 MCP tools · /mcp
 └ mcp__gemini-cli__ask (gemini-cli): 631 tokens
 └ mcp__gemini-cli__fetch-chunk (gemini-cli): 457 tokens
```

## Key Features

### Token-Based Response Chunking
- **Large Response Handling**: Automatically chunks Gemini responses exceeding 16,000 tokens into manageable pieces
- **Seamless Continuation**: Use `fetch-chunk` tool to retrieve subsequent chunks from cached responses
- **Cross-Platform Cache**: Secure UUID-based file caching with 24-hour TTL on all platforms
- **Multilingual Support**: UTF-8 safe processing for Japanese, Chinese, Korean, and emoji content

### Security & Performance
- **Path Traversal Protection**: Prevents malicious cache key attempts
- **Atomic Cache Operations**: Ensures data integrity during cache creation
- **Automatic Cleanup**: Expired cache cleanup and capacity management
- **Progress Tracking**: Real-time progress notifications for long operations

## setup

### removal of original gemini-mcp-tool

```sh
# uninstall
npm uninstall -g gemini-mcp-tool

# check
which gemini-mcp
# if uninstallation succeeded, there will be no result
```

### setup of this gemini-mcp-tool-nano

```sh
git clone https://github.com/tokoba/gemini-mcp-tool-nano.git
cd gemini-mcp-tool-nano
npm install
npm run build
npm link # this command will link local package to install globally to your pc

# check
which gemini-mcp
# if installation succeeded, gemini-mcp will be installed in your node directory

# link with claude code
claude mcp add gemini-cli gemini-mcp # claude will add your globally installed `gemini-mcp` as name of `gemini-cli`

# check claude
Checking MCP server health...

gemini-cli: gemini-mcp  - ✓ Connected
```

json setups: same as the original setup script

```json
{
  "mcpServers": {
    "gemini-cli": { // name of the mcp server which is called by claude, codex, etc
      "command": "gemini-mcp" // this is the executable name (actual exe)
    }
  }
}
```

## original document links

<div align="center">

[![GitHub Release](https://img.shields.io/github/v/release/jamubc/gemini-mcp-tool?logo=github&label=GitHub)](https://github.com/jamubc/gemini-mcp-tool/releases)
[![npm version](https://img.shields.io/npm/v/gemini-mcp-tool)](https://www.npmjs.com/package/gemini-mcp-tool)
[![npm downloads](https://img.shields.io/npm/dt/gemini-mcp-tool)](https://www.npmjs.com/package/gemini-mcp-tool)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Open Source](https://img.shields.io/badge/Open%20Source-❤️-red.svg)](https://github.com/jamubc/gemini-mcp-tool)

</div>

> 📚 **[View Full Documentation](https://jamubc.github.io/gemini-mcp-tool/)** - Search me!, Examples, FAQ, Troubleshooting, Best Practices

This is a simple Model Context Protocol (MCP) server that allows AI assistants to interact with the [Gemini CLI](https://github.com/google-gemini/gemini-cli). It enables the AI to leverage the power of Gemini's massive token window for large analysis, especially with large files and codebases using the `@` syntax for direction.

- Ask gemini natural questions, through claude or Brainstorm new ideas in a party of 3!

<a href="https://glama.ai/mcp/servers/@jamubc/gemini-mcp-tool">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@jamubc/gemini-mcp-tool/badge" alt="Gemini Tool MCP server" />
</a>

## TLDR: [![Claude](https://img.shields.io/badge/Claude-D97757?logo=claude&logoColor=fff)](#) + [![Google Gemini](https://img.shields.io/badge/Google%20Gemini-886FBF?logo=googlegemini&logoColor=fff)](#)

**Goal**: Use Gemini's powerful analysis capabilities directly in Claude Code to save tokens and analyze large files.

## Prerequisites

Before using this tool, ensure you have:

1. **[Node.js](https://nodejs.org/)** (v16.0.0 or higher)
2. **[Google Gemini CLI](https://github.com/google-gemini/gemini-cli)** installed and configured

### One-Line Setup

```bash
claude mcp add gemini-cli -- npx -y gemini-mcp-tool
```

### Verify Installation

Type `/mcp` inside Claude Code to verify the gemini-cli MCP is active.

---

### Alternative: Import from Claude Desktop

If you already have it configured in Claude Desktop:

1. Add to your Claude Desktop config:

```json
"gemini-cli": {
  "command": "npx",
  "args": ["-y", "gemini-mcp-tool"]
}
```

2. Import to Claude Code:

```bash
claude mcp add-from-claude-desktop
```

## Configuration

Register the MCP server with your MCP client:

### For NPX Usage (Recommended)

Add this configuration to your Claude Desktop config file:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "npx",
      "args": ["-y", "gemini-mcp-tool"]
    }
  }
}
```

### For Global Installation

If you installed globally, use this configuration instead:

```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "gemini-mcp"
    }
  }
}
```

**Configuration File Locations:**

- **Claude Desktop**:
  - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
  - **Linux**: `~/.config/claude/claude_desktop_config.json`

After updating the configuration, restart your terminal session.

## Example Workflow

- **Natural language**: "use gemini to explain index.html", "understand the massive project using gemini", "ask gemini to search for latest news"
- **Claude Code**: Type `/gemini-cli` and commands will populate in Claude Code's interface.

## Usage Examples

### With File References (using filepath syntax)

- `ask gemini to analyze [filepath: /path/to/src/main.js] and explain what it does`
- `use gemini to summarize [filepath: .] the current directory`
- `analyze [filepath: /path/to/package.json] and tell me about dependencies`
- `review [filepath: /path/to/large-file.txt] and provide a comprehensive analysis`

### General Questions (without files)

- `ask gemini to search for the latest tech news`
- `use gemini to explain div centering`
- `ask gemini about best practices for React development related to @file_im_confused_about`

### Using Gemini CLI's Sandbox Mode (-s)

The sandbox mode allows you to safely test code changes, run scripts, or execute potentially risky operations in an isolated environment.

- `use gemini sandbox to create and run a Python script that processes data`
- `ask gemini to safely test @script.py and explain what it does`
- `use gemini sandbox to install numpy and create a data visualization`
- `test this code safely: Create a script that makes HTTP requests to an API`

### Handling Large Responses

When Gemini provides extensive analysis (>16,000 tokens), responses are automatically chunked:

1. **Initial Response**: Contains first chunk and metadata:
   ```json
   {
     "isChunked": true,
     "cacheId": "abc-123-def",
     "totalChunks": 3,
     "chunkNumber": 1,
     "content": "First part of the analysis..."
   }
   ```

2. **Continuation**: Use `fetch-chunk` to get remaining chunks:
   - `fetch chunk 2 from cache abc-123-def`
   - `get next chunk from cacheId abc-123-def chunkNumber 2`

### Tools (for the AI)

These tools are designed to be used by the AI assistant.

- **`ask`** (short for `ask-gemini`): Asks Google Gemini for its perspective. Can be used for general questions or complex analysis of files.
  - **`prompt`** (required): The analysis request. Use filepath syntax `[filepath: /path/to/file]` to include file or directory references, or ask general questions.
  - **`model`** (optional): The Gemini model to use. Defaults to `gemini-2.5-pro`.
  - **`sandbox`** (optional): Set to `true` to run in sandbox mode for safe code execution.
  - **`changeMode`** (optional): Enables structured editing response format (defaults to `true`).
  - **Response Chunking**: Automatically chunks large responses (>16k tokens) for easier handling.

- **`fetch-chunk`**: Retrieves cached chunks from large Gemini responses.
  - **`cacheId`** (required): The cache ID returned from a chunked `ask-gemini` response.
  - **`chunkNumber`** (required): The chunk number to retrieve (1-based indexing).
  - Used to continue reading large Gemini analyses that were automatically chunked.

- **`ping`**: A simple test tool that echoes back a message.
- **`Help`**: Shows the Gemini CLI help text.

### Slash Commands (for the User)

You can use these commands directly in Claude Code's interface (compatibility with other clients has not been tested).

- **/analyze**: Analyzes files or directories using Gemini, or asks general questions.
  - **`prompt`** (required): The analysis prompt. Use `@` syntax to include files (e.g., `/analyze prompt:@src/ summarize this directory`) or ask general questions (e.g., `/analyze prompt:Please use a web search to find the latest news stories`).
- **/sandbox**: Safely tests code or scripts in Gemini's sandbox environment.
  - **`prompt`** (required): Code testing request (e.g., `/sandbox prompt:Create and run a Python script that processes CSV data` or `/sandbox prompt:@script.py Test this script safely`).
- **/help**: Displays the Gemini CLI help information.
- **/ping**: Tests the connection to the server.
  - **`message`** (optional): A message to echo back.

## Contributing

Contributions are welcome! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the project.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

**Disclaimer:** This is an unofficial, third-party tool and is not affiliated with, endorsed, or sponsored by Google.
