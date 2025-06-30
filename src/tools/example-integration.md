# Minimal Integration Steps for index.ts

To integrate the dynamic tool loading system while preserving all existing functionality:

## 1. Add import at the top of index.ts:
```typescript
import { toolLoader } from './tools/index.js';
```

## 2. Initialize tools at startup (in main() function):
```typescript
async function main() {
  console.warn("Starting Gemini CLI MCP server...");
  
  // Load dynamic tools
  await toolLoader.loadTools();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.warn("Gemini CLI MCP server is running on stdio");
}
```

## 3. Modify ListToolsRequestSchema handler (around line 356):
```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Get dynamic tools
  const dynamicTools = toolLoader.getTools();
  
  return {
    tools: [
      // All existing tools remain exactly as they are
      {
        name: "ask-gemini",
        description: "Execute 'gemini -p <prompt>' to get Gemini AI's response...",
        // ... rest of the tool definition
      },
      // ... other built-in tools
      
      // Add dynamic tools at the end
      ...dynamicTools
    ]
  };
});
```

## 4. Modify CallToolRequestSchema handler (around line 698):
```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const builtInTools = ["ask-gemini", "sandbox-test", "Ping", "Help"];
  
  // First check built-in tools (existing code remains the same)
  if (builtInTools.includes(toolName)) {
    // ... existing tool handling code ...
  } 
  // Then check dynamic tools
  else {
    const tool = toolLoader.getTool(toolName);
    if (tool) {
      try {
        const result = await tool.execute(request.params.arguments);
        
        // Return in standard MCP format
        return {
          content: [
            {
              type: "text",
              text: result
            }
          ],
          isError: false
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error in ${toolName}: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    } else {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }
  }
});
```

## 5. Update create.sh to use the new template:
```bash
# In create.sh, change line 52:
cp contribution/templates/new-tool.ts "src/tools/${TOOL_NAME}.tool.ts"

# And update sed commands for TypeScript
```

## That's it!

This minimal approach:
- Preserves ALL existing functionality exactly as-is
- Adds dynamic tool loading for `.tool.ts` files in `src/tools/`
- Maintains the structured response system and behavioral flags
- Requires only 4 small changes to index.ts
- Tools created with create.sh will work after `npm run build`