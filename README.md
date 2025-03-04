# Docs.rs MCP Server

A MCP server for managing Rust documentation through cargo doc commands. This server provides tools to check, build, and search Rust documentation locally.

## Features

### Tools

- `check_doc` - Check if documentation is built for a specific crate

  - Parameters:
    - `project_path`: Path to the Rust project
    - `crate_name`: Name of the crate to check

- `build_doc` - Build documentation for a specific crate

  - Parameters:
    - `project_path`: Path to the Rust project
    - `crate_name`: Name of the crate to build documentation for
    - `no_deps` (optional): Whether to skip building documentation for dependencies

- `search_doc` - Search within a crate's documentation
  - Parameters:
    - `project_path`: Path to the Rust project
    - `crate_name`: Name of the crate to search in
    - `query`: Search keyword or symbol
    - `limit` (optional): Maximum number of results to return (default: 10)

## Requirements

- Node.js 16 or later
- Rust and Cargo installed
- [Optional] ripgrep installed for faster documentation search

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

1. Check if documentation is built:

```typescript
const result = await claude.useMcpTool("docs-rs-mcp", "check_doc", {
  project_path: "/path/to/rust/project",
  crate_name: "my-crate",
});
```

2. Build documentation:

```typescript
const result = await claude.useMcpTool("docs-rs-mcp", "build_doc", {
  project_path: "/path/to/rust/project",
  crate_name: "my-crate",
  no_deps: true,
});
```

3. Search documentation:

```typescript
const result = await claude.useMcpTool("docs-rs-mcp", "search_doc", {
  project_path: "/path/to/rust/project",
  crate_name: "my-crate",
  query: "HashMap",
  limit: 5,
});
```

## Error Handling

The server provides detailed error messages for common issues:

- `INVALID_PATH`: Project path is invalid or Cargo.toml not found
- `BUILD_FAILED`: Documentation build failed
- `SEARCH_FAILED`: Search operation failed
- `CACHE_ERROR`: Cache system error
- `CARGO_ERROR`: Cargo command execution failed

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
