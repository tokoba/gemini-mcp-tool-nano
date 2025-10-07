// Tool Registry Index - Registers all tools
import { askGeminiTool } from "./ask-gemini.tool.js";
import { fetchChunkTool } from "./fetch-chunk.tool.js";
import { toolRegistry } from "./registry.js";
// import { brainstormTool } from './brainstorm.tool.js';
// import { timeoutTestTool } from './timeout-test.tool.js';

toolRegistry.push(
  askGeminiTool,
  fetchChunkTool
  //   pingTool,
  //   helpTool,
  // brainstormTool,
  // timeoutTestTool
);

export * from "./registry.js";
