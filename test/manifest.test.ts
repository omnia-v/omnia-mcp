import { describe, it, expect } from "vitest";
import { OPERATIONS } from "../src/manifest.js";
import { inputShapeFor, descriptionFor } from "../src/server.js";

/** Every (method, path) under app/api/v1 in the platform repo at the time this manifest was generated. */
const PLATFORM_ROUTES = [
  "GET /v1/alerts",
  "DELETE /v1/aliases/{id}",
  "GET /v1/aliases",
  "PUT /v1/aliases",
  "GET /v1/audit/export",
  "GET /v1/audit/tombstones",
  "POST /v1/audit/tombstones",
  "GET /v1/audit/verify",
  "POST /v1/batches/{id}/cancel",
  "GET /v1/batches/{id}",
  "GET /v1/batches",
  "POST /v1/batches",
  "POST /v1/criteria/{id}/align",
  "GET /v1/criteria/{id}/alignment",
  "POST /v1/criteria/{id}/auto_improve",
  "GET /v1/criteria/{id}/certificate",
  "GET /v1/criteria/{id}",
  "PATCH /v1/criteria/{id}",
  "DELETE /v1/criteria/{id}",
  "POST /v1/criteria/{id}/scan",
  "GET /v1/criteria",
  "POST /v1/criteria",
  "POST /v1/criteria/suggest",
  "GET /v1/criteria/templates",
  "POST /v1/datasets/decontaminate",
  "POST /v1/datasets/from_logs",
  "GET /v1/dedicated/{id}",
  "PATCH /v1/dedicated/{id}",
  "DELETE /v1/dedicated/{id}",
  "GET /v1/dedicated",
  "POST /v1/dedicated",
  "GET /v1/dedicated/templates",
  "GET /v1/enforcement/refusals",
  "DELETE /v1/env/tools/{id}",
  "GET /v1/env/tools",
  "POST /v1/env/tools",
  "POST /v1/evals/{id}/cancel",
  "GET /v1/evals/{id}/evidence",
  "GET /v1/evals/{id}/gate",
  "GET /v1/evals/{id}",
  "DELETE /v1/evals/{id}",
  "GET /v1/evals/{id}/samples",
  "POST /v1/evals/{id}/pair_labels",
  "GET /v1/evals/{id}/pairwise",
  "GET /v1/evals/compare",
  "GET /v1/evals/failure_clusters",
  "GET /v1/evals",
  "POST /v1/evals",
  "GET /v1/fine_tuning/files",
  "POST /v1/fine_tuning/files",
  "POST /v1/fine_tuning/jobs/{id}/bakeoff",
  "GET /v1/fine_tuning/jobs/{id}/bakeoff",
  "GET /v1/fine_tuning/jobs/{id}",
  "DELETE /v1/fine_tuning/jobs/{id}",
  "GET /v1/fine_tuning/jobs",
  "POST /v1/fine_tuning/jobs",
  "GET /v1/grpo/runs/{id}",
  "POST /v1/grpo/runs/{id}/stop",
  "GET /v1/grpo/runs/{id}/weights",
  "GET /v1/grpo/runs",
  "POST /v1/grpo/runs",
  "POST /v1/label_sets/{id}/attach",
  "POST /v1/label_sets/{id}/freeze",
  "GET /v1/label_sets",
  "POST /v1/label_sets",
  "GET /v1/labels",
  "POST /v1/labels",
  "GET /v1/logs/export",
  "POST /v1/logs/import",
  "GET /v1/logs",
  "POST /v1/model_versions/{id}/adopt",
  "GET /v1/model_versions/{id}",
  "GET /v1/model_versions",
  "GET /v1/raft/rounds",
  "GET /v1/settings/judge",
  "PUT /v1/settings/judge",
  "GET /v1/setup/status",
  "GET /v1/traces/{traceId}",
  "POST /v1/verify",
  "GET /v1/reward/sessions",
  "POST /v1/reward/sessions",
  "GET /v1/reward/sessions/{id}",
  "DELETE /v1/reward/sessions/{id}",
  "POST /v1/reward/score",
  "POST /v1/reward/sessions/{id}/anchor",
  "POST /v1/reward/sessions/{id}/resume",
  "GET /v1/reward/sessions/{id}/export",
  "GET /v1/reward/sessions/{id}/environment",
  "GET /v1/endpoints",
  "POST /v1/endpoints",
  "DELETE /v1/endpoints/{id}",
];

describe("manifest", () => {
  it("covers every public platform route exactly once", () => {
    const have = new Set(OPERATIONS.map((o) => `${o.method} ${o.path}`));
    const want = new Set(PLATFORM_ROUTES);
    expect([...want].filter((r) => !have.has(r))).toEqual([]);
    expect([...have].filter((r) => !want.has(r))).toEqual([]);
    expect(OPERATIONS.length).toBe(PLATFORM_ROUTES.length);
  });

  it("has unique, MCP-legal tool names and non-empty descriptions", () => {
    const names = OPERATIONS.map((o) => o.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[a-z][a-z0-9_]{2,63}$/);
    for (const o of OPERATIONS) {
      expect(o.summary.length).toBeGreaterThan(20);
      expect(o.responseSummary.length).toBeGreaterThan(5);
      expect(descriptionFor(o)).toContain(o.path);
      // The batch object carries a literal `nebius_batch_id` field today (platform follow-up: rename); the name is exact, so only that token is allowed.
      expect(descriptionFor(o).replace(/nebius_batch_id/g, "")).not.toMatch(/nebius/i);
    }
  });

  it("declares every {path} placeholder as a required path param and builds a valid zod shape", () => {
    for (const o of OPERATIONS) {
      const placeholders = [...o.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      const declared = (o.pathParams ?? []).map((p) => p.name);
      expect(declared.sort()).toEqual(placeholders.sort());
      const shape = inputShapeFor(o);
      for (const p of placeholders) expect(shape[p]).toBeDefined();
      for (const p of o.body ?? []) expect(shape[p.name]).toBeDefined();
    }
  });

  it("labels the operations that start billable work", () => {
    const spend = OPERATIONS.filter((o) => o.spends).map((o) => o.name);
    expect(spend).toEqual(expect.arrayContaining(["create_eval", "start_grpo_run", "create_fine_tuning_job", "create_dedicated_endpoint"]));
    for (const o of OPERATIONS) if (o.spends) expect(o.method).not.toBe("GET");
  });
});
