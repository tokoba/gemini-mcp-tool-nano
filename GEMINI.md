# Project: gemini-mcp-tool

## Project Overview

This is a Node.js project written in TypeScript that acts as a Model Context Protocol (MCP) server. Its primary purpose is to expose the functionality of the Google Gemini CLI to an AI assistant, such as Claude. This allows the AI assistant to leverage the power of Gemini for tasks like analyzing large files, searching the web, and running code in a sandbox.

The server is designed to be used as a command-line tool, either installed globally or run via `npx`. It communicates with the AI assistant over standard I/O, following the MCP specification.

## Building and Running

The project is managed with `npm`. The following scripts are defined in `package.json`:

* **`npm run build`**: Compiles the TypeScript code from `src` to `dist`.
* **`npm run start`**: Starts the server from the compiled code in `dist`.
* **`npm run dev`**: Compiles the TypeScript code and then starts the server. This is useful for development.
* **`npm run lint`**: Checks the TypeScript code for errors without compiling.
* **`npm test`**: Currently, there are no tests for this project.

## Development Conventions

* **Code Style**: The project uses Prettier for code formatting. The configuration is in `.prettierrc`.
* **TypeScript**: The project is written in TypeScript. The configuration is in `tsconfig.json`.
* **Dependencies**: The project uses `npm` to manage dependencies. The dependencies are listed in `package.json`.
* **Tools**: The server exposes a set of tools to the AI assistant. These tools are defined in the `src/tools` directory. Each tool has a Zod schema for validating its arguments.

## Key Files

* **`src/index.ts`**: The main entry point for the server. It initializes the MCP server, registers the tools, and handles requests from the AI assistant.
* **`src/tools/index.ts`**: The tool registry. It imports all the tool definitions and exports them.
* **`src/tools/ask-gemini.tool.ts`**: The core tool that interacts with the Gemini CLI. It takes a prompt and other options and executes the `gemini` command.
* **`src/tools/brainstorm.tool.ts`**: A tool for generating ideas using different methodologies.
* **`src/tools/fetch-chunk.tool.ts`**: A utility tool for retrieving cached chunks from a `changeMode` response.
* **`src/tools/simple-tools.ts`**: Contains the `ping` and `Help` tools.
* **`src/tools/timeout-test.tool.ts`**: A tool for testing the timeout prevention system.
* **`package.json`**: The project's metadata, including its name, version, dependencies, and scripts.
* **`README.md`**: The project's documentation, including installation instructions and usage examples.
