import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { OmniaClient, ApiResponse } from "./client.js";
import type { CompositeTool } from "./profiles.js";

/**
 * Task-shaped tools — the questions people actually ask, answered by the
 * right sequence of API calls with the doctrine applied:
 *
 *   screen_my_traffic        "would a cheaper (or newer) model hold?"
 *   is_my_judge_trustworthy  "can I believe this judge's numbers?"
 *   can_i_ship               "does the evidence let this change through?"
 *
 * Each returns a compact, opinionated answer instead of a raw API body, and
 * each says which one-per-endpoint tool to call for the detail. Nothing here
 * decides on a point estimate: verdicts come from the interval, as the
 * platform's own gate and screening code do.
 */

export interface CompositeOptions {
  client: OmniaClient;
  /** Between polls of a queued run. Tests set 0. */
  pollIntervalMs?: number;
  /** Wall-clock cap for a poll loop. */
  maxWaitMs?: number;
}

type ToolResult = {
  isError?: boolean;
  content: { type: "text"; text: string }[];
};

const text = (t: string, isError = false): ToolResult => ({
  isError,
  content: [{ type: "text", text: t }],
});
const json = (v: unknown, isError = false) => text(JSON.stringify(v, null, 2), isError);

function bodyOf(res: ApiResponse): unknown {
  return res.json !== undefined ? res.json : res.text;
}

function failure(what: string, res: ApiResponse): ToolResult {
  const body = bodyOf(res);
  const detail = typeof body === "string" ? body.slice(0, 800) : JSON.stringify(body, null, 2).slice(0, 1200);
  return text(`${what}: HTTP ${res.status}\n${detail}`, true);
}

const pct = (x: unknown, digits = 1): string | null =>
  typeof x === "number" && Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : null;
const ci = (v: unknown): string | null =>
  Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number"
    ? `[${(v[0] * 100).toFixed(1)}, ${(v[1] * 100).toFixed(1)}]`
    : null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// ---------------------------------------------------------------------------

async function screenMyTraffic(
  args: { candidate_models?: string[]; sample_count?: number; tag?: string; wait_seconds?: number },
  o: CompositeOptions,
): Promise<ToolResult> {
  const body: Rec = {
    screening: true,
    name: `Screening via MCP · ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    baseline_model: "__stored__",
  };
  if (args.candidate_models?.length) body.candidate_models = args.candidate_models;
  if (args.sample_count !== undefined) body.sample_count = args.sample_count;
  if (args.tag) body.sample_filters = { tag: args.tag };

  const created = await o.client.request({ method: "POST", path: "/v1/evals", body });
  if (!created.ok) return failure("screening was not created", created);
  const run0 = rec(created.json);
  const id = String(run0.id ?? "");
  if (!id) return failure("screening created but no run id in the response", created);

  const waitMs = Math.max(0, (args.wait_seconds ?? 600) * 1000);
  const interval = o.pollIntervalMs ?? 10_000;
  const started = Date.now();
  let run = run0;
  while (run.status !== "DONE" && run.status !== "ERROR" && run.status !== "CANCELLED") {
    if (Date.now() - started >= waitMs) break;
    await sleep(interval);
    const r = await o.client.request({ method: "GET", path: "/v1/evals/{id}", pathParams: { id } });
    if (!r.ok) return failure(`screening ${id} queued, but polling it failed`, r);
    run = rec(r.json);
  }

  if (run.status !== "DONE") {
    return json({
      run_id: id,
      status: run.status,
      progress: run.progress_ratio,
      error: run.error ?? null,
      next:
        run.status === "ERROR" || run.status === "CANCELLED"
          ? "The run did not finish; get_eval shows the error."
          : `Still running. Call get_eval with id "${id}" until status is DONE, then read results.screening.`,
    });
  }

  const results = rec(run.results);
  const screening = rec(results.screening);
  const byModel = new Map<string, Rec>();
  for (const c of arr(results.per_candidate)) byModel.set(String(rec(c).model), rec(c));
  const incumbent = rec(screening.incumbent);
  const candidates = arr(screening.per_candidate).map((raw) => {
    const c = rec(raw);
    const w = byModel.get(String(c.model)) ?? {};
    const sim = rec(c.similarity);
    return {
      model: c.model,
      verdict: c.status,
      quality: c.quality,
      wins_vs_today: pct(w.win_rate),
      win_rate_ci95: ci(w.ci95),
      cost_vs_today: typeof c.est_savings_pct === "number" ? `${c.est_savings_pct >= 0 ? "−" : "+"}${Math.abs(c.est_savings_pct).toFixed(0)}%` : null,
      behaves_like_production: pct(sim.match_rate, 0),
      unmeasured: w.unreportable === true,
    };
  });
  const rc = rec(screening.recommendation);
  return json({
    run_id: id,
    incumbent: {
      model: incumbent.model,
      monthly_requests: incumbent.monthly_requests ?? null,
      est_usd_per_request: incumbent.est_usd_per_request ?? null,
    },
    sample_count: results.sample_count,
    candidates,
    recommendation:
      rc.action === "switch"
        ? `switch to ${rc.model} (${rc.status})`
        : "keep the current model — nothing beat it or tied it cheaper on this run",
    how_to_read:
      "verified-better = win-rate interval's lower bound above 50%; tied-but-cheaper = interval straddles 50% and the candidate is ≥5% cheaper (a saving without proof — settle it with a canary and a gate); inconclusive/worse per the interval; unmeasured = the judge could not read enough pairs. 'behaves like production' is reported, never part of the verdict. Costs are catalog estimates at your token shape, not a bill.",
    detail: `get_eval id="${id}" for the full run; get_eval_gate to turn it into a CI decision.`,
  });
}

// ---------------------------------------------------------------------------

function judgeSummary(c: Rec) {
  const trust = String(c.trust ?? "unmeasured");
  const needFail = typeof c.fail_grades_needed === "number" ? c.fail_grades_needed : null;
  const needPass = typeof c.pass_grades_needed === "number" ? c.pass_grades_needed : null;
  const action =
    trust === "trustworthy"
      ? "Use it. Its corrected rates are reportable; keep grading a trickle so drift is caught."
      : trust === "under-measured"
        ? `Not yet. Grade ${needFail ?? "more"} more failing and ${needPass ?? "more"} more passing exchanges, then run_criterion_alignment.`
        : trust === "borderline"
          ? "Not as is. Narrow the question to one property (the doctor in the dashboard shows where it disagrees), re-align."
          : trust === "misaligned"
            ? "Do not correct with it. Rewrite the question; its verdicts contradict the human grades."
            : "Unmeasured: it has no calibration. Grade ~30 real exchanges and run_criterion_alignment.";
  return {
    id: c.id,
    name: c.name,
    unit: c.unit === "trace" ? "whole agent runs" : "single exchanges",
    population: c.population ?? c.scope_tag ?? null,
    trust,
    catches_failures: pct(c.tpr),
    catches_failures_ci95: ci(c.tpr_ci),
    passes_clean: pct(c.tnr),
    passes_clean_ci95: ci(c.tnr_ci),
    kappa: typeof c.kappa === "number" ? Number(c.kappa.toFixed(3)) : null,
    graded_n: c.alignment_n ?? null,
    aligned_at: c.aligned_at ?? null,
    drift: c.drift_status === "flagged" ? `flagged: ${c.drift_reason ?? c.drift_signal ?? "see get_criterion"}` : "ok",
    online_monitoring: c.online_enabled === true,
    action,
  };
}

async function isMyJudgeTrustworthy(
  args: { criterion_id?: string },
  o: CompositeOptions,
): Promise<ToolResult> {
  if (args.criterion_id) {
    const r = await o.client.request({
      method: "GET",
      path: "/v1/criteria/{id}",
      pathParams: { id: args.criterion_id },
    });
    if (!r.ok) return failure(`criterion ${args.criterion_id}`, r);
    return json({
      judge: judgeSummary(rec(r.json)),
      how_to_read:
        "Trust is read from where the TPR/TNR intervals sit, never from accuracy. A calibration is a (judge, question, population) triple and expires after 30 days; 'flagged' drift voids it. get_criterion_certificate gives the signed document.",
    });
  }
  const r = await o.client.request({ method: "GET", path: "/v1/criteria" });
  if (!r.ok) return failure("criteria", r);
  const rows = arr(rec(r.json).data).map((x) => rec(x)).filter((c) => c.status !== "retired");
  const judges = rows.map(judgeSummary);
  const counts: Record<string, number> = {};
  for (const j of judges) counts[j.trust] = (counts[j.trust] ?? 0) + 1;
  return json({
    judges: judges.length,
    by_trust: counts,
    trustworthy: judges.filter((j) => j.trust === "trustworthy").map((j) => ({ id: j.id, name: j.name, kappa: j.kappa })),
    needs_work: judges.filter((j) => j.trust !== "trustworthy").map((j) => ({ id: j.id, name: j.name, trust: j.trust, action: j.action })),
    how_to_read:
      "Trust is read from where the TPR/TNR intervals sit, never from accuracy. Pass a criterion_id for one judge's full numbers.",
  });
}

// ---------------------------------------------------------------------------

async function canIShip(
  args: {
    eval_id?: string;
    min_pass_rate?: number;
    min_win_rate?: number;
    noninferiority_margin?: number;
    min_assertion_pass_rate?: number;
    model?: string;
  },
  o: CompositeOptions,
): Promise<ToolResult> {
  let run: Rec;
  if (args.eval_id) {
    const r = await o.client.request({ method: "GET", path: "/v1/evals/{id}", pathParams: { id: args.eval_id } });
    if (!r.ok) return failure(`eval ${args.eval_id}`, r);
    run = rec(r.json);
  } else {
    const r = await o.client.request({ method: "GET", path: "/v1/evals" });
    if (!r.ok) return failure("evals", r);
    const done = arr(rec(r.json).data).map((x) => rec(x)).find((x) => x.status === "DONE");
    if (!done) return text("No finished eval run in this workspace yet. Run one (create_eval or screen_my_traffic) and come back.", true);
    run = done;
  }
  const id = String(run.id);

  const query: Rec = {};
  for (const k of ["min_pass_rate", "min_win_rate", "noninferiority_margin", "min_assertion_pass_rate", "model"] as const) {
    if (args[k] !== undefined) query[k] = args[k];
  }
  let defaulted: string | null = null;
  const hasThreshold = ["min_pass_rate", "min_win_rate", "noninferiority_margin", "min_assertion_pass_rate"].some((k) => query[k] !== undefined);
  if (!hasThreshold) {
    if (run.eval_kind === "criterion" && run.baseline_model === "__stored__") {
      query.noninferiority_margin = 0.05;
      defaulted = "noninferiority_margin 0.05 — the certified switch test: each candidate's corrected pass-rate floor within 5 points of the incumbent's stored answers";
    } else if (run.eval_kind === "comparison") {
      query.min_win_rate = 0.5;
      defaulted = "min_win_rate 0.5 — each candidate's win-rate interval floor at or above even odds";
    } else {
      return text(
        `Run ${id} is a criterion run against a live baseline; pick the floor yourself: pass min_pass_rate (0..1) and call again.`,
        true,
      );
    }
  }

  const g = await o.client.request({ method: "GET", path: "/v1/evals/{id}/gate", pathParams: { id }, query });
  if (g.status !== 200 && g.status !== 412) return failure(`gate for ${id}`, g);
  const gate = rec(g.json);
  const checks = arr(gate.checks).map((c) => rec(c));
  return json({
    ship: gate.pass === true,
    run: { id, name: run.name, kind: run.eval_kind, status: run.status, judge: run.judge_model },
    thresholds: query,
    defaulted,
    checks: checks.map((c) => ({
      check: c.check,
      model: c.model,
      required: c.required,
      actual: c.actual,
      pass: c.pass,
      note: c.note ?? undefined,
    })),
    reason: gate.reason ?? null,
    how_to_read:
      "'actual' is the interval's LOWER bound (or an exact count for assertions), never the point estimate. A run that is not DONE fails closed. HTTP 412 is the verdict, not an error. To make this the CI step: curl -f the same URL with these query parameters.",
  });
}

// ---------------------------------------------------------------------------

/** The composite tools, in the same shape the manifest tools take. */
export function compositeDefinitions(o: CompositeOptions) {
  return {
    screen_my_traffic: {
      title: "screen my traffic",
      description:
        "Would a cheaper (or newer) model hold on this workspace's own traffic? Starts a zero-config screening — the dominant logged model is the incumbent, its STORED answers the baseline, the cheaper model of each family (or the candidates you pass) the challengers — waits for it, and returns each candidate's verdict from the win-rate interval plus a switch/keep recommendation. SPENDS MONEY: judging and candidate generations bill the workspace wallet (402 when the wallet cannot cover the funds gate). Needs request logging on and logged traffic. Prefer this over create_eval for the 'is X better/cheaper' question.",
      inputSchema: {
        candidate_models: z.array(z.string()).max(6).optional().describe("Catalog model ids to test instead of the auto-picked cheaper set (max 6). An upgrade counts — anything in the catalog."),
        sample_count: z.number().int().min(5).max(500).optional().describe("Prompts to sample (5..500). Default: the server's screening default."),
        tag: z.string().optional().describe("Only traffic logged with this tag (one tag = one population)."),
        wait_seconds: z.number().int().min(0).max(1800).optional().describe("How long to wait for the run before returning its id to poll. Default 600; 0 returns immediately."),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      spends: true,
      readOnly: false,
      handler: (a: Record<string, unknown>) => screenMyTraffic(a as Parameters<typeof screenMyTraffic>[0], o),
    },
    is_my_judge_trustworthy: {
      title: "is my judge trustworthy",
      description:
        "Can this workspace's judges be believed? For one criterion (pass criterion_id) or all of them: the trust verdict read from the TPR/TNR intervals (trustworthy / under-measured / borderline / misaligned / unmeasured), how often it catches real failures and passes clean ones with 95% intervals, κ, how many grades it was measured on and when, drift status, and the one action that changes its state. Read-only.",
      inputSchema: {
        criterion_id: z.string().optional().describe("One criterion's id for its full numbers; omit for every judge in the workspace."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      spends: false,
      readOnly: true,
      handler: (a: Record<string, unknown>) => isMyJudgeTrustworthy(a as Parameters<typeof isMyJudgeTrustworthy>[0], o),
    },
    can_i_ship: {
      title: "can I ship",
      description:
        "Does the evidence let this change through? Reads the gate on a finished eval run (the latest DONE run when eval_id is omitted) with your thresholds — or sensible defaults: the certified-switch test (noninferiority_margin 0.05) for a criterion run against stored answers, min_win_rate 0.5 for a comparison — and returns ship/hold with every check's required vs actual, where 'actual' is the interval's LOWER bound. Read-only; the same call is the CI step.",
      inputSchema: {
        eval_id: z.string().optional().describe("The run to gate. Default: the newest DONE run."),
        min_pass_rate: z.number().min(0).max(1).optional().describe("Criterion runs: corrected pass-rate CI floor must be ≥ this."),
        min_win_rate: z.number().min(0).max(1).optional().describe("Comparison runs: every candidate's win-rate CI floor must be ≥ this."),
        noninferiority_margin: z.number().min(0).max(1).optional().describe("Certified switch: candidate's corrected pass-rate floor ≥ incumbent's rate − margin (needs a stored baseline and a calibrated judge)."),
        min_assertion_pass_rate: z.number().min(0).max(1).optional().describe("Exact all-assertions pass rate must be ≥ this."),
        model: z.string().optional().describe("Restrict the checks to one candidate key."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      spends: false,
      readOnly: true,
      handler: (a: Record<string, unknown>) => canIShip(a as Parameters<typeof canIShip>[0], o),
    },
  } satisfies Record<CompositeTool, unknown>;
}

export function registerComposites(
  server: McpServer,
  o: CompositeOptions,
  enabled: ReadonlySet<CompositeTool>,
): void {
  const defs = compositeDefinitions(o);
  for (const name of Object.keys(defs) as CompositeTool[]) {
    if (!enabled.has(name)) continue;
    const d = defs[name];
    server.registerTool(
      name,
      { title: d.title, description: d.description, inputSchema: d.inputSchema, annotations: d.annotations },
      async (args: Record<string, unknown>) => {
        try {
          return await d.handler(args ?? {});
        } catch (e) {
          return text(`${name} failed: ${(e as Error).message}`, true);
        }
      },
    );
  }
}
