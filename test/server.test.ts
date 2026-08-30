import { describe, it, expect, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, selectOperations } from "../src/server.js";
import { OmniaClient } from "../src/client.js";
import { OPERATIONS } from "../src/manifest.js";

function harness(status = 200, body = '{"ok":true}', contentType = "application/json") {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(body, { status, headers: { "content-type": contentType } });
  }) as unknown as typeof fetch;
  const client = new OmniaClient({ apiKey: "sk_test", fetch: f, baseUrl: "https://api.test/api" });
  return { client, calls };
}

async function connect(server: ReturnType<typeof createServer>) {
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const mcp = new Client({ name: "t", version: "0" });
  await mcp.connect(ct);
  return mcp;
}

describe("createServer", () => {
  it("exposes one tool per operation with read-only/destructive annotations", async () => {
    const { client } = harness();
    const mcp = await connect(createServer({ client }));
    const { tools } = await mcp.listTools();
    // Every API operation, plus the three task-shaped tools (profiles.ts).
    expect(tools.length).toBe(OPERATIONS.length + 3);
    const get = tools.find((t) => t.name === "get_eval")!;
    expect(get.annotations?.readOnlyHint).toBe(true);
    expect(get.inputSchema.required).toEqual(["id"]);
    const del = tools.find((t) => t.name === "delete_eval")!;
    expect(del.annotations?.destructiveHint).toBe(true);
    const create = tools.find((t) => t.name === "create_eval")!;
    expect(create.description).toContain("SPENDS MONEY");
  });

  it("routes path, query and body arguments to the right place", async () => {
    const { client, calls } = harness(200, '{"samples":[]}');
    const mcp = await connect(createServer({ client }));
    await mcp.callTool({ name: "get_eval_samples", arguments: { id: "run_1" } });
    expect(calls[0].url).toBe("https://api.test/api/v1/evals/run_1/samples");
    await mcp.callTool({ name: "list_alerts", arguments: { kind: "model_shift", limit: 5 } });
    expect(new URL(calls[1].url).searchParams.get("limit")).toBe("5");
    expect(new URL(calls[1].url).searchParams.get("kind")).toBe("model_shift");
    calls.splice(1, 1);
    expect(calls[0].init.method).toBe("GET");
    expect(calls[0].init.body).toBeUndefined();

    await mcp.callTool({ name: "create_label", arguments: { request_id: "r1", verdict: "fail", critique: "wrong" } });
    expect(calls[1].url).toBe("https://api.test/api/v1/labels");
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ request_id: "r1", verdict: "fail", critique: "wrong" });
  });

  it("returns API errors as isError text with the status, never a thrown exception", async () => {
    const { client } = harness(403, '{"error":"scope evals:write required"}');
    const mcp = await connect(createServer({ client }));
    const res = (await mcp.callTool({ name: "delete_eval", arguments: { id: "e1" } })) as { isError?: boolean; content: { text: string }[] };
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("HTTP 403");
    expect(res.content[0].text).toContain("scope evals:write required");
  });

  it("read-only / no-spend / only filters narrow the tool set", () => {
    expect(selectOperations({ readOnly: true }).every((o) => o.method === "GET")).toBe(true);
    expect(selectOperations({ noSpend: true }).some((o) => o.name === "create_eval")).toBe(false);
    expect(selectOperations({ noSpend: true }).some((o) => o.name === "list_evals")).toBe(true);
    expect(selectOperations({ only: ["list_evals", "get_eval"] }).map((o) => o.name)).toEqual(["list_evals", "get_eval"]);
  });

  it("replaces HTML error pages with a one-line explanation", async () => {
    const { client } = harness(404, "<!DOCTYPE html><html><head><title>404: This page could not be found.</title></head><body>…</body></html>", "text/html; charset=utf-8");
    const mcp = await connect(createServer({ client }));
    const res = (await mcp.callTool({ name: "list_alerts", arguments: {} })) as { isError?: boolean; content: { text: string }[] };
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("HTTP 404");
    expect(res.content[0].text).toContain("not available at this base URL");
    expect(res.content[0].text).not.toContain("<html");
  });

  it("truncates oversized bodies and says so", async () => {
    const big = JSON.stringify({ rows: "x".repeat(5000) });
    const { client } = harness(200, big);
    const mcp = await connect(createServer({ client, maxChars: 1000 }));
    const res = (await mcp.callTool({ name: "list_logs", arguments: {} })) as { content: { text: string }[] };
    expect(res.content[0].text.length).toBeLessThan(1200);
    expect(res.content[0].text).toContain("truncated");
  });
});
