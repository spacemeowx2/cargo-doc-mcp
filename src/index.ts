#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { DocManager } from "./doc-manager.js";
import { DocError } from "./types.js";

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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "check_doc",
        description: "Check if documentation is built for a specific crate",
        inputSchema: {
          type: "object",
          properties: {
            project_path: {
              type: "string",
              description: "Path to the Rust project",
            },
            crate_name: {
              type: "string",
              description: "Name of the crate to check",
            },
          },
          required: ["project_path", "crate_name"],
        },
      },
      {
        name: "build_doc",
        description: "Build documentation for a specific crate",
        inputSchema: {
          type: "object",
          properties: {
            project_path: {
              type: "string",
              description: "Path to the Rust project",
            },
            crate_name: {
              type: "string",
              description: "Name of the crate to build documentation for",
            },
            no_deps: {
              type: "boolean",
              description: "Whether to skip building documentation for dependencies",
              default: false,
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
              description: "Path to the Rust project",
            },
            crate_name: {
              type: "string",
              description: "Name of the crate to search in",
            },
            query: {
              type: "string",
              description: "Search query (keyword or symbol)",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return",
              minimum: 1,
              default: 10,
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
      case "check_doc": {
        const { project_path, crate_name } = request.params.arguments as {
          project_path: string;
          crate_name: string;
        };

        const isBuilt = await docManager.checkDoc(project_path, crate_name);

        return {
          content: [
            {
              type: "text",
              text: isBuilt
                ? `Documentation for ${crate_name} is built.`
                : `Documentation for ${crate_name} is not built.`,
            },
          ],
        };
      }

      case "build_doc": {
        const { project_path, crate_name, no_deps } = request.params
          .arguments as {
            project_path: string;
            crate_name: string;
            no_deps?: boolean;
          };

        const docPath = await docManager.buildDoc(project_path, crate_name, no_deps);

        return {
          content: [
            {
              type: "text",
              text: `Documentation built successfully. Output: ${docPath}`,
            },
          ],
        };
      }

      case "search_doc": {
        const { project_path, crate_name, query, limit } = request.params
          .arguments as {
            project_path: string;
            crate_name: string;
            query: string;
            limit?: number;
          };

        const results = await docManager.searchDoc(project_path, crate_name, query, {
          limit,
        });

        return {
          content: [
            {
              type: "text",
              text: `Found ${results.length} results:`,
            },
            ...results.map((result) => ({
              type: "text" as const,
              text: `\n- ${result.title}\n  URL: ${result.url}\n  ${result.snippet}`,
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
    console.error("Docs.rs MCP server running on stdio");
  } catch (error) {
    console.error("Server initialization error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
