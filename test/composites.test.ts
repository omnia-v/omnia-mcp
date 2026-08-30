import { describe, it, expect, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { OmniaClient } from "../src/client.js";

type Route = (url: URL, init: RequestInit) => { status?: number; body: unknown } | undefined;

function harness(route: Route) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(url));
    const method = init?.method ?? "GET";
    calls.push({ method, url: u.pathname + u.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = route(u, init ?? {}) ?? { status: 404, body: { error: "no route in test" } };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  const client = new OmniaClient({ apiKey: "sk_test", fetch: f, baseUrl: "https://api.test" });
  return { client, calls };
}

async function connect(client: OmniaClient) {
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await createServer({ client, pollIntervalMs: 0, fetch: (async () => new Response("x")) as unknown as typeof fetch }).connect(st);
  const mcp = new Client({ name: "t", version: "0" });
  await mcp.connect(ct);
  return mcp;
}

async function call(mcp: Client, name: string, args: Record<string, unknown> = {}) {
  const res = (await mcp.callTool({ name, arguments: args })) as { isError?: boolean; content: { text: string }[] };
  const t = res.content[0].text;
  let parsed: unknown = null;
  try { parsed = JSON.parse(t); } catch { /* text */ }
  return { isError: res.isError ?? false, text: t, json: parsed as Record<string, unknown> };
}

const DONE_SCREENING = {
  id: "run_1",
  status: "DONE",
  results: {
    sample_count: 40,
    per_candidate: [
      { model: "google/gemma-3-27b-it", win_rate: 0.6625, ci95: [0.5076, 0.789], unreportable: false },
      { model: "nvidia/Nemotron-3_5-Lightning", win_rate: 0.45, ci95: [0.307, 0.602], unreportable: false },
    ],
    screening: {
      incumbent: { model: "meta-llama/Llama-3.3-70B-Instruct", est_usd_per_request: 0.00013 },
      per_candidate: [
        { model: "google/gemma-3-27b-it", status: "verified-better", quality: "better", est_savings_pct: 23.49, similarity: { match_rate: 0.7 } },
        { model: "nvidia/Nemotron-3_5-Lightning", status: "tied-but-cheaper", quality: "tied", est_savings_pct: 50.84, similarity: { match_rate: 0.425 } },
      ],
      recommendation: { action: "switch", model: "google/gemma-3-27b-it", status: "verified-better" },
    },
  },
};

describe("screen_my_traffic", () => {
  it("creates a screening against stored answers, polls to DONE, and answers from the intervals", async () => {
    let polls = 0;
    const { client, calls } = harness((u, init) => {
      if (u.pathname === "/v1/evals" && init.method === "POST") return { status: 201, body: { id: "run_1", status: "PENDING" } };
      if (u.pathname === "/v1/evals/run_1") return { body: ++polls < 2 ? { id: "run_1", status: "RUNNING", progress_ratio: 0.5 } : DONE_SCREENING };
      return undefined;
    });
    const mcp = await connect(client);
    const r = await call(mcp, "screen_my_traffic", { tag: "support-agent", candidate_models: ["google/gemma-3-27b-it"] });
    expect(r.isError).toBe(false);
    expect(calls[0].body).toMatchObject({ screening: true, baseline_model: "__stored__", candidate_models: ["google/gemma-3-27b-it"], sample_filters: { tag: "support-agent" } });
    expect(polls).toBe(2);
    expect(r.json.recommendation).toContain("switch to google/gemma-3-27b-it");
    const c = (r.json.candidates as Record<string, unknown>[])[0];
    expect(c).toMatchObject({ verdict: "verified-better", wins_vs_today: "66.3%", win_rate_ci95: "[50.8, 78.9]", cost_vs_today: "−23%", behaves_like_production: "70%" });
    expect(String(r.json.how_to_read)).toContain("lower bound");
  });

  it("returns the run id to poll when the wait runs out, and surfaces a funds-gate 402 as an error", async () => {
    const { client } = harness((u, init) => {
      if (u.pathname === "/v1/evals" && init.method === "POST") return { status: 201, body: { id: "run_2", status: "PENDING", progress_ratio: 0 } };
      if (u.pathname === "/v1/evals/run_2") return { body: { id: "run_2", status: "RUNNING", progress_ratio: 0.1 } };
      return undefined;
    });
    const mcp = await connect(client);
    const r = await call(mcp, "screen_my_traffic", { wait_seconds: 0 });
    expect(r.isError).toBe(false);
    expect(r.json).toMatchObject({ run_id: "run_2", status: "PENDING" });
    expect(String(r.json.next)).toContain("get_eval");

    const broke = harness((u, init) => (u.pathname === "/v1/evals" && init.method === "POST" ? { status: 402, body: { error: "insufficient funds" } } : undefined));
    const r2 = await call(await connect(broke.client), "screen_my_traffic", {});
    expect(r2.isError).toBe(true);
    expect(r2.text).toContain("HTTP 402");
    expect(r2.text).toContain("insufficient funds");
  });
});

describe("is_my_judge_trustworthy", () => {
  const judgeA = { id: "c1", name: "Agent responsibility", unit: "trace", population: "support-agent", status: "active", trust: "trustworthy", tpr: 0.9605, tpr_ci: [0.93, 0.98], tnr: 0.9672, tnr_ci: [0.95, 0.98], kappa: 0.911, alignment_n: 1189, aligned_at: "2026-08-13T12:00:00Z", drift_status: "ok", online_enabled: true };
  const judgeB = { id: "c2", name: "Tone", unit: "request", status: "active", trust: "under-measured", fail_grades_needed: 12, pass_grades_needed: 0, tpr: 1, tpr_ci: [0.72, 1], tnr: 0.9, tnr_ci: [0.8, 0.95], kappa: 0.6, alignment_n: 18, drift_status: "ok" };

  it("summarises one judge with intervals and the one action that changes its state", async () => {
    const { client } = harness((u) => (u.pathname === "/v1/criteria/c2" ? { body: judgeB } : undefined));
    const r = await call(await connect(client), "is_my_judge_trustworthy", { criterion_id: "c2" });
    expect(r.isError).toBe(false);
    const j = r.json.judge as Record<string, unknown>;
    expect(j).toMatchObject({ trust: "under-measured", catches_failures: "100.0%", catches_failures_ci95: "[72.0, 100.0]", passes_clean: "90.0%", graded_n: 18 });
    expect(String(j.action)).toContain("12 more failing");
  });

  it("without an id, groups every judge by trust and lists what needs work", async () => {
    const { client } = harness((u) => (u.pathname === "/v1/criteria" ? { body: { object: "list", data: [judgeA, judgeB, { ...judgeB, id: "c3", status: "retired" }] } } : undefined));
    const r = await call(await connect(client), "is_my_judge_trustworthy", {});
    expect(r.json.judges).toBe(2);
    expect(r.json.by_trust).toEqual({ trustworthy: 1, "under-measured": 1 });
    expect((r.json.trustworthy as unknown[]).length).toBe(1);
    expect((r.json.needs_work as Record<string, unknown>[])[0]).toMatchObject({ id: "c2", trust: "under-measured" });
  });
});

describe("can_i_ship", () => {
  it("gates the newest DONE run with the certified-switch default and reports 412 as a verdict, not an error", async () => {
    const { client, calls } = harness((u) => {
      if (u.pathname === "/v1/evals") return { body: { data: [{ id: "r9", status: "RUNNING" }, { id: "r8", name: "Judge A run", status: "DONE", eval_kind: "criterion", baseline_model: "__stored__", judge_model: "openai/gpt-oss-120b" }] } };
      if (u.pathname === "/v1/evals/r8/gate") return { status: 412, body: { pass: false, status: "DONE", checks: [{ check: "noninferiority", model: "Qwen/Qwen3-30B-A3B-Instruct-2507", required: 0.3386, actual: 0.2550, pass: false }] } };
      return undefined;
    });
    const r = await call(await connect(client), "can_i_ship", {});
    expect(r.isError).toBe(false);
    expect(r.json.ship).toBe(false);
    expect(r.json.thresholds).toEqual({ noninferiority_margin: 0.05 });
    expect(String(r.json.defaulted)).toContain("certified switch");
    expect(calls[1].url).toBe("/v1/evals/r8/gate?noninferiority_margin=0.05");
    expect((r.json.checks as Record<string, unknown>[])[0]).toMatchObject({ check: "noninferiority", actual: 0.255, pass: false });
  });

  it("passes explicit thresholds through and says ship on a 200", async () => {
    const { client, calls } = harness((u) => {
      if (u.pathname === "/v1/evals/r1") return { body: { id: "r1", status: "DONE", eval_kind: "comparison" } };
      if (u.pathname === "/v1/evals/r1/gate") return { status: 200, body: { pass: true, status: "DONE", checks: [{ check: "win_rate", model: "m", required: 0.6, actual: 0.61, pass: true }] } };
      return undefined;
    });
    const r = await call(await connect(client), "can_i_ship", { eval_id: "r1", min_win_rate: 0.6, model: "m" });
    expect(r.json.ship).toBe(true);
    expect(r.json.defaulted).toBeNull();
    expect(calls[1].url).toBe("/v1/evals/r1/gate?min_win_rate=0.6&model=m");
  });

  it("refuses to invent a floor for a criterion run against a live baseline", async () => {
    const { client } = harness((u) => (u.pathname === "/v1/evals/r2" ? { body: { id: "r2", status: "DONE", eval_kind: "criterion", baseline_model: "meta-llama/Llama-3.3-70B-Instruct" } } : undefined));
    const r = await call(await connect(client), "can_i_ship", { eval_id: "r2" });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("min_pass_rate");
  });
});
