import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";

// Create server instance
const server = new Server(
  {
    name: "gemini-cli-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
      notifications: {},
    },
  }
);

/**
 * Sends a notification to the client
 * @param method The notification method
 * @param params The notification parameters
 */
async function sendNotification(method: string, params: any) {
  try {
    await server.notification({ method, params });
  } catch (error) {
    console.error(`[Gemini MCP] Failed to send notification:`, error);
  }
}

/**
 * Sends a status message that appears in Claude Code UI with ⎿ symbol
 * @param message The status message to display
 */
async function sendStatusMessage(message: string) {
  try {
    // Try using progress notification format
    await server.notification({
      method: "notifications/progress",
      params: {
        progressToken: "gemini-status",
        value: {
          kind: "report",
          message: message
        }
      }
    });
  } catch (error) {
    console.error(`[Gemini MCP] Failed to send status message:`, error);
  }
}

/**
 * Executes a shell command with proper argument handling
 * @param command The command to execute
 * @param args The arguments to pass to the command
 * @returns Promise resolving to the command output
 */
async function executeCommand(command: string, args: string[]): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    console.warn(`[Gemini MCP] [${startTime}] Starting: ${command} ${args.map(arg => `"${arg}"`).join(' ')}`);

    // Spawn the child process
    const childProcess = spawn(command, args, {
      env: process.env,
      shell: false, // Don't use shell to avoid escaping issues
      stdio: ['ignore', 'pipe', 'pipe'] // Explicitly set stdio
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Monitor progress every 5 seconds
    const progressInterval = setInterval(() => {
      if (!isResolved) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.warn(`[Gemini MCP] [${elapsed}s] Still running... stdout: ${stdout.length} bytes, stderr: ${stderr.length} bytes`);
        
        // Show a sample of what we've received so far
        if (stdout.length > 0) {
          console.warn(`[Gemini MCP] Latest stdout: "${stdout.slice(-100)}"`);
        }
        if (stderr.length > 0) {
          console.warn(`[Gemini MCP] Latest stderr: "${stderr.slice(-100)}"`);
        }
      }
    }, 5000);
    // Listen for data from stdout
    childProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdout += chunk;
    });

    // Listen for data from stderr
    childProcess.stderr.on('data', (data) => {
      const msg = data.toString();
      stderr += msg;
      
      // Log stderr output for debugging (but filter deprecation warnings)
      if (!msg.includes('DeprecationWarning')) {
        console.error(`[Gemini MCP] stderr: ${msg.trim()}`);
      }
    });

    // Listen for process errors
    childProcess.on('error', async (error) => {
      if (!isResolved) {
        isResolved = true;
        clearInterval(progressInterval);
        console.error(`[Gemini MCP] Process error:`, error);
        
        reject(new Error(`Failed to spawn command: ${error.message}`));
      }
    });

    // Listen for process close
    childProcess.on('close', async (code) => {
      if (!isResolved) {
        isResolved = true;
        clearInterval(progressInterval);
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.warn(`[Gemini MCP] [${elapsed}s] Process finished with exit code: ${code}`);
        
        if (code === 0) {
          console.warn(`[Gemini MCP] Success! Output length: ${stdout.length} bytes`);
          
          const output = stdout.trim();
          resolve(output);
        } else {
          console.error(`[Gemini MCP] Failed with exit code ${code}`);
          const errorMessage = stderr.trim() || 'Unknown error';
          
          reject(new Error(`Command failed with exit code ${code}: ${errorMessage}`));
        }
      }
    });
  });
}

/**
 * Executes Gemini CLI command with proper argument handling
 * @param prompt The prompt to pass to Gemini, including @ syntax
 * @returns Promise resolving to the command output
 */
async function executeGeminiCLI(prompt: string): Promise<string> {
  return executeCommand("gemini", ["-p", prompt]);
}

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "ask-gemini", 
        description: "ONLY use when user explicitly asks for 'Gemini's opinion' or 'what does Gemini think' or 'ask Gemini'. Gets Google Gemini AI's perspective. Optionally use @ syntax to include files.",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "Analysis request. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
            },
          },
          required: ["prompt"],
        },
      },
      {
        name: "Ping",
        description: "echo",
        inputSchema: {
          type: "object",
          properties: {
            prompt: {
              type: "string",
              description: "returns Pong!",
              default: "Pong!",
            },
          },
          required: [],
        },
      },
      {
        name: "Help",
        description: "Show gemini CLI help",
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// Handle list prompts request (for slash commands)
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: [
        {
          name: "analyze",
          description: "Analyze files using Gemini CLI or ask general questions",
          arguments: [
            {
              name: "prompt",
              description: "Analysis request. Use @ syntax to include files (e.g., '@file.js explain this') or ask general questions",
              required: true,
            },
          ],
        },
        {
          name: "help",
          description: "Show help",
        },
        {
          name: "ping",
          description: "Test connection",
          arguments: [
            {
              name: "message",
              description: "Message to echo",
              required: false,
            },
          ],
        },
      ],
    };
  });

// Handle prompt execution (for slash commands)
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name;
    const args = request.params.arguments || {};

    switch (promptName) {
      case "analyze":
        const prompt = args.prompt as string;
        if (!prompt) {
          return {
            description: "Please provide a prompt for analysis",
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
                },
              },
            ],
          };
        }
        try {
          const result = await executeGeminiCLI(prompt);
          return {
            description: "Analysis complete",
            messages: [
              {
                role: "user",
                content: {
                  type: "text", 
                  text: result,
                },
              },
            ],
          };
        } catch (error) {
          return {
            description: "Analysis failed",
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
              },
            ],
          };
        }

      case "help":
        try {
          const result = await executeCommand("gemini", ["--help"]);
          return {
            description: "Gemini CLI help",
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: result,
                },
              },
            ],
          };
        } catch (error) {
          return {
            description: "Help failed",
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
              },
            ],
          };
        }

      case "ping":
        const message = (args.message as string) || "Pong!";
        try {
          const result = await executeCommand("echo", [message]);
          return {
            description: "Ping successful",
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: result,
                },
              },
            ],
          };
        } catch (error) {
          return {
            description: "Ping failed",
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
              },
            ],
          };
        }

      default:
        throw new Error(`Unknown prompt: ${promptName}`);
    }
  });

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {

  const toolName = request.params.name;
  const validTools = [
    "ask-gemini", 
    "Ping",
    "Help"
  ];

  if (validTools.includes(toolName)) {
    try {
      console.warn(`[Gemini MCP] === TOOL INVOCATION ===`);
      console.warn(`[Gemini MCP] Tool: "${toolName}"`);
      console.warn(`[Gemini MCP] Raw arguments:`, JSON.stringify(request.params.arguments, null, 2));
      
      // Get prompt from arguments
      const prompt = (request.params.arguments?.prompt as string) || "";
      
      console.warn(`[Gemini MCP] Parsed prompt: "${prompt}"`);
      console.warn(`[Gemini MCP] ========================`);

      // Skip notifications for now to ensure fast response
      console.warn(`[Gemini MCP] ${toolName} tool starting...`);
      
      // Execute the appropriate command based on the tool
      let result: string;
      if (toolName === "Ping") {
        // For test tool, run echo command
        const message = prompt || "Pong!";
        
        const rawOutput = await executeCommand("echo", [message]);
        result = rawOutput;
      } else if (toolName === "Help") {
        // For help tool, run gemini --help
        const rawOutput = await executeCommand("gemini", ["--help"]);
        result = rawOutput;
      } else {
        // For ask-gemini tool, check if prompt is provided and includes @ syntaxcl
        if (!prompt.trim()) {
          return {
            content: [
              {
                type: "text",
                text: "Please provide a prompt for analysis. Use @ syntax to include files (e.g., '@largefile.js explain what this does') or ask general questions",
              },
            ],
            isError: true,
          };
        }
        
        console.warn(`[Gemini MCP] About to execute Gemini command...`);
        
        let statusLog = "🔄 Executing Gemini CLI command...\n\n";
        
        try {
          // Set a race between command execution and timeout
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Tool timeout after 30 seconds")), 30000);
          });
          
          result = await Promise.race([
            executeGeminiCLI(prompt),
            timeoutPromise as Promise<string>
          ]);
          
          console.warn(`[Gemini MCP] Gemini command completed successfully, result length: ${result.length}`);
          
          // Add status to our log
          statusLog += `✅ Gemini command completed successfully (${result.length} characters)\n\n`;
          statusLog += `📄 **Raw Gemini Output:**\n\`\`\`\n${result}\n\`\`\`\n\n`;
          statusLog += `🤖 **Processed Response:**\n${result}`;
          
          result = statusLog;
          
        } catch (error) {
          console.error(`[Gemini MCP] Command failed:`, error);
          statusLog += `❌ Gemini command failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
          result = statusLog + `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
        }
        console.warn(`[Gemini MCP] About to return result to Claude...`);
      }
      
      return {
        content: [
          {
            type: "text",
            text: result,
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error(`[Gemini MCP] Error in tool '${toolName}':`, error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        content: [
          {
            type: "text",
            text: `Error executing ${toolName}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  } else {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

// Start the server
async function main() {
  console.warn("Starting Gemini CLI MCP server...");
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.warn("Gemini CLI MCP server is running on stdio");
}

// Handle errors
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
