# @omnia-voice/mcp — renamed

This package is now **[`@error-bar/mcp`](https://www.npmjs.com/package/@error-bar/mcp)**.

```bash
claude mcp remove errorbar
claude mcp add errorbar -e ERRORBAR_API_KEY=sk_… -- npx -y @error-bar/mcp
```

or change `"args": ["-y", "@omnia-voice/mcp"]` → `"args": ["-y", "@error-bar/mcp"]` in your `mcpServers` config. The env var is `ERRORBAR_API_KEY` (`OMNIA_API_KEY` still works).

This shim depends on `@error-bar/mcp` and forwards to it, so an unchanged config keeps working — it will be removed in a later release.
