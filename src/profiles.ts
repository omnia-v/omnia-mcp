/**
 * Profiles — curated views of the tool set, one per job.
 *
 * Seventy-six one-per-endpoint tools are the complete contract, and the wrong
 * thing to hand a model that has one question: every tool description is read
 * before the first call (~15–20k tokens for the full set), and a long list
 * makes the pick worse, not better. A profile is the handful of tools a job
 * needs, plus the task-shaped tools that answer the job's question directly.
 *
 * `all` (the default, so existing configs behave exactly as before) exposes
 * everything. `--read-only`, `--no-spend` and `--only` still apply on top.
 */

/** Task-shaped tools implemented in composites.ts (not in the manifest). */
export const COMPOSITE_TOOLS = [
  "screen_my_traffic",
  "is_my_judge_trustworthy",
  "can_i_ship",
] as const;
export type CompositeTool = (typeof COMPOSITE_TOOLS)[number];

export interface Profile {
  description: string;
  /** Manifest operation names and composite tool names, in listing order. */
  tools: readonly string[];
}

export const PROFILES: Record<string, Profile> = {
  setup: {
    description:
      "Connect traffic and get to the first verdict: setup status, logs, a screening, the first judge.",
    tools: [
      "get_setup_status",
      "screen_my_traffic",
      "list_logs",
      "get_trace",
      "list_evals",
      "get_eval",
      "list_criterion_templates",
      "list_criteria",
      "create_criterion",
      "get_criterion",
      "run_criterion_alignment",
      "is_my_judge_trustworthy",
    ],
  },
  monitor: {
    description:
      "Is quality holding, and can the judges be trusted? Read-only by construction.",
    tools: [
      "get_setup_status",
      "is_my_judge_trustworthy",
      "list_criteria",
      "get_criterion",
      "get_criterion_alignment",
      "get_criterion_certificate",
      "list_alerts",
      "get_judge_settings",
      "get_failure_clusters",
      "list_refusals",
      "list_evals",
      "get_eval",
      "get_eval_pairwise",
    ],
  },
  release: {
    description:
      "Ship or hold: run the comparison, read the gate on the interval, repoint the alias.",
    tools: [
      "can_i_ship",
      "screen_my_traffic",
      "list_evals",
      "get_eval",
      "create_eval",
      "get_eval_gate",
      "get_eval_pairwise",
      "label_eval_pair",
      "get_eval_evidence",
      "compare_evals",
      "list_aliases",
      "upsert_alias",
      "get_criterion_certificate",
      "verify_document",
    ],
  },
};

export const PROFILE_NAMES = ["all", ...Object.keys(PROFILES)] as const;

/** The names a profile allows, or null for "everything". Unknown = throws:
 *  a typo in a config must not silently expose the whole surface. */
export function resolveProfile(name: string | undefined): ReadonlySet<string> | null {
  if (!name || name === "all") return null;
  const p = PROFILES[name];
  if (!p) {
    throw new Error(
      `unknown profile "${name}" — one of: ${PROFILE_NAMES.join(", ")}`,
    );
  }
  return new Set(p.tools);
}
