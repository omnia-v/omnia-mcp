import { describe, it, expect, vi } from "vitest";
import { OmniaClient, DEFAULT_BASE_URL } from "../src/client.js";

function fakeFetch(status: number, body: string, contentType = "application/json") {
  const calls: { url: string; init: RequestInit }[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(body, { status, headers: { "content-type": contentType } });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("OmniaClient", () => {
  it("fills path params, encodes them, and serialises query values", () => {
    const c = new OmniaClient({ apiKey: "sk_x" });
    const url = c.buildUrl("/v1/criteria/{id}/certificate", { id: "a b/c" }, { limit: 10, kind: undefined, flag: true, ids: ["x", "y"] });
    expect(url).toBe(`${DEFAULT_BASE_URL}/v1/criteria/a%20b%2Fc/certificate?limit=10&flag=true&ids=x&ids=y`);
    expect(() => c.buildUrl("/v1/evals/{id}", {}, {})).toThrow(/missing path parameter: id/);
  });

  it("sends the bearer key, JSON body on writes, none on GET, and parses JSON responses", async () => {
    const { f, calls } = fakeFetch(201, '{"id":"e1"}');
    const c = new OmniaClient({ apiKey: "sk_x", fetch: f, baseUrl: "https://example.test/api/" });
    const res = await c.request({ method: "POST", path: "/v1/evals", body: { name: "n" } });
    expect(res).toMatchObject({ status: 201, ok: true, json: { id: "e1" } });
    expect(calls[0].url).toBe("https://example.test/api/v1/evals");
    const h = calls[0].init.headers as Record<string, string>;
    expect(h.authorization).toBe("Bearer sk_x");
    expect(h["content-type"]).toBe("application/json");
    expect(h.accept).not.toContain("text/plain");
    expect(calls[0].init.body).toBe('{"name":"n"}');
    await c.request({ method: "GET", path: "/v1/evals", body: { ignored: true } });
    expect(calls[1].init.body).toBeUndefined();
  });

  it("returns non-JSON bodies as text and never throws on API errors", async () => {
    const { f } = fakeFetch(403, '{"error":"scope evals:write required"}');
    const c = new OmniaClient({ apiKey: "sk_x", fetch: f });
    const res = await c.request({ method: "DELETE", path: "/v1/evals/{id}", pathParams: { id: "e1" } });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
    expect(res.json).toEqual({ error: "scope evals:write required" });
    const csv = fakeFetch(200, "id,verdict\nr1,PASS\n", "text/csv");
    const c2 = new OmniaClient({ apiKey: "sk_x", fetch: csv.f });
    const r2 = await c2.request({ method: "GET", path: "/v1/logs/export" });
    expect(r2.text).toBe("id,verdict\nr1,PASS\n");
    expect(r2.json).toBeUndefined();
  });
});
