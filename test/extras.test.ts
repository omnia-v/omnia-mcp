import { describe, it, expect, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { OmniaClient } from "../src/client.js";
import { AFTER_TRAFFIC_FLOWS } from "../src/extras.js";

async function connect(siteFetch: typeof fetch) {
  const client = new OmniaClient({ apiKey: "sk_test", fetch: (async () => new Response("{}")) as unknown as typeof fetch });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await createServer({ client, fetch: siteFetch, siteUrl: "https://site.test/" }).connect(st);
  const mcp = new Client({ name: "t", version: "0" });
  await mcp.connect(ct);
  return mcp;
}

describe("resources and prompts", () => {
  it("serves agent-setup.md and llms.txt fetched live from the site, and the after-traffic steps inline", async () => {
    const seen: string[] = [];
    const f = vi.fn(async (url: string | URL | Request) => {
      seen.push(String(url));
      return new Response(`# doc at ${String(url)}`, { status: 200 });
    }) as unknown as typeof fetch;
    const mcp = await connect(f);
    const { resources } = await mcp.listResources();
    expect(resources.map((r) => r.uri).sort()).toEqual(["errorbar://after-traffic-flows", "errorbar://agent-setup.md", "errorbar://llms.txt"]);

    const setup = await mcp.readResource({ uri: "errorbar://agent-setup.md" });
    expect(setup.contents[0].text).toBe("# doc at https://site.test/agent-setup.md");
    const llms = await mcp.readResource({ uri: "errorbar://llms.txt" });
    expect(llms.contents[0].text).toBe("# doc at https://site.test/llms.txt");
    const steps = await mcp.readResource({ uri: "errorbar://after-traffic-flows" });
    expect(steps.contents[0].text).toBe(AFTER_TRAFFIC_FLOWS);
    expect(seen).toEqual(["https://site.test/agent-setup.md", "https://site.test/llms.txt"]);
  });

  it("a site outage becomes a readable note, never a thrown resource", async () => {
    const f = vi.fn(async () => { throw new Error("ENOTFOUND"); }) as unknown as typeof fetch;
    const mcp = await connect(f);
    const r = await mcp.readResource({ uri: "errorbar://agent-setup.md" });
    expect(r.contents[0].text).toContain("Could not fetch");
    expect(r.contents[0].text).toContain("ENOTFOUND");
  });

  it("prompts name the task tools that perform each step", async () => {
    const mcp = await connect((async () => new Response("x")) as unknown as typeof fetch);
    const { prompts } = await mcp.listPrompts();
    expect(prompts.map((p) => p.name).sort()).toEqual(["after-traffic-flows", "release-check", "set-up-errorbar"]);
    const p = await mcp.getPrompt({ name: "release-check", arguments: { eval_id: "r1" } });
    const t = (p.messages[0].content as { text: string }).text;
    expect(t).toContain('can_i_ship with eval_id "r1"');
    const s = await mcp.getPrompt({ name: "set-up-errorbar" });
    expect((s.messages[0].content as { text: string }).text).toContain("errorbar://agent-setup.md");
    expect(AFTER_TRAFFIC_FLOWS).toContain("screen_my_traffic");
    expect(AFTER_TRAFFIC_FLOWS).toContain("is_my_judge_trustworthy");
    expect(AFTER_TRAFFIC_FLOWS).toContain("can_i_ship");
  });
});
