# File Analysis with @ Syntax

One of the most powerful features of Gemini MCP Tool is the ability to analyze files using the `@` syntax.

## Basic Usage

```
/gemini-cli:analyze @index.js explain this code
```

## Multiple Files

Analyze multiple files in one request:
```
/gemini-cli:analyze @src/server.js @src/client.js how do these interact?
```

## Entire Directories

Analyze whole directories:
```
/gemini-cli:analyze @src/**/*.ts summarize the TypeScript architecture
```

## Why @ Syntax?

- **Familiar**: Similar to mentions in social media
- **Explicit**: Clear which files are being analyzed
- **Flexible**: Works with single files, multiple files, or patterns
- **Powerful**: Leverages Gemini's 2M token context window

## Best Practices

### 1. Be Specific
```
// Good
@src/auth/login.js explain the authentication flow

// Too vague
@src explain everything
```

### 2. Use Patterns Wisely
```
// Analyze all test files
@**/*.test.js are all tests passing?

// Analyze specific module
@modules/payment/*.js review payment logic
```

### 3. Combine with Questions
```
@package.json @src/index.js is this properly configured?
```

## Token Optimization

Gemini's massive context window allows analyzing entire codebases, but be mindful:

- Start with specific files
- Use patterns for related files
- Gradually expand scope as needed

## Examples

### Code Review
```
@feature/new-api.js review this PR changes
```

### Documentation
```
@src/utils/*.js generate JSDoc comments
```

### Debugging
```
@error.log @src/handler.js why is this error occurring?
```