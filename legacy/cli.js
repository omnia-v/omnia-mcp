#!/usr/bin/env node
// @omnia-voice/mcp is now @error-bar/mcp. Say so on stderr (stdout is the MCP
// transport and must stay clean), then run the real server.
process.stderr.write(
  "[@omnia-voice/mcp] renamed to @error-bar/mcp — update your mcpServers config; this shim will be removed in a later release.\n",
);
await import("@error-bar/mcp/cli");
