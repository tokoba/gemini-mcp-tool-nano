 >the contribution framework is currently in testing, the goal is to use gemini to create gemini-mcp-tool tools, automate tool creation and merging with automation, TUI based tool generator

# Gemini MCP Tool

> 📚 **[View Full Documentation](https://jamubc.github.io/gemini-mcp-tool/)** - Professional docs with search, guides, and examples

This is a simple Model Context Protocol (MCP) server that allows AI assistants to interact with the [Google Gemini CLI](https://github.com/google-gemini/gemini-cli). It enables the AI to leverage the power of Gemini's massive token window for large analysis, especially with large files and codebases using the `@` syntax for direction.

# TLDR:

- 1. Install, ask claude naturally to use gemini, save tokens.
- 2. Add this to your claude config.

```
    "gemini-cli": {
      "command": "npx",
      "args": ["-y", "gemini-mcp-tool"]
    }
```

- 3. Run 'claude mcp add-from-claude-desktop' where you want to use gemini-cli as an mcp,
- 4. Make sure that you have selected the MCPs you want to import (it defaults to all)
- 50. then run claude code in the same dir. this dir will now be configured.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16.0.0 or higher)
- [Google Gemini CLI](https://github.com/google-gemini/gemini-cli) installed and configured on your system.

## Installation

You can use this tool without installation via `npx`, which is the recommended approach. However, if you prefer to install it globally, you can do so.

```bash
# To install globally (optional)
npm install -g gemini-mcp-tool
```

## Configuration

You need to register the MCP server with your MCP client (e.g., Claude Code, Claude Desktop, ect).

### Recommended: Using `npx` (No Installation Needed)

Add the following to your claude desktop configuration file:

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

### Using a Global Installation

If you installed the package globally, use this configuration:

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

## Available Commands

- Use natural language: "use gemini to explain index.html", "understand the massive project using gemini", "ask gemini to search for latest news"
- Claude Code: type /gemini-cli and commands should populate in claude code.

## Usage Examples

### With File References (using @ syntax)

- `ask gemini to analyze @src/main.js and explain what it does`
- `use gemini to summarize @. the current directory`
- `analyze @package.json and tell me about dependencies`

### General Questions (without files)

- `ask gemini to search for the latest tech news`
- `use gemini to explain quantum computing`
- `ask gemini about best practices for React development related to @file_im_confused_about`

### Using Gemini CLI's Sandbox Mode (-s)

The sandbox mode allows you to safely test code changes, run scripts, or execute potentially risky operations in an isolated environment.

- `use gemini sandbox to create and run a Python script that processes data`
- `ask gemini to safely test @script.py and explain what it does`
- `use gemini sandbox to install numpy and create a data visualization`
- `test this code safely: Create a script that makes HTTP requests to an API`

### Tools (for the AI)

These tools are designed to be used by the AI assistant.

- **`ask-gemini`**: Asks Google Gemini for its perspective. Can be used for general questions or complex analysis of files.
  - **`prompt`** (required): The analysis request. Use the `@` syntax to include file or directory references (e.g., `@src/main.js explain this code`) or ask general questions (e.g., `Please use a web search to find the latest news stories`).
  - **`model`** (optional): The Gemini model to use. Defaults to `gemini-2.5-flash`.
  - **`sandbox`** (optional): Set to `true` to run in sandbox mode for safe code execution.
- **`sandbox-test`**: Safely executes code or commands in Gemini's sandbox environment. Always runs in sandbox mode.
  - **`prompt`** (required): Code testing request (e.g., `Create and run a Python script that...` or `@script.py Run this safely`).
  - **`model`** (optional): The Gemini model to use.
- **`Ping`**: A simple test tool that echoes back a message.
- **`Help`**: Shows the Gemini CLI help text.

### Slash Commands (for the User)

You can use these commands directly in _claude codes_ face (havent tested other clients).

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
