#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { OmniaClient, DEFAULT_BASE_URL } from "./client.js";
import { createServer } from "./server.js";
import { PROFILES, PROFILE_NAMES } from "./profiles.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  const eq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : undefined;
}
/** ERRORBAR_<name> first; the pre-rename OMNIA_<name> still works. */
function env(name: string): string | undefined {
  return process.env[`ERRORBAR_${name}`] ?? process.env[`OMNIA_${name}`];
}

if (flag("help") || flag("h")) {
  const profiles = Object.entries(PROFILES)
    .map(([k, p]) => `    ${k.padEnd(9)} ${p.description}\n${" ".repeat(14)}${p.tools.join(", ")}`)
    .join("\n");
  process.stdout.write(`errorbar MCP server v${version}

Usage: errorbar-mcp [--profile NAME] [--read-only] [--no-spend] [--only a,b,c] [--base-url URL]

Environment:
  ERRORBAR_API_KEY   (required) workspace API key, starts with sk_
  ERRORBAR_BASE_URL  API root, default ${DEFAULT_BASE_URL}
  (the OMNIA_* spellings of these are still accepted)

Flags:
  --profile NAME  a curated tool set for one job  (or ERRORBAR_MCP_PROFILE)
    all       every API operation plus the task tools (default)
${profiles}
  --read-only     expose only GET tools           (or ERRORBAR_MCP_READ_ONLY=1)
  --no-spend      hide tools that start billable work — eval runs, screening,
                  training, dedicated capacity     (or ERRORBAR_MCP_NO_SPEND=1)
  --only NAMES    comma-separated tool names to expose
  --base-url URL  override the API root

Task tools (in every profile that lists them): screen_my_traffic,
is_my_judge_trustworthy, can_i_ship. Resources: errorbar://agent-setup.md,
errorbar://llms.txt, errorbar://after-traffic-flows. Prompts: set-up-errorbar,
after-traffic-flows, release-check.
`);
  process.exit(0);
}

const apiKey = env("API_KEY");
if (!apiKey) {
  process.stderr.write("errorbar-mcp: ERRORBAR_API_KEY is not set\n");
  process.exit(2);
}

const profile = option("profile") ?? env("MCP_PROFILE") ?? "all";
if (!(PROFILE_NAMES as readonly string[]).includes(profile)) {
  process.stderr.write(`errorbar-mcp: unknown profile "${profile}" — one of: ${PROFILE_NAMES.join(", ")}\n`);
  process.exit(2);
}

const client = new OmniaClient({
  apiKey,
  baseUrl: option("base-url") ?? env("BASE_URL"),
  userAgent: `errorbar-mcp/${version}`,
});
const server = createServer({
  client,
  version,
  profile,
  readOnly: flag("read-only") || env("MCP_READ_ONLY") === "1",
  noSpend: flag("no-spend") || env("MCP_NO_SPEND") === "1",
  only: option("only")?.split(",").map((s) => s.trim()).filter(Boolean),
});
await server.connect(new StdioServerTransport());
