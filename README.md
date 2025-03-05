# cargo doc MCP Server

A MCP server for managing Rust documentation through cargo doc commands. This server provides tools to check, build, and search Rust documentation locally.

## Features

### Tools

- `get_crate_doc` - Get crate's main documentation page for understanding overall concepts and usage

  - Parameters:
    - `project_path`: Path to the Rust project (must be absolute path)
    - `crate_name`: Name of the crate to get documentation for

- `list_symbols` - List all symbols (structs, enums, traits, etc.) in a crate's documentation

  - Parameters:
    - `project_path`: Path to the Rust project (must be absolute path)
    - `crate_name`: Name of the crate to list symbols for

- `search_doc` - Search within a crate's documentation
  - Parameters:
    - `project_path`: Path to the Rust project (must be absolute path)
    - `crate_name`: Name of the crate to search in
    - `query`: Search query (keyword or symbol)
    - `limit` (optional): Maximum number of results to return (default: 10)

## Requirements

- Node.js 16 or later
- Rust and Cargo installed

## Installation

Install dependencies:

```bash
pnpm install
```

Build the server:

```bash
pnpm run build
```

For development with auto-rebuild:

```bash
pnpm run watch
```

## Integration with Claude Desktop

To use with Claude Desktop, add the server configuration:

On MacOS:

```bash
vim ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

Add the following configuration:

```json
{
  "mcpServers": {
    "docs-rs-mcp": {
      "command": "/absolute/path/to/docs-rs-mcp/build/index.js"
    }
  }
}
```

## Usage Examples

1. Get crate documentation:

```typescript
const result = await claude.useMcpTool("docs-rs-mcp", "get_crate_doc", {
  project_path: "/path/to/rust/project",
  crate_name: "my-crate",
});
```

2. List symbols in documentation:

```typescript
const result = await claude.useMcpTool("docs-rs-mcp", "list_symbols", {
  project_path: "/path/to/rust/project",
  crate_name: "my-crate",
});
```

3. Search documentation:

```typescript
const result = await claude.useMcpTool("docs-rs-mcp", "search_doc", {
  project_path: "/path/to/rust/project",
  crate_name: "my-crate",
  query: "HashMap",
});
```

## Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the MCP Inspector:

```bash
pnpm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

## Cache System

The server maintains a cache of built documentation paths to improve performance. Cache entries expire after 24 hours to ensure documentation stays up-to-date.

## License

MIT
