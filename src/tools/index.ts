// Tool loader - minimal system for dynamic tool loading
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
  execute: (args: any) => Promise<string>;
}

class ToolLoader {
  private tools: Map<string, Tool> = new Map();

  async loadTools() {
    const toolsDir = __dirname;

    try {
      const files = await fs.readdir(toolsDir);

      for (const file of files) {
        if (file.endsWith(".tool.js") || file.endsWith(".tool.ts")) {
          try {
            const module = await import(path.join(toolsDir, file));
            if (module.default && this.isValidTool(module.default)) {
              this.tools.set(module.default.name, module.default);
            }
          } catch (error) {
            console.error(`[Gemini MCP] Failed to load tool ${file}:`, error);
          }
        }
      }
    } catch (error) {
      // Tools directory exists, so this shouldn't happen
      console.error("[Gemini MCP] Error loading tools:", error);
    }
  }

  private isValidTool(tool: any): tool is Tool {
    return (
      typeof tool.name === "string" &&
      typeof tool.description === "string" &&
      tool.inputSchema &&
      typeof tool.execute === "function"
    );
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }
}

export const toolLoader = new ToolLoader();
