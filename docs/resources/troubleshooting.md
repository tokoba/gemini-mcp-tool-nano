# Troubleshooting

Common issues and their solutions.

## Installation Issues

### "Command not found: gemini"
The Gemini CLI is not installed. Install it first:
```bash
pip install google-generativeai-cli
gemini config set api_key YOUR_API_KEY
```

### "MCP server not responding"
1. Check your Claude Desktop config file location
2. Verify JSON syntax is correct
3. Restart Claude Desktop completely
4. Check logs at: `~/Library/Logs/Claude/`

## Connection Issues

### "Failed to connect to Gemini"
- Verify API key: `gemini config get api_key`
- Check internet connection
- Verify firewall settings
- Try: `/gemini-cli:ping "test"`

### "Timeout errors"
- Large files may take time
- Try using Gemini Flash for faster responses
- Break up large requests

## File Analysis Issues

### "File not found"
- Use absolute paths when possible
- Check file permissions
- Verify working directory

### "Token limit exceeded"
- Use Gemini Pro for larger contexts
- Break up file analysis
- Use specific file patterns

## Configuration Issues

### Changes not taking effect
1. Save config file
2. Completely quit Claude Desktop
3. Restart Claude Desktop
4. Verify with `/gemini-cli:help`

### Environment variables not working
```bash
# Check current settings
echo $GEMINI_MODEL
echo $GOOGLE_GENERATIVE_AI_API_KEY
```

## Debug Mode

Enable debug logging:
```json
{
  "mcpServers": {
    "gemini-cli": {
      "command": "gemini-mcp",
      "env": {
        "DEBUG": "true"
      }
    }
  }
}
```

## Getting Help

1. Check [GitHub Issues](https://github.com/jamubc/gemini-mcp-tool/issues)
2. Enable debug mode
3. Collect error logs
4. Open a new issue with details

## Quick Fixes

### Reset Everything
```bash
# Remove and reinstall
npm uninstall -g gemini-mcp-tool
npm install -g gemini-mcp-tool

# Reset Gemini CLI
gemini config reset
gemini config set api_key YOUR_API_KEY
```

### Test Basic Functionality
```bash
# Test Gemini CLI
gemini "Hello"

# Test MCP Tool
/gemini-cli:ping

# Test file analysis
/gemini-cli:analyze @README.md summarize
```