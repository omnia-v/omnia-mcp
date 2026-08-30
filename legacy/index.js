// @omnia-voice/mcp is now @error-bar/mcp. Re-export so existing imports keep working.
process.emitWarning(
  "@omnia-voice/mcp is renamed to @error-bar/mcp — update your import; this shim will be removed in a later release.",
  { code: "OMNIA_MCP_RENAMED" },
);
export * from "@error-bar/mcp";
