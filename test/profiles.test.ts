import { describe, it, expect } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, selectComposites, selectOperations } from "../src/server.js";
import { COMPOSITE_TOOLS, PROFILES, resolveProfile } from "../src/profiles.js";
import { OPERATIONS } from "../src/manifest.js";
import { OmniaClient } from "../src/client.js";

const KNOWN = new Set<string>([...OPERATIONS.map((o) => o.name), ...COMPOSITE_TOOLS]);

async function listTools(opts: Parameters<typeof createServer>[0]) {
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await createServer(opts).connect(st);
  const mcp = new Client({ name: "t", version: "0" });
  await mcp.connect(ct);
  return (await mcp.listTools()).tools.map((t) => t.name);
}

const client = new OmniaClient({ apiKey: "sk_test", fetch: (async () => new Response("{}")) as unknown as typeof fetch });

describe("profiles", () => {
  it("only name tools that exist — a renamed route cannot leave a profile pointing at nothing", () => {
    for (const [name, p] of Object.entries(PROFILES)) {
      for (const t of p.tools) expect(KNOWN.has(t), `${name}: ${t}`).toBe(true);
      expect(new Set(p.tools).size).toBe(p.tools.length);
    }
  });

  it("monitor is read-only by construction; every profile is much smaller than the full set", () => {
    const monitor = PROFILES.monitor.tools;
    for (const t of monitor) {
      const op = OPERATIONS.find((o) => o.name === t);
      if (op) expect(op.method, t).toBe("GET");
      else expect(t).not.toBe("screen_my_traffic");
    }
    for (const p of Object.values(PROFILES)) expect(p.tools.length).toBeLessThanOrEqual(14);
  });

  it("all (the default) is everything plus the task tools; unknown profiles throw", async () => {
    expect(resolveProfile(undefined)).toBeNull();
    expect(resolveProfile("all")).toBeNull();
    expect(() => resolveProfile("nope")).toThrow(/unknown profile/);
    const names = await listTools({ client });
    expect(names.length).toBe(OPERATIONS.length + COMPOSITE_TOOLS.length);
    // Task tools are registered first so a client listing in order sees them first.
    expect(names.slice(0, COMPOSITE_TOOLS.length)).toEqual([...COMPOSITE_TOOLS]);
  });

  it("a profile exposes exactly its list (task tools first), and the flags still narrow it", async () => {
    const names = await listTools({ client, profile: "release" });
    expect([...names].sort()).toEqual([...PROFILES.release.tools].sort());
    expect(names.slice(0, 2)).toEqual(["screen_my_traffic", "can_i_ship"]);
    expect(selectOperations({ profile: "release", readOnly: true }).every((o) => o.method === "GET")).toBe(true);
    expect([...selectComposites({ profile: "release", readOnly: true })]).toEqual(["can_i_ship"]);
    expect([...selectComposites({ profile: "release", noSpend: true })]).toEqual(["can_i_ship"]);
    expect([...selectComposites({ profile: "monitor" })]).toEqual(["is_my_judge_trustworthy"]);
    expect([...selectComposites({ only: ["screen_my_traffic", "list_evals"] })]).toEqual(["screen_my_traffic"]);
  });
});
