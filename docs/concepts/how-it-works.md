# How It Works

Understanding the architecture and flow of Gemini MCP Tool.

## Architecture Overview

```
Claude Desktop/Code  →  MCP Protocol  →  Gemini MCP Tool  →  Gemini CLI  →  Gemini AI
                     ←                ←                    ←              ←
```

## Key Components

### 1. MCP Server
- Implements Model Context Protocol
- Handles communication with Claude
- Manages tool registration and execution

### 2. Gemini CLI Integration
- Executes `gemini` commands via subprocess
- Handles file paths and context
- Manages response parsing

### 3. Tool Registry
- **analyze**: File analysis and questions
- **sandbox**: Safe code execution
- **help**: Show available commands
- **ping**: Test connectivity

## Request Flow

1. **User Input** → Claude Desktop receives slash command or natural language
2. **MCP Protocol** → Claude sends request to MCP server
3. **Tool Execution** → Server maps to appropriate Gemini CLI command
4. **Gemini Processing** → CLI processes with Gemini's 2M token context
5. **Response** → Results returned through MCP protocol to Claude

## Why This Architecture?

- **Separation of Concerns**: Each component has a single responsibility
- **Extensibility**: Easy to add new tools or modify behavior
- **Reliability**: Error handling at each layer
- **Performance**: Async operations where possible