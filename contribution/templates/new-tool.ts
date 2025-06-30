// Template for creating a new MCP tool
// Save this file as: src/tools/{{TOOL_NAME}}.tool.ts
// Replace {{TOOL_NAME}} with your tool name (e.g., "calculator")
// Replace {{DESCRIPTION}} with your tool description

import { Tool } from './index.js';

const {{TOOL_NAME}}Tool: Tool = {
  name: "{{TOOL_NAME}}",
  description: "{{DESCRIPTION}}",
  inputSchema: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "The input to process"
      }
      // Add more properties as needed
    },
    required: ["prompt"]
  },
  
  async execute(args: any): Promise<string> {
    const prompt = args.prompt as string;
    
    try {
      // Implement your tool logic here
      // For example, if calling an external command:
      // const result = await executeCommand("your-command", [prompt]);
      
      // For now, just return a placeholder
      const result = `Processed: ${prompt}`;
      
      return result;
    } catch (error) {
      throw new Error(`{{TOOL_NAME}} error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

export default {{TOOL_NAME}}Tool;