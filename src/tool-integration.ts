// Example of how to integrate dynamic tool loading into index.ts
// This shows the minimal changes needed while preserving all existing functionality

import { toolLoader } from './tools/index.js';

// Load dynamic tools at startup (add this near the top of index.ts after imports)
export async function initializeTools() {
  await toolLoader.loadTools();
  console.warn('[Gemini MCP] Dynamic tools loaded');
}

// Modified tool list handler that includes both built-in and dynamic tools
export async function getToolsList() {
  // Start with all existing built-in tools (preserve exactly as they are)
  const builtInTools = [
    {
      name: "ask-gemini", 
      description: "Execute 'gemini -p <prompt>' to get Gemini AI's response. Use when: 1) User asks for Gemini's opinion/analysis, 2) User wants to analyze large files with @file syntax, 3) User uses /gemini-cli:analyze command. Supports -m flag for model selection and -s flag for sandbox testing.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
          },
          model: {
            type: "string",
            description: "Optional model to use (e.g., 'gemini-2.5-flash'). If not specified, uses the default model (gemini-2.5-pro).",
          },
          sandbox: {
            type: "boolean",
            description: "Use sandbox mode (-s flag) to safely test code changes, execute scripts, or run potentially risky operations in an isolated environment",
            default: false,
          },
        },
        required: ["prompt"],
      },
    },
    // ... rest of built-in tools remain exactly the same
  ];
  
  // Add dynamic tools
  const dynamicTools = toolLoader.getTools();
  
  return [...builtInTools, ...dynamicTools];
}

// Modified tool execution that handles both built-in and dynamic tools
export async function executeTool(toolName: string, args: any): Promise<any> {
  // First check if it's a built-in tool (handle exactly as before)
  const builtInTools = ["ask-gemini", "sandbox-test", "sandbox-file-test", "debug-prompts", "list-models", "set-api-key"];
  
  if (builtInTools.includes(toolName)) {
    // Return null to indicate it should be handled by existing code
    return null;
  }
  
  // Then check dynamic tools
  const tool = toolLoader.getTool(toolName);
  if (tool) {
    try {
      const result = await tool.execute(args);
      // Use the existing createStructuredResponse for consistency
      return result;
    } catch (error) {
      throw error; // Let the main handler format the error response
    }
  }
  
  // Tool not found
  return null;
}