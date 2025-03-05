#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { DocManager } from "./doc-manager.js";
import { DocError } from "./types.js";
import { RustdocUrl } from "./url-utils.js";
import fs from "fs/promises";

const docManager = new DocManager();

const server = new Server(
  {
    name: "docs-rs-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// List available resource templates
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [
    {
      uriTemplate: "rustdoc://{path}",
      name: "Rust documentation file",
      mimeType: "text/html",
      description: "Access generated Rust documentation files using a direct file path.",
    },
  ],
}));

// Read resource content
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  try {
    try {
      const filePath = RustdocUrl.parse(request.params.uri);

      // Ensure file exists and is accessible
      await fs.access(filePath);

      // Read and convert content to markdown
      const markdown = await RustdocUrl.readContent(filePath);

      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "text/markdown",
            text: markdown,
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unable to access documentation file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      "Failed to read documentation file",
      error
    );
  }
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_crate_doc",
        description: "Get crate's main documentation page for understanding overall concepts and usage",
        inputSchema: {
          type: "object",
          properties: {
            project_path: {
              type: "string",
              description: "Path to the Rust project (must be absolute path)",
            },
            crate_name: {
              type: "string",
              description: "Name of the crate to get documentation for",
            }
          },
          required: ["project_path", "crate_name"],
        },
      },
      {
        name: "list_symbols",
        description: "List all symbols (structs, enums, traits, etc.) in a crate's documentation",
        inputSchema: {
          type: "object",
          properties: {
            project_path: {
              type: "string",
              description: "Path to the Rust project (must be absolute path)",
            },
            crate_name: {
              type: "string",
              description: "Name of the crate to list symbols for",
            },
          },
          required: ["project_path", "crate_name"],
        },
      },
      {
        name: "search_doc",
        description: "Search within a crate's documentation",
        inputSchema: {
          type: "object",
          properties: {
            project_path: {
              type: "string",
              description: "Path to the Rust project (must be absolute path)",
            },
            crate_name: {
              type: "string",
              description: "Name of the crate to search in",
            },
            query: {
              type: "string",
              description: "Search query (keyword or symbol)",
            },
          },
          required: ["project_path", "crate_name", "query"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "get_crate_doc": {
        const { project_path, crate_name } = request.params.arguments as {
          project_path: string;
          crate_name: string;
        };

        const content = await docManager.getCrateDoc(project_path, crate_name);

        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      }

      case "list_symbols": {
        const { project_path, crate_name } = request.params.arguments as {
          project_path: string;
          crate_name: string;
        };

        const symbols = await docManager.listSymbols(project_path, crate_name);

        return {
          content: [
            {
              type: "text",
              text: `Found ${symbols.length} symbols:\n`,
            },
            {
              type: "text",
              text: symbols
                .map((sym) => `${sym.type} ${sym.path}\n  URL: ${sym.url}`)
                .join("\n"),
            },
          ],
        };
      }

      case "search_doc": {
        const { project_path, crate_name, query } = request.params
          .arguments as {
            project_path: string;
            crate_name: string;
            query: string;
          };

        const results = await docManager.searchDoc(project_path, crate_name, query, {
          limit: 50,
        });

        return {
          content: [
            {
              type: "text",
              text: `Found ${results.length} results:`,
            },
            ...results.map((result) => ({
              type: "text" as const,
              text: `\n- ${result.title}\n  URL: ${result.url}`,
            })),
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    if (error instanceof DocError) {
      throw new McpError(ErrorCode.InternalError, error.message, {
        code: error.code,
        details: error.details,
      });
    }
    throw error;
  }
});

// Initialize server
async function main() {
  try {
    await docManager.initialize();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("cargo doc MCP server running on stdio");
  } catch (error) {
    console.error("Server initialization error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
