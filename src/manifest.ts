/* Generated from the platform's app/api/v1 route contracts — do not hand-edit the shapes;
   regenerate when a route changes. One entry = one MCP tool. */
import type { Operation } from "./manifest-types.js";

export const OPERATIONS: readonly Operation[] = [
  {
    "name": "list_alerts",
    "method": "GET",
    "path": "/v1/alerts",
    "summary": "List every alert this workspace has fired, newest first, with the payload the notification carried, so a pipeline can react to quality, cost, or drift events without reading a mailbox.",
    "scope": "read",
    "query": [
      {
        "name": "kind",
        "type": "string",
        "description": "Filter to one alert kind.",
        "enum": [
          "error_rate",
          "latency_p90",
          "balance_low",
          "judge_drift",
          "quality_low",
          "model_shift",
          "quality_gate"
        ]
      },
      {
        "name": "since",
        "type": "string",
        "description": "ISO-8601 datetime; only alerts fired at or after this instant. 400 if unparseable."
      },
      {
        "name": "limit",
        "type": "integer",
        "description": "Page size, integer 1..200.",
        "default": 50
      },
      {
        "name": "cursor",
        "type": "string",
        "description": "Opaque cursor from a previous response's next_cursor (the id of the last alert on that page). Resumes after that alert."
      }
    ],
    "responseSummary": "{ alerts: [{ id, kind, fired_at (ISO), payload (JSON object: criterion, model, rates, reason as applicable) }], next_cursor: string|null }",
    "notes": "Keyset pagination: pass next_cursor back as cursor until it is null. 400 when since is not an ISO date or limit is outside 1..200. Cache-Control: no-store."
  },
  {
    "name": "list_aliases",
    "method": "GET",
    "path": "/v1/aliases",
    "summary": "List this workspace's model aliases (stable names your code calls) with their current target, canary split, quality-gate config, evidence policy and the eval run that authorized the current routing.",
    "scope": "read",
    "responseSummary": "{ object: \"list\", data: [{ id, name, target_model, canary_model, canary_percent, description, gate_criterion_id, gate_mode (\"recommend\"|\"auto\"), gate_min_samples, gate_rollback_threshold, gate_window_hours, gate_verdict ({decision, reason, canary, incumbent, acted}|null), gate_verdict_at, model_version_id, require_evidence, last_evidence_run_id, created_at, updated_at }] }",
    "notes": "Sorted by name ascending. last_evidence_run_id is null when the routing predates the evidence policy or went through as an audited override."
  },
  {
    "name": "upsert_alias",
    "method": "PUT",
    "path": "/v1/aliases",
    "summary": "Create or repoint a model alias by name (idempotent upsert) so production traffic moves to a new model without a redeploy; optionally attach a canary split, a quality gate, or an evidence-required policy.",
    "scope": "aliases:write",
    "body": [
      {
        "name": "name",
        "type": "string",
        "description": "Alias name, 3..64 chars of letters/digits/dots/dashes/underscores, must start and end alphanumeric, no '/'. Upsert key within the workspace.",
        "required": true
      },
      {
        "name": "target_model",
        "type": "string",
        "description": "Model id that receives the main share of traffic. Must be an available model or the call fails with \"Model '<id>' is not available.\"",
        "required": true
      },
      {
        "name": "canary_model",
        "type": "string",
        "description": "Model id for the canary arm (nullable). Must differ from target_model and be an available model. Required (non-null) whenever canary_percent > 0."
      },
      {
        "name": "canary_percent",
        "type": "integer",
        "description": "Integer 0..100 share of traffic sent to canary_model. Default 0. Ignored (stored as 0) when canary_model is null."
      },
      {
        "name": "description",
        "type": "string",
        "description": "Free-text note, max 200 chars (nullable)."
      },
      {
        "name": "gate_criterion_id",
        "type": "string",
        "description": "Id of a criterion in this workspace that scores both arms online. Null = no gate. The criterion must have been aligned at least once."
      },
      {
        "name": "gate_mode",
        "type": "string",
        "description": "\"recommend\" (default) only surfaces verdicts; \"auto\" lets the gate repoint the alias itself and requires a trustworthy, non-drift-flagged, request-unit judge that did not train the destination model.",
        "enum": [
          "recommend",
          "auto"
        ]
      },
      {
        "name": "gate_min_samples",
        "type": "integer",
        "description": "Scored requests both arms need before a verdict. Integer 10..1000, default 50."
      },
      {
        "name": "gate_rollback_threshold",
        "type": "number",
        "description": "Roll back when the canary's upper CI bound on pass rate is below this. Number 0..1, default 0.7."
      },
      {
        "name": "gate_window_hours",
        "type": "integer",
        "description": "Trailing window of online scores a verdict is computed over. Integer 1..720, default 168."
      },
      {
        "name": "require_evidence",
        "type": "boolean",
        "description": "Evidence policy. Omitted = leave the existing alias's setting unchanged (false on create). When on, a repoint that sends traffic to a model it is not already reaching is refused unless a finished comparison in the last 30 days proves the destination against the incumbent."
      },
      {
        "name": "override_reason",
        "type": "string",
        "description": "Audited escape hatch for the evidence policy: a written justification of at least 10 characters lets the repoint through and records an audit event. Blank/missing is NOT an override. Shorter than 10 chars is a 400."
      }
    ],
    "responseSummary": "200 with the alias object: { id, name, target_model, canary_model, canary_percent, description, gate_criterion_id, gate_mode, gate_min_samples, gate_rollback_threshold, gate_window_hours, gate_verdict, gate_verdict_at, model_version_id, require_evidence, last_evidence_run_id, created_at, updated_at }",
    "notes": "MOVES PRODUCTION TRAFFIC: the gateway resolves aliases within ~10s. Requires the key's minting user to be workspace OWNER/ADMIN (403 otherwise). Same status 200 whether created or updated. 412 Precondition Failed (code precondition_failed) when the evidence policy refuses the repoint; a brand-new alias is never blocked by the policy. 400 for schema failures, canary_percent > 0 without canary_model, canary equal to target, unavailable model, gate criterion never aligned, or auto-mode eligibility refusals (judge not trustworthy, drift-flagged, trace-unit, or judge trained the destination). 404 \"Gate criterion not found\". Billing always follows the model that actually ran; an alias is routing only."
  },
  {
    "name": "delete_alias",
    "method": "DELETE",
    "path": "/v1/aliases/{id}",
    "summary": "Remove a model alias; requests still using that name will fail afterwards, so this is a cutover step, not cleanup.",
    "scope": "aliases:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The alias id (from GET /v1/aliases), not its name."
      }
    ],
    "responseSummary": "200 { ok: true }",
    "notes": "OWNER/ADMIN only (403). 404 \"Alias not found\" when the id is not in this workspace. Audited with the model it pointed at."
  },
  {
    "name": "export_audit_log",
    "method": "GET",
    "path": "/v1/audit/export",
    "summary": "Export this workspace's audit rows with their hash-chain fields (seq, prev_hash, row_hash) as CSV or JSON, so a recipient can verify a later export reproduces the same hashes.",
    "scope": "read",
    "query": [
      {
        "name": "since",
        "type": "string",
        "description": "ISO-8601 datetime lower bound (inclusive) on the row timestamp. 400 if unparseable."
      },
      {
        "name": "until",
        "type": "string",
        "description": "ISO-8601 datetime upper bound (inclusive). 400 if unparseable."
      },
      {
        "name": "format",
        "type": "string",
        "description": "Output format.",
        "enum": [
          "csv",
          "json"
        ],
        "default": "csv"
      },
      {
        "name": "limit",
        "type": "integer",
        "description": "Max rows, positive integer; silently capped at 50000.",
        "default": 50000
      }
    ],
    "responseSummary": "format=json: { rows: [{ id, timestamp, event_type, category, status, actor_id, actor_email, actor_role, target_type, target_id, description, seq, prev_hash, row_hash }], truncated: boolean }. format=csv: text/csv attachment (Content-Disposition audit-<workspaceId>.csv) with header row seq,timestamp,event_type,category,status,actor_id,actor_email,actor_role,target_type,target_id,description,prev_hash,row_hash,id; header X-Truncated: true when the limit cut the result.",
    "notes": "Rows ordered by timestamp then seq ascending. Returns an empty set (not an error) if the log store is unavailable. Cache-Control: no-store.",
    "raw": true
  },
  {
    "name": "list_audit_tombstones",
    "method": "GET",
    "path": "/v1/audit/tombstones",
    "summary": "List acknowledged audit-chain gaps (tombstones) with the recorded reason for each lost slot, so a known loss can be distinguished from tampering.",
    "scope": "read",
    "responseSummary": "{ tombstones: [{ seq (integer), reason, created_at (ISO) }] } sorted by seq ascending",
    "notes": "The audit chain is platform-global, so this list is the same for every workspace. Cache-Control: no-store."
  },
  {
    "name": "create_audit_tombstone",
    "method": "POST",
    "path": "/v1/audit/tombstones",
    "summary": "Acknowledge a verified audit-chain gap with a written reason so the integrity check stops reporting it as unexplained; a platform-admin repair action, never a way to hide a gap.",
    "scope": "platform:write",
    "body": [
      {
        "name": "seq",
        "type": "integer",
        "description": "Positive integer chain sequence number. Must appear as a problem of kind \"gap\" in the latest stored verification (see GET /v1/audit/verify) or the call is refused.",
        "required": true
      },
      {
        "name": "reason",
        "type": "string",
        "description": "Why the slot was lost. Trimmed; at least 10 characters; stored up to 500 characters. Upserting an existing seq replaces the reason.",
        "required": true
      }
    ],
    "responseSummary": "201 { seq, reason, created_at }",
    "notes": "403 unless the key's minting user has the platform-level admin role (workspace OWNER/ADMIN is not enough). 400 for invalid JSON, wrong types, seq <= 0, reason under 10 chars, or a seq that is not a gap in the latest verification (message names when that verification ran, or that none has run yet)."
  },
  {
    "name": "get_audit_verification",
    "method": "GET",
    "path": "/v1/audit/verify",
    "summary": "Read the latest nightly whole-chain integrity verification of the audit log (ok flag, rows checked, head seq, problems found, acknowledged gaps) plus the tombstone list, as the platform's integrity statement.",
    "scope": "read",
    "responseSummary": "{ verification: { ran_at, ok, checked_rows, head_seq, problems: [{ seq, kind, detail }], acknowledged (count) } | null, tombstones: [{ seq, reason, created_at }], statement: string describing the hashing scheme }",
    "notes": "verification is null until the first nightly run has stored a result. The chain is platform-global; your own rows' hashes come from GET /v1/audit/export. Cache-Control: no-store."
  },
  {
    "name": "list_batches",
    "method": "GET",
    "path": "/v1/batches",
    "summary": "List this workspace's batch inference jobs, newest first, with status, request counts and billed cost.",
    "scope": "read",
    "responseSummary": "A bare JSON array (no envelope) of up to 100 batch objects: { id, nebius_batch_id (upstream batch id), endpoint, status (VALIDATING|IN_PROGRESS|FINALIZING|COMPLETED|FAILED|EXPIRED|CANCELLING|CANCELLED), request_total, request_completed, request_failed, completion_window, billed_cost_usd (number|null), created_at, output_file_id, error_file_id, error }",
    "notes": "Feature-flagged: every /v1/batches route returns 404 { error: \"Batch inference is not enabled\" } while the batch flag is off (code default is off). Statuses here are the stored values; GET /v1/batches/{id} refreshes them live."
  },
  {
    "name": "create_batch",
    "method": "POST",
    "path": "/v1/batches",
    "summary": "Submit an asynchronous, discounted batch of inference requests from a previously uploaded JSONL file, for workloads that can wait up to the completion window.",
    "scope": "platform:write",
    "body": [
      {
        "name": "input_file_id",
        "type": "string",
        "description": "Id of a file uploaded via /v1/files with purpose \"batch\" containing the request JSONL. Must belong to this workspace (or be the input of one of its past batches); otherwise 404 \"Input file not found\".",
        "required": true
      },
      {
        "name": "endpoint",
        "type": "string",
        "description": "The API route every line in the file targets.",
        "required": true,
        "enum": [
          "/v1/chat/completions",
          "/v1/completions",
          "/v1/embeddings"
        ]
      },
      {
        "name": "model",
        "type": "string",
        "description": "A representative model id from the file; it is the billing-rate basis. Must have configured pricing or the call is refused with 400.",
        "required": true
      },
      {
        "name": "completion_window",
        "type": "string",
        "description": "How long the batch may take, e.g. \"24h\".",
        "default": "24h"
      }
    ],
    "responseSummary": "201 with the batch object: { id, nebius_batch_id, endpoint, status, request_total, request_completed, request_failed, completion_window, billed_cost_usd, created_at, output_file_id, error_file_id, error }",
    "notes": "MONEY: the wallet must hold at least $0.10 of available runway to submit (402 otherwise); the batch discount and markup are frozen at submit time and the job is billed on completion. OWNER/ADMIN only (403). 400 when input_file_id/endpoint/model is missing or the body is not JSON. 503 when batch creation is temporarily unavailable upstream (the input file stays uploaded; retry later). 404 while the batch feature flag is off.",
    "spends": true
  },
  {
    "name": "get_batch",
    "method": "GET",
    "path": "/v1/batches/{id}",
    "summary": "Fetch one batch job with its status, request counts and output/error file ids refreshed live from the processing backend, to poll for completion.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The batch id from POST /v1/batches or GET /v1/batches (the platform id, not the upstream batch id)."
      }
    ],
    "responseSummary": "{ id, nebius_batch_id, endpoint, status, request_total, request_completed, request_failed, completion_window, billed_cost_usd, created_at, output_file_id, error_file_id, error }",
    "notes": "Best-effort live reconciliation: if the upstream status lookup fails the stored row is returned unchanged. Billing still happens in the background reconciler, not on this read. 404 \"Batch not found\" outside the workspace; 404 while the batch flag is off."
  },
  {
    "name": "cancel_batch",
    "method": "POST",
    "path": "/v1/batches/{id}/cancel",
    "summary": "Request cancellation of an in-flight batch job.",
    "scope": "platform:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The platform batch id."
      }
    ],
    "responseSummary": "200 with the updated batch object (status typically CANCELLING or CANCELLED)",
    "notes": "OWNER/ADMIN only (403). 404 \"Batch not found\". Audited. 404 while the batch feature flag is off. Work already completed before cancellation may still be billed."
  },
  {
    "name": "list_criteria",
    "method": "GET",
    "path": "/v1/criteria",
    "summary": "List this workspace's judge criteria with their calibration metrics (TPR/TNR/kappa with intervals), trust verdict, drift status and online-monitoring config, to see which judges are proven enough to gate on.",
    "scope": "read",
    "responseSummary": "{ object: \"list\", data: [{ id, name, description, judge_prompt, judge_model, status, source, unit (\"request\"|\"trace\"), population (tag), population_family, online_enabled, online_percent, online_cap_usd, online_spent_usd, tier (aligned|weak|misaligned|unmeasured), trust (trustworthy|misaligned|under-measured|borderline|unmeasured), fail_grades_needed, pass_grades_needed, tpr_ci ([lo,hi]|null), tnr_ci, drift_status (ok|flagged), drift_signal (stale|quality_drop|suspicious_rise|evidence_revised|null), drift_reason, drift_checked_at, tpr, tnr, kappa, alignment_n, aligned_at, created_at }] }",
    "notes": "trust is what every gate reads; tier is the legacy point-estimate badge. drift_status is derived (a fresh calibration supersedes a cached flag). drift_signal names the check that raised it: stale (calibration older than 30 days), quality_drop (live corrected rate fell well below what the judge validated at), suspicious_rise (traffic from a model TRAINED AGAINST this judge scores above what it validated at — an unvalidated gain), evidence_revised (grades the calibration was measured on were edited or deleted; clears on re-calibration or on reverting the edits)."
  },
  {
    "name": "create_criterion",
    "method": "POST",
    "path": "/v1/criteria",
    "summary": "Create a judge criterion (a rubric prompt run by a judge model) that can score traffic online and be calibrated against human labels.",
    "scope": "evals:write",
    "body": [
      {
        "name": "name",
        "type": "string",
        "description": "Unique within the workspace, trimmed, 1..80 chars. Duplicate name is a 400.",
        "required": true
      },
      {
        "name": "description",
        "type": "string",
        "description": "Optional note, max 500 chars (nullable)."
      },
      {
        "name": "judge_prompt",
        "type": "string",
        "description": "The rubric the judge model applies, trimmed, 10..4000 chars.",
        "required": true
      },
      {
        "name": "judge_model",
        "type": "string",
        "description": "Model id that runs the judgment. Must be an available model (400 \"Judge model '<id>' is not available.\").",
        "required": true
      },
      {
        "name": "unit",
        "type": "string",
        "description": "What one verdict covers: \"request\" judges one exchange, \"trace\" judges a whole agent run. CREATE-ONLY; cannot be changed later.",
        "enum": [
          "request",
          "trace"
        ],
        "default": "request"
      },
      {
        "name": "population",
        "type": "string",
        "description": "Request tag this criterion judges online AND calibrates against (one binding). Max 64 chars; \"\" = all traffic."
      },
      {
        "name": "population_family",
        "type": "string",
        "description": "Auto-detected traffic segment (a `family` value from GET /v1/logs facets, 16 hex chars or \"none\") scoping the same binding. Max 32 chars; \"\" = no segment scope."
      }
    ],
    "responseSummary": "201 with the criterion object (same shape as list items): id, name, description, judge_prompt, judge_model, status, source, unit, population, population_family, online_* fields, tier, trust, *_ci, drift_*, tpr, tnr, kappa, alignment_n, aligned_at, created_at",
    "notes": "OWNER/ADMIN only (403). Creating does not spend; judging (align, online monitoring) does. Body keys are snake_case exactly as listed; other criterion knobs (coverage, pre-checks, contract rules) are not settable through this endpoint."
  },
  {
    "name": "suggest_criteria",
    "method": "POST",
    "path": "/v1/criteria/suggest",
    "summary": "Clusters the workspace's written failure critiques into up to 5 DRAFT judge criteria, one per failure mode — use it after grading a batch of fails with reasons to bootstrap criteria you then review and align.",
    "scope": "evals:write",
    "body": [
      {
        "name": "judge_model",
        "type": "string",
        "description": "Model used for the single clustering call (and set as judge_model on every draft). Defaults to the platform's recommended judge (Qwen/Qwen3-235B-A22B-Instruct-2507). Must be a model available in the workspace's playground catalog, else 400. Whitespace-only values fall back to the default."
      }
    ],
    "responseSummary": "{ created: [<criterion objects, same snake_case shape as GET /v1/criteria: id, name, description, judge_prompt, judge_model, status ('draft'), source ('assist_suggested'), unit, population, population_family, online_*, tier, trust, fail_grades_needed, pass_grades_needed, tpr_ci, tnr_ci, drift_*, tpr, tnr, kappa, alignment_n, aligned_at, created_at>], critiques_used: <int>, skipped_duplicates: <int, proposed drafts whose name already existed> }.",
    "notes": "A body-less POST (or invalid JSON) is valid and uses the default judge — there is no 400 for a missing body. Requires an OWNER/ADMIN minting user (403). 400 when fewer than 10 FAIL grades carry a critique (message includes the current count); only the 200 most recent critiques are considered. 400 if the model returns no parseable JSON array ('try again'). SPENDS THE WALLET: one metered clustering call (billed under assist:suggest). Drafts are never trusted by any gate until a human reviews them and runs an alignment; an existing criterion with the same name is skipped, never overwritten. Function maxDuration is 300s.",
    "spends": true
  },
  {
    "name": "list_criterion_templates",
    "method": "GET",
    "path": "/v1/criteria/templates",
    "summary": "Lists the shipped judge-criterion templates (starting-point judge prompts grouped by use case) so a caller can instantiate one via POST /v1/criteria with an edited judge_prompt.",
    "scope": "read",
    "responseSummary": "{ object: 'list', data: [{ id: <slug e.g. 'no-fabrication', 'grounded-in-context', 'right-next-action', 'tool-use-sound', 'finishes-what-it-starts'>, use_case: <'Support & assistants'|'RAG & knowledge'|'Extraction & structured output'|'Data processing'|'Agents & tools'|'Any traffic'>, name, description, judge_prompt, unit: 'request'|'trace', universal: <bool, true = meaningful on any traffic, safe to leave unscoped> }] }. 11 templates as of this build.",
    "notes": "Static and free; only authentication is required. A template is a starting point, not a truth — it still has to be aligned against the workspace's own labels. Task-specific (non-universal) templates should be scoped to the tag of the traffic they judge; unit 'trace' templates judge whole agent runs and need trace-scoped labels."
  },
  {
    "name": "get_criterion",
    "method": "GET",
    "path": "/v1/criteria/{id}",
    "summary": "Fetch one criterion with its current calibration metrics, trust verdict and the intervals it was derived from.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Criterion id."
      }
    ],
    "responseSummary": "The criterion object: id, name, description, judge_prompt, judge_model, status, source, unit, population, population_family, online_enabled, online_percent, online_cap_usd, online_spent_usd, tier, trust, fail_grades_needed, pass_grades_needed, tpr_ci, tnr_ci, drift_status, drift_signal, drift_reason, drift_checked_at, tpr, tnr, kappa, alignment_n, aligned_at, created_at",
    "notes": "404 \"Criterion not found\" when the id is not in this workspace. Derivations (trust, drift) match GET /v1/criteria exactly."
  },
  {
    "name": "update_criterion",
    "method": "PATCH",
    "path": "/v1/criteria/{id}",
    "summary": "Update a criterion's prompt, judge model, population scope, online-monitoring settings or lifecycle status; instrument changes void its calibration.",
    "scope": "evals:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Criterion id."
      }
    ],
    "body": [
      {
        "name": "name",
        "type": "string",
        "description": "Trimmed, 1..80 chars."
      },
      {
        "name": "description",
        "type": "string",
        "description": "Max 500 chars; null clears."
      },
      {
        "name": "judge_prompt",
        "type": "string",
        "description": "Trimmed, 10..4000 chars. Changing it VOIDS tpr/tnr/kappa/aligned_at and deletes stored confusion rows."
      },
      {
        "name": "judge_model",
        "type": "string",
        "description": "Model id. Changing it voids calibration."
      },
      {
        "name": "unit",
        "type": "string",
        "description": "Accepted only if equal to the current unit; any change is refused with 400 (unit is create-only).",
        "enum": [
          "request",
          "trace"
        ]
      },
      {
        "name": "population",
        "type": "string",
        "description": "Request tag scope, max 64 chars; \"\" = all traffic. Changing it voids calibration."
      },
      {
        "name": "population_family",
        "type": "string",
        "description": "Traffic-segment scope (family value from logs facets), max 32 chars; \"\" clears. Changing it voids calibration."
      },
      {
        "name": "online_enabled",
        "type": "boolean",
        "description": "Turn online monitoring on/off. When on, the judge scores a sample of fresh logged traffic and each judge call is billed as usage."
      },
      {
        "name": "online_percent",
        "type": "integer",
        "description": "Percent of fresh in-scope traffic to judge, integer 1..100."
      },
      {
        "name": "online_cap_usd",
        "type": "number",
        "description": "Weekly online-judging spend ceiling in USD, 0..100000; 0 = uncapped. Money config; does not void calibration."
      },
      {
        "name": "status",
        "type": "string",
        "description": "Lifecycle. \"retired\" removes the criterion from online scoring and pickers.",
        "enum": [
          "draft",
          "retired"
        ]
      }
    ],
    "responseSummary": "200 with the updated criterion object (same shape as GET /v1/criteria/{id})",
    "notes": "OWNER/ADMIN only (403). 404 \"Criterion not found\". 400 for schema failures, a unit change, or an invalid status. MONEY: enabling online monitoring spends the wallet on judge calls, capped weekly by online_cap_usd. Voided calibration means trust becomes \"unmeasured\" until POST /align is run again."
  },
  {
    "name": "delete_criterion",
    "method": "DELETE",
    "path": "/v1/criteria/{id}",
    "summary": "Permanently delete a criterion and its calibration history.",
    "scope": "evals:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Criterion id."
      }
    ],
    "responseSummary": "200 { id, deleted: true }",
    "notes": "OWNER/ADMIN only (403). 404 \"Criterion not found\" when not in this workspace. Aliases gated on this criterion lose their gate."
  },
  {
    "name": "run_criterion_alignment",
    "method": "POST",
    "path": "/v1/criteria/{id}/align",
    "summary": "Calibrate a criterion by re-judging every in-scope human-labeled trace and measuring agreement (TPR/TNR with Wilson intervals, Cohen's kappa), which is what earns a judge the trust needed to gate on it.",
    "scope": "evals:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Criterion id."
      }
    ],
    "responseSummary": "Small sets (<= 50 labels) run synchronously and return the report: { scope_tag, scope_family, tag_breakdown: [{ tag, n }], mixed_population, excluded_other_cause, unattributed_fails, metrics: { n, tpr, tpr_ci, tnr, tnr_ci, kappa }, tier, thin_alignment_set, skipped, holdout: { tune_n, report_n }|null, one_class_note, disagreements: [{ request_id, judge_verdict, human_verdict }] }. Larger sets return { queued: true, total_labels } and the report is built in the background over the following minutes (poll GET /v1/criteria/{id}/alignment).",
    "notes": "MONEY: spends the wallet like any judging (one judge call per label; a new run is new spend). OWNER/ADMIN only (403). 400 when fewer than 30 in-scope labels exist (message says how many you have and how to label more), when a run is already in progress (\"An alignment run is already in progress for this criterion.\"), or when fewer than 30 labels could actually be judged. 404 \"Criterion not found\". Route maxDuration is 300s.",
    "spends": true
  },
  {
    "name": "get_criterion_alignment",
    "method": "GET",
    "path": "/v1/criteria/{id}/alignment",
    "summary": "Read the persistent report from the criterion's last calibration run: metrics with intervals, population breakdown, threshold sweep, and every judge/human disagreement with the human's critique and a response excerpt. Free; it never re-judges.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Criterion id."
      }
    ],
    "responseSummary": "{ aligned_at, scope_tag, tag_breakdown: [{ tag, n }], mixed_population, tier, thin_alignment_set, metrics: { n, tpr, tpr_ci, tnr, tnr_ci, kappa }, threshold_analysis: { half (\"tune\"|\"all\"), sweep: { n, ungraded, argmax: metrics, best: { threshold, metrics, youden_j }|null, curve: [{ threshold, metrics, youden_j }], note }, report_check: { threshold, n, metrics, youden_j, argmax }|null }|null, agreements (count), disagreements: [{ request_id, judge_verdict, human_verdict, critique, tag, response_excerpt }] }",
    "notes": "404 \"Criterion not found\". 400 \"This criterion has no alignment run yet\" when never calibrated or after a voiding edit; 400 \"Alignment run in progress — N labels judged so far\" while a background run is in flight (use it to poll). threshold_analysis is null for runs recorded before logprob grades were stored. All nested keys are snake_case."
  },
  {
    "name": "auto_improve_criterion",
    "method": "POST",
    "path": "/v1/criteria/{id}/auto_improve",
    "summary": "Runs one auto-improvement round on a judge criterion: mines the tune-half disagreements from its last alignment, rewrites the judge prompt coherently, and creates a successor DRAFT criterion with its alignment queued — use it when a calibrated judge still disagrees with your grades and you want a better candidate without hand-editing the prompt.",
    "scope": "evals:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Criterion id (must belong to the key's workspace)."
      }
    ],
    "responseSummary": "201 with { criterion: <full criterion object, snake_case: id, name, description, judge_prompt, judge_model, status, source, unit, population, population_family, online_enabled, online_percent, online_cap_usd, online_spent_usd, tier, trust, fail_grades_needed, pass_grades_needed, tpr_ci, tnr_ci, drift_status, drift_signal, drift_reason, drift_checked_at, tpr, tnr, kappa, alignment_n, aligned_at, created_at>, tune_disagreements: <int, tune-half rows where judge and human disagreed>, alignment_queued: <bool> }. The returned criterion is the NEW successor (draft, metrics void), named '<parent name> (auto r2)' (round suffix increments), inheriting the parent's unit, judge model, tag, segment, deterministic pre-stage, coverage, contract rules and golden set — a round varies the PROMPT only.",
    "notes": "No request body is read. Requires an OWNER/ADMIN minting user (403 otherwise). 404 if the criterion is not in the workspace. 400 when: an alignment run is in progress; the last alignment has fewer than 80 judged rows (needs a holdout-scale run so the report half stays untouched); there are zero tune-half disagreements; or the rewriter returned an unusable prompt (nothing created, only the single rewriter call was spent). SPENDS THE WALLET: one metered rewriter call (billed under assist:iterate) plus the queued alignment run, which bills like any alignment. Deliberately single-round: loop it yourself once the successor's alignment lands; adoption (repoint monitoring, retire the parent) stays a human act. Function maxDuration is 300s.",
    "spends": true
  },
  {
    "name": "get_criterion_certificate",
    "method": "GET",
    "path": "/v1/criteria/{id}/certificate",
    "summary": "Returns the signed judge certificate for a criterion — what was proven (confusion matrix, TPR/TNR/kappa with intervals, trust verdict), on which population, what voids it, and what enforcement refused involving it — for audits, evidence bundles, or proving a judge's calibration to a third party.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Criterion id (must belong to the key's workspace)."
      }
    ],
    "responseSummary": "A JSON document whose keys are camelCase (NOT snake_case — it is emitted verbatim so its signature can be re-derived): signature: {alg:'HS256', key_id, value} | null (with unsigned: true when no signing secret is configured), criterionId, name, question (the judge prompt), unit ('request'|'trace'), judgeModel, issuedAt, calibration: {measured, matrix: {tp,fp,tn,fn}|null, metrics: {n, tpr, tprCi, tnr, tnrCi, kappa}|null, labels, holdoutActive (labels >= 80), alignedAt, goldenSet: {id, name, size, membershipHash, frozenAt, humanKappa, humanAgreement, humanKappaN, raterCount}|null}, trust: {trust: 'trustworthy'|'misaligned'|'under-measured'|'borderline'|'unmeasured', failGradesNeeded, passGradesNeeded, tprCi, tnrCi} (or just {trust:'unmeasured'}), population: {tag, segment, unit, statement}, validity: {driftStatus: 'ok'|'flagged', driftSignal: 'stale'|'quality_drop'|'suspicious_rise'|'evidence_revised'|null, driftReason, driftCheckedAt, voidedBy: string[]}, enforcement: {windowDays: 90, refusalsInvolvingJudge, lastReason}.",
    "notes": "Free (no judging). 404 if the criterion is not in the workspace. Response is Cache-Control: no-store. Hand the WHOLE JSON object to POST /v1/verify to check the signature later. An uncalibrated judge still returns a certificate that honestly says nothing is measured (calibration.measured=false, trust.trust='unmeasured'). enforcement counts refusal-ledger rows from the last 90 days whose subject is this criterion or whose reason names it."
  },
  {
    "name": "scan_criterion_suspects",
    "method": "POST",
    "path": "/v1/criteria/{id}/scan",
    "summary": "Judges a bounded batch of recent, not-yet-labeled traffic with this criterion and queues every FAIL as a pending suspect for human review in the dashboard's Review queue — the fastest way to grow a judge's failure-label set from live traffic.",
    "scope": "evals:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Criterion id (must belong to the key's workspace)."
      }
    ],
    "responseSummary": "{ scanned: <int, items actually judged>, flagged: <int, FAIL verdicts queued as pending suspects> }. Both are 0 when no unlabeled, unscanned candidates exist in scope.",
    "notes": "No request body is read. Requires an OWNER/ADMIN minting user (403). 404 if the criterion is not in the workspace. Request-unit criteria: takes the 100 most recent logged exchanges (scoped to the criterion's population segment when it has one), drops already-labeled and already-scanned rows (dismissed suspects never resurface), and judges at most 30. Trace-unit criteria: scans at most 10 COMPLETED agent runs from the last 7 days (quiet for 10 minutes), scoped to the criterion's tag and segment; requires a completed calibration (400 'Calibrate this judge first' otherwise) and has a pre-flight wallet gate of ~$0.10 per run (402 'Insufficient balance' before any spend). SPENDS THE WALLET: every judge call is metered as usage (billing prefix scan:). Suspects are adjudicated in the dashboard (accept = a real FAIL label; dismiss = never resurfaces). Function maxDuration is 300s.",
    "spends": true
  },
  {
    "name": "decontaminate_texts",
    "method": "POST",
    "path": "/v1/datasets/decontaminate",
    "summary": "Checks a batch of texts against the public-benchmark contamination index (13-word shingles of well-known test splits) and reports which inputs share material with which benchmark — use it before training so later benchmark scores measure capability, not memorised answer keys.",
    "scope": "evals:write",
    "body": [
      {
        "name": "texts",
        "type": "array",
        "description": "Array of strings to check (each item must be a string). At most 5,000 per call. Positions in this array are the `index` values in the response.",
        "required": true,
        "items": "string"
      }
    ],
    "responseSummary": "{ checked: <int, texts actually checked; 0 when the index was unavailable>, index: { version, generatedAt (camelCase — passed through verbatim), benchmarks: [{id, name, rows}] } | null, hits: [{ index: <position in texts>, benchmark: <display name>, benchmark_id, matches: <shared shingle count> }], contaminated: <sorted unique int[] of input positions with any hit> }.",
    "notes": "400 on invalid JSON, when `texts` is not an array of strings, or when it exceeds 5,000 items. `index: null` means the benchmark index was unavailable and NOTHING was checked — never treat that as clean. 'Clean' is a claim about THOSE benchmarks on THAT index date only. Free (no judging, no wallet spend). Response is Cache-Control: no-store. One text can produce multiple hits (one per benchmark it overlaps)."
  },
  {
    "name": "create_dataset_from_logs",
    "method": "POST",
    "path": "/v1/datasets/from_logs",
    "summary": "Curates logged gateway traffic into a managed training dataset (optionally with a disjoint eval holdout split), auto-dropping errored/truncated/empty/duplicate/human-failed/benchmark-contaminated exchanges and applying a chosen quality gate — use it to turn production logs into fine-tuning or eval data.",
    "scope": "evals:write",
    "body": [
      {
        "name": "name",
        "type": "string",
        "description": "Dataset name, 1-80 chars after trimming. Also used as the file name ('<name>.jsonl') and, with holdout_pct, the eval split is named '<name>-eval'.",
        "required": true
      },
      {
        "name": "holdout_pct",
        "type": "number",
        "description": "Percentage (0-50) of curated lines carved into a second, DISJOINT '<name>-eval' dataset linked back to the training set. 0/omitted = no eval split. Values above 50 are capped at 50."
      },
      {
        "name": "decontaminate",
        "type": "boolean",
        "description": "Drop rows whose prompt shares a 13-word shingle with a public benchmark test split. Default true. Only an explicit boolean is honored. The provenance records what was checked; an unavailable index is recorded as 'not checked', never as clean."
      },
      {
        "name": "filters",
        "type": "object",
        "description": "Which logged traffic feeds the build. Nested keys: model (string, exact model name), tag (string, the task label sent as X-Omnia-Tag), segment (string, an auto-detected traffic segment / prompt family as shown on GET /v1/logs rows), finish_reason (string), cache_hit (boolean), start (integer unix seconds, inclusive lower bound), end (integer unix seconds). Falsy values (empty string, 0) are ignored. Success-only is always enforced regardless of filters."
      },
      {
        "name": "sources",
        "type": "object",
        "description": "Include-list of source models: { models: string[] }. Only exchanges served by these models feed the build; an empty array means no restriction. Each item must be a non-empty string, else 400 'sources.models must be an array of model names'."
      },
      {
        "name": "quality",
        "type": "object",
        "description": "The quality ladder: { mode: 'cleaned'|'graded'|'judge', criterion_id?: string }. 'cleaned' (default) = mechanical curation only. 'graded' = keep only exchanges a human graded pass (free). 'judge' = a CALIBRATED judge (criterion_id REQUIRED; request-unit; trust 'trustworthy' or 'under-measured'; not drift-flagged; if segment-bound, filters.segment must equal its segment) keeps only passing conversations, judged at each conversation's terminal turn; human grades override the judge for free. mode must be a string, criterion_id a string when present.",
        "enum": [
          "cleaned",
          "graded",
          "judge"
        ]
      }
    ],
    "responseSummary": "201 with snake_case: { summary: { total: <rows fetched>, kept, dropped: { unparseable, errored, truncated, empty, duplicate, human_failed, contaminated }, folded: { folded_turns, conversations } }, quality: { mode, criterion_id?, criterion_name?, kappa?, human_pass_kept?, ungraded_excluded?, judged?, judge_passed?, judge_failed?, judge_unparsed?, judge_spend_usd? }, training_name, training_count, eval_name?: '<name>-eval', eval_count? }.",
    "notes": "Requires an OWNER/ADMIN minting user for dataset creation (403, enforced in the dataset service). 400 (invalid_json) on unparseable JSON. Other 400s: name missing/over 80 chars; unknown quality mode; judge mode without criterion_id; judge criterion not found / trace-unit / misaligned / borderline / unmeasured / drift-flagged / segment-bound but build not scoped to that segment (each eligibility refusal is also written to the refusal ledger, kind dataset_judge_trust); no usable exchanges after curation (nothing created). Fetch is capped at 50,000 most recent matching rows. MONEY: judge mode is gated up front at ~$0.02 per conversation to judge (402 'Insufficient balance for judge gating' before any spend) and every judge call is then metered as usage; a scoring failure mid-run FAILS THE WHOLE BUILD (no dataset created) but rows already judged were billed (idempotent ids — retry does not re-bill). Human FAIL grades (or rows sharing an agent run with a trace-scoped FAIL) never enter a dataset in any mode. Multi-turn chats are folded into one weighted line per conversation. If the training set is created but the eval split fails, the response is a 400 that says the training dataset already exists. The eval split shares no example with the training set, so it is valid as an eval source (POST /v1/evals with sample_filters.dataset_id)."
  },
  {
    "name": "list_dedicated_endpoints",
    "method": "GET",
    "path": "/v1/dedicated",
    "summary": "Lists the workspace's dedicated (reserved-GPU) inference endpoints with live-reconciled status, frozen hourly price and unbilled cost accrued since the last meter — use it to monitor what is running and what it is costing.",
    "scope": "read",
    "responseSummary": "A bare JSON array (no {object:'list'} envelope) of endpoint objects, snake_case: { id, name, description, model_name, flavor_name, gpu_type, gpu_count, region, min_replicas, max_replicas, status (e.g. PENDING/STARTING/RUNNING/UPDATING/STOPPING/STOPPED/FAILED), enabled, hourly_rate_usd (customer sell price per GPU-hour, frozen at deploy), pending_cost_usd (GPU-hours accrued since last_metered_at while RUNNING, not yet billed), routing_key (the model name to send to the inference API to hit this endpoint), base_url, last_metered_at, created_at }. Internal margin fields are never returned.",
    "notes": "Scope via requiredScopeFor is 'read' for GET; NOTE the dedicated routes use their own local apiKeyActor (app/api/v1/dedicated/_helpers.ts) which authenticates the key but does NOT enforce key scopes — any valid, unrevoked key passes. Deleted endpoints are excluded. Status/enabled/region are reconciled live from the control plane on every call (DB state served if reconcile fails). 400 on catalog/provider failure. Money: a RUNNING endpoint bills per GPU-hour (gpu_count x replicas x hourly_rate_usd) continuously; pending_cost_usd is what the next meter will charge."
  },
  {
    "name": "create_dedicated_endpoint",
    "method": "POST",
    "path": "/v1/dedicated",
    "summary": "Provisions a new dedicated inference endpoint (a model served on reserved GPUs at a frozen per-GPU-hour price) — use it for guaranteed capacity, custom fine-tuned weights, or predictable latency; billing starts as soon as it is running.",
    "scope": "platform:write",
    "body": [
      {
        "name": "name",
        "type": "string",
        "description": "Display name (trimmed, non-empty).",
        "required": true
      },
      {
        "name": "description",
        "type": "string",
        "description": "Optional description (trimmed)."
      },
      {
        "name": "model_name",
        "type": "string",
        "description": "A template `name` from GET /v1/dedicated/templates. camelCase alias modelName also accepted (camelCase wins if both present).",
        "required": true
      },
      {
        "name": "flavor_name",
        "type": "string",
        "description": "A key of that template's `flavors` map. Alias: flavorName.",
        "required": true
      },
      {
        "name": "gpu_type",
        "type": "string",
        "description": "A key of the flavor's available_configurations.gpu_configurations. Alias: gpuType.",
        "required": true
      },
      {
        "name": "gpu_count",
        "type": "integer",
        "description": "Must be > 0 and in the GPU configuration's allowed_gpu_counts. Alias: gpuCount.",
        "required": true
      },
      {
        "name": "region",
        "type": "string",
        "description": "Must be in the GPU configuration's allowed_regions.",
        "required": true
      },
      {
        "name": "min_replicas",
        "type": "integer",
        "description": ">= 1. Alias: minReplicas. Sizes the prepay/wallet gate (min_replicas x gpu_count x hourly price x prepay hours).",
        "required": true
      },
      {
        "name": "max_replicas",
        "type": "integer",
        "description": ">= min_replicas and <= the configuration's max_replicas_allowed. Alias: maxReplicas.",
        "required": true
      },
      {
        "name": "custom_weights_id",
        "type": "string",
        "description": "Serve a fine-tuned model's merged weights: must start with 'model-artifact_' (the artifact id from a completed fine-tune), else 400. Alias: customWeightsId. Omit for stock base models."
      },
      {
        "name": "fine_tuning_job_id",
        "type": "string",
        "description": "The source fine-tuning job to record on the endpoint, when deployed from one. Alias: fineTuningJobId."
      }
    ],
    "responseSummary": "201 with { id: <endpoint id> }. Poll GET /v1/dedicated/{id} for status and routing_key.",
    "notes": "400 'Invalid JSON body' or 'Missing required field(s): ...' when any of name, model_name, flavor_name, gpu_type, gpu_count, region, min_replicas, max_replicas is absent/null (checked after alias lifting). Requires an OWNER/ADMIN minting user (403). 400 when the model/flavor/GPU/region/count combo is not in the catalog, replica range invalid, or no price is configured for the GPU/region. MONEY: 402 'Insufficient balance' unless the wallet covers at least DEDICATED_PREPAY_HOURS (default 1 hour) of runway at min_replicas x gpu_count x sell rate; the per-GPU-hour price is FROZEN on the endpoint at create time; GPU-hours are metered continuously while the endpoint is enabled and RUNNING — stop (PATCH enabled=false) or DELETE to stop billing. Scope note: the dedicated routes' local apiKeyActor does not enforce key scopes on this branch.",
    "spends": true
  },
  {
    "name": "list_dedicated_templates",
    "method": "GET",
    "path": "/v1/dedicated/templates",
    "summary": "Returns the deployable model catalog for dedicated endpoints (model -> flavor -> GPU type -> allowed regions/counts/replica limits) plus this workspace's sell price per GPU-hour for every GPU/region combo — read it to build a valid POST /v1/dedicated request and estimate cost.",
    "scope": "read",
    "responseSummary": "{ templates: [{ name (use as model_name), type ('text2text'|'embedding'|'image2text'|...), metadata?: { huggingface_url?, vendor?, context_window_k?, size_b?, license?: {url?, name?} }, flavors?: { <flavor_name>: { quantization?, use_cases?, tags?, base_model_slug?, available_configurations?: { gpu_configurations?: { <gpu_type>: { allowed_regions: string[], allowed_gpu_counts: int[], max_replicas_allowed: int } } } } } }], prices: [{ gpu_type, region, price_per_gpu_hour_usd: number|null }] }. Template contents are the upstream catalog shape, already snake_case.",
    "notes": "Scope via requiredScopeFor is 'read'; the local dedicated apiKeyActor does not enforce scopes. price_per_gpu_hour_usd is the customer price (base cost and margin are never returned); null means no price is configured for that combo yet and a deploy on it will be refused. 400 'Dedicated endpoints are not configured' or 'Failed to load dedicated endpoint catalog' on provider/config failure. Prices are quoted at request time; the price frozen on an endpoint is the one in effect when it is created. Free to call."
  },
  {
    "name": "get_dedicated_endpoint",
    "method": "GET",
    "path": "/v1/dedicated/{id}",
    "summary": "Returns one dedicated endpoint's current view (live status, frozen hourly price, unbilled accrued cost, routing key) — use it to poll a deploy until RUNNING or to check spend.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Dedicated endpoint id (must belong to the key's workspace; deleted endpoints 404)."
      }
    ],
    "responseSummary": "A single endpoint object, snake_case: { id, name, description, model_name, flavor_name, gpu_type, gpu_count, region, min_replicas, max_replicas, status, enabled, hourly_rate_usd, pending_cost_usd, routing_key, base_url, last_metered_at, created_at }.",
    "notes": "Scope via requiredScopeFor is 'read'; the local dedicated apiKeyActor does not enforce scopes. Implemented by listing the workspace's endpoints (live-reconciled) and picking the id, so it costs a full list call. 404 'Endpoint not found'."
  },
  {
    "name": "update_dedicated_endpoint",
    "method": "PATCH",
    "path": "/v1/dedicated/{id}",
    "summary": "Scales, starts/stops, renames, or changes the GPU configuration of a dedicated endpoint — use enabled=false to stop billing without deleting, or gpu_type/gpu_count to re-size (which re-freezes the price).",
    "scope": "platform:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Dedicated endpoint id (must belong to the key's workspace)."
      }
    ],
    "body": [
      {
        "name": "name",
        "type": "string",
        "description": "New display name (trimmed)."
      },
      {
        "name": "description",
        "type": "string",
        "description": "New description (trimmed)."
      },
      {
        "name": "enabled",
        "type": "boolean",
        "description": "false = STOP the endpoint (runs a final meter for accrued GPU-hours, status STOPPING); true = START it (status STARTING, billing resumes when RUNNING). Omit to leave unchanged."
      },
      {
        "name": "min_replicas",
        "type": "integer",
        "description": ">= 1; defaults to the current value. Alias: minReplicas."
      },
      {
        "name": "max_replicas",
        "type": "integer",
        "description": ">= min_replicas; defaults to the current value. Alias: maxReplicas. Sending either replica field pushes the new scaling range."
      },
      {
        "name": "gpu_type",
        "type": "string",
        "description": "Change GPU type (must be available for the endpoint's model/flavor in its region). Alias: gpuType. Triggers a price re-freeze + wallet gate + final meter."
      },
      {
        "name": "gpu_count",
        "type": "integer",
        "description": "Change GPU count (must be in allowed_gpu_counts). Alias: gpuCount. Same re-freeze semantics as gpu_type."
      }
    ],
    "responseSummary": "{ ok: true } on success (no body data).",
    "notes": "400 'Invalid JSON body'. Requires an OWNER/ADMIN minting user (403). 404 'Endpoint not found'. 400 on invalid replica range (max must be >= min >= 1), GPU not available for the model/region, disallowed GPU count, max replicas above the configuration limit, or no price configured. MONEY: a GPU change re-prices the endpoint at today's rate (new frozen hourly_rate_usd) and is gated at 402 unless the wallet covers 1 prepay hour at the new configuration; stopping (enabled=false) or any GPU change immediately meters and bills the GPU-hours accrued so far. Status becomes UPDATING (GPU change), STOPPING (enabled=false) or STARTING (enabled=true). Scope note: local dedicated apiKeyActor does not enforce key scopes.",
    "spends": true
  },
  {
    "name": "delete_dedicated_endpoint",
    "method": "DELETE",
    "path": "/v1/dedicated/{id}",
    "summary": "Tears down a dedicated endpoint: meters and bills the GPU-hours accrued since the last meter, frees the reserved GPUs, and marks it DELETED — the way to permanently stop paying for an endpoint.",
    "scope": "platform:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Dedicated endpoint id (must belong to the key's workspace)."
      }
    ],
    "responseSummary": "{ ok: true } on success.",
    "notes": "Requires an OWNER/ADMIN minting user (403). 404 'Endpoint not found' (already-deleted endpoints also 404). MONEY: runs a final meter first (bills accrued GPU-hours), then releases the endpoint; soft-deleted (status DELETED, enabled=false) and excluded from later lists. Not reversible. Scope note: local dedicated apiKeyActor does not enforce key scopes."
  },
  {
    "name": "list_refusals",
    "method": "GET",
    "path": "/v1/enforcement/refusals",
    "summary": "Pages through the workspace's refusal ledger — every time enforcement stopped something (an alias repoint without evidence, an auto-gate or dataset build refusing an untrusted judge, a reward refusing a drift-flagged criterion, a round gate holding, an eval refused off its calibrated population) — newest first, for audit and compliance reporting.",
    "scope": "read",
    "query": [
      {
        "name": "since",
        "type": "string",
        "description": "ISO-8601 date/time; only refusals created at or after it. 400 'since must be an ISO date' if unparseable."
      },
      {
        "name": "kind",
        "type": "string",
        "description": "Exact-match filter on refusal kind.",
        "enum": [
          "alias_config_gate",
          "alias_evidence",
          "alias_act_hold",
          "dataset_judge_trust",
          "reward_validation",
          "round_gate",
          "eval_population"
        ]
      },
      {
        "name": "subject",
        "type": "string",
        "description": "Exact-match filter on subject identity, e.g. 'alias:prod-chat', 'criterion:<id>', 'run:<prefix>'."
      },
      {
        "name": "cursor",
        "type": "string",
        "description": "Opaque cursor = the `next_cursor` (a refusal id) from the previous page; returns rows strictly after it in newest-first order."
      },
      {
        "name": "limit",
        "type": "integer",
        "description": "Page size, integer 1..200 (400 otherwise).",
        "default": 50
      }
    ],
    "responseSummary": "{ refusals: [{ id, kind, subject, reason (verbatim refusal message, truncated to 500 chars), created_at (ISO) }], next_cursor: <string|null — null on the last page> }.",
    "notes": "Ordered by created_at desc, id desc. The ledger is append-only: a refusal later overridden is still listed. Cache-Control: no-store. Free."
  },
  {
    "name": "list_env_tools",
    "method": "GET",
    "path": "/v1/env/tools",
    "summary": "Lists the agent tools this workspace has declared for training environments (the egress allowlist) together with the per-workspace secret used to verify signed environment calls — use it to audit which endpoints and credentials environments may call.",
    "scope": "read",
    "responseSummary": "snake_case: { tools: [{ id, name, endpoint_url, auth_prefix (first 10 chars of the stored header + ellipsis, '(configured)' if undecryptable, or null), read_only, max_calls_per_episode, enabled, created_at }], egress_verification_secret: <hex HMAC secret; environment calls carry X-Omnia-Environment / X-Omnia-Timestamp / X-Omnia-Signature = HMAC_SHA256(secret, `${timestamp}.${rawBody}`)> }.",
    "notes": "Gated behind the fineTuning feature flag: 404 'Fine-tuning is not enabled' when off (prod runs with it ON). Requires an OWNER/ADMIN minting user even for GET (403). Credentials (auth headers) are encrypted at rest and never returned — only the prefix. Tools are sorted by name."
  },
  {
    "name": "register_env_tool",
    "method": "POST",
    "path": "/v1/env/tools",
    "summary": "Registers (or updates, by name) an agent tool that training environments for this workspace are allowed to call — the explicit consent grant naming the https endpoint, its credential, whether it is read-only, and a per-episode call cap.",
    "scope": "platform:write",
    "body": [
      {
        "name": "name",
        "type": "string",
        "description": "Tool name, 1-64 chars of letters, digits, '_', '.', '-' (trimmed). Upsert key: re-posting the same name updates the registration and re-enables it.",
        "required": true
      },
      {
        "name": "endpointUrl",
        "type": "string",
        "description": "Absolute https URL the environment may call. Rejected (400) if not https, if it embeds username/password, or targets localhost, a private/loopback/link-local/CGNAT IPv4, IPv6 loopback/link-local/unique-local, IPv4-mapped private addresses, or a cloud metadata host. NOTE: camelCase key — no snake_case alias is accepted on this route.",
        "required": true
      },
      {
        "name": "authHeader",
        "type": "string",
        "description": "Full Authorization header value to send to the tool (e.g. 'Bearer sk-...'). Stored encrypted, never returned. On update, omit to keep the existing header; send '' to clear it. 400 if encrypted storage is not configured. camelCase only."
      },
      {
        "name": "readOnly",
        "type": "boolean",
        "description": "Whether the tool is side-effect free. Defaults to true whenever omitted (including on update). camelCase only."
      },
      {
        "name": "maxCallsPerEpisode",
        "type": "integer",
        "description": "Per-episode call cap, clamped to 1..500. Defaults to 20 whenever omitted (including on update). camelCase only."
      }
    ],
    "responseSummary": "201 with the tool view, snake_case: { id, name, endpoint_url, auth_prefix, read_only, max_calls_per_episode, enabled, created_at }.",
    "notes": "Request body keys are camelCase (endpointUrl, authHeader, readOnly, maxCallsPerEpisode) while the response is snake_case — the route lifts no aliases. 400 'Invalid JSON body' or 'Missing required field(s): name, endpointUrl' when either is missing/empty. Gated behind the fineTuning feature flag (404 when off). Requires an OWNER/ADMIN minting user (403). Registration-time host validation only; DNS rebinding is not defended here. Writes an audit event. No money implication by itself."
  },
  {
    "name": "delete_env_tool",
    "method": "DELETE",
    "path": "/v1/env/tools/{id}",
    "summary": "Revokes a declared agent tool registration (consent withdrawal) so training environments can no longer call that endpoint.",
    "scope": "platform:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "Tool registration id (from GET /v1/env/tools; must belong to the key's workspace)."
      }
    ],
    "responseSummary": "{ ok: true } on success.",
    "notes": "Gated behind the fineTuning feature flag (404 'Fine-tuning is not enabled' when off). Requires an OWNER/ADMIN minting user (403). 404 'Tool not found' when the id is not in the workspace. Hard delete; writes an audit event."
  },
  {
    "name": "list_evals",
    "method": "GET",
    "path": "/v1/evals",
    "summary": "List this workspace's eval runs (newest first, most recent 50) with status, progress and stored results, so a customer can see every comparison, criterion run and screening they have queued or finished.",
    "scope": "read",
    "responseSummary": "{object:\"list\", data:[run]} where run = {id, name, rubric, rubric_type, eval_kind (\"comparison\"|\"criterion\"), criterion_snapshot (frozen judge instrument on criterion runs, else null), baseline_model (a catalog id or \"__stored__\"), candidate_models (arm keys), arms:[{key, model, label|null, system:bool, tools:bool, n}], judge_model, sample_count, sample_filters:{model?, tag?, segment?, dataset_id?, trace_replay?, screening?}, status (PENDING|RUNNING|DONE|ERROR|CANCELLED), error|null, results (null until DONE; comparison: {sample_count, clipped_samples, baseline:{model, stored_answers, truncated, avg_latency_ms, eval_cost_micros}, per_candidate:[{model, arm, wins, losses, ties, failed, attempted, judged_share, unreportable, win_rate, ci95, inconclusive, truncated, avg_latency_ms, eval_cost_micros, savings_pct, replay?}], judge_cost_micros, screening?:{incumbent, token_shape, per_candidate:[{model, similarity:{matched, differed, unparsed, judged, match_rate, ci95}, est_usd_per_request, est_savings_pct, projected_monthly_usd, projected_monthly_savings_usd, ...placement}], recommendation}}; criterion: {eval_kind:\"criterion\", sample_count, clipped_samples, criterion, per_model:[{model, judged_pass, judged_fail, unparsed, truncated, observed_pass_rate, observed_ci, corrected_pass_rate|null, corrected_ci|null, avg_latency_ms, eval_cost_micros}], judge_youden, judge_cost_micros}), assertions|null, created_at (ISO), progress_ratio (0..1)}.",
    "notes": "No pagination or filtering: always the 50 newest runs. All keys are snake_cased at the door (camelCase internally); model ids used as map keys pass through untouched. Read-only, no wallet spend."
  },
  {
    "name": "create_eval",
    "method": "POST",
    "path": "/v1/evals",
    "summary": "Queue an eval run — a pairwise model comparison, an absolute criterion (calibrated judge) run, or a one-click screening of cheaper models against your own logged traffic — so a customer can measure a model, prompt, tool or index change before shipping it.",
    "scope": "evals:write",
    "body": [
      {
        "name": "screening",
        "type": "boolean",
        "description": "Screening mode. When true every other field becomes an optional override and the server auto-fills like the dashboard's one-click: incumbent = your dominant logged model, baseline = its stored answers (\"__stored__\"), candidates = the cheapest model of each distinct family, judge family-checked, fixed quality rubric, sample_count = clamp(min(40, population), 5..500). Only name, sample_count, candidate_models (1..6 explicit picks, validated against the catalog: unknown id / the incumbent itself / duplicate / >6 / empty list = 400 naming the offender), judge_model, and sample_filters.dataset_id (screen an imported dataset's stored answers instead of logged traffic) are honoured in this mode; rubric, rubric_type, eval_kind, criterion_id, baseline_model, candidates[], assertions, other sample_filters and max_output_tokens are ignored. Screening additionally enforces a creation-time funds gate (402)."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Run name, 1..80 chars after trimming (required unless screening=true, where it is auto-generated).",
        "required": true
      },
      {
        "name": "rubric",
        "type": "string",
        "description": "Judge rubric, 10..2000 chars. Required for eval_kind=\"comparison\" (400 if shorter than 10 chars); ignored for criterion runs (the criterion's frozen judge prompt is the rubric)."
      },
      {
        "name": "rubric_type",
        "type": "string",
        "description": "How the judge reads the rubric: \"direct\" (default) judges answers on the rubric alone; \"adherence\" also requires each sample to carry a reference answer (the logged reply), so the population must have text replies.",
        "enum": [
          "direct",
          "adherence"
        ],
        "default": "direct"
      },
      {
        "name": "eval_kind",
        "type": "string",
        "description": "\"comparison\" (default): each candidate arm is judged pairwise against the baseline in both orderings → win rate with Wilson CI. \"criterion\": every model (baseline and candidates) is graded absolutely by a saved, calibrated criterion → observed and calibration-corrected pass rates; requires criterion_id.",
        "enum": [
          "comparison",
          "criterion"
        ],
        "default": "comparison"
      },
      {
        "name": "criterion_id",
        "type": "string",
        "description": "Id of a workspace criterion (calibrated judge). Required when eval_kind=\"criterion\" (400 otherwise). The criterion's judge model and prompt override judge_model/rubric and are frozen into the run (criterion_snapshot). A trace-unit criterion requires baseline_model=\"__stored__\" and no candidates (it grades completed agent runs), and refuses if it was aligned on an older transcript instrument version. Population binding is enforced: sampling a tag/segment different from the criterion's calibrated population is refused (400); sampling with no population filter while the judge is scoped is allowed with a stored warning."
      },
      {
        "name": "baseline_model",
        "type": "string",
        "description": "The incumbent arm: a catalog model id this workspace is offered (validated, 400 \"Model '…' is not available.\"), or the sentinel \"__stored__\" to judge candidates against the incumbent's STORED logged answers (nothing is regenerated for the baseline; no savings figure is computed). \"__stored__\" is required for trace_replay and for the certified-switch (noninferiority) gate shape. Required unless screening=true (then forced to \"__stored__\").",
        "required": true
      },
      {
        "name": "candidate_models",
        "type": "array",
        "description": "Array of catalog model ids (max 6, no duplicates, none equal to baseline_model). Each candidate answers every sample and is judged, so cost is linear in this count. A comparison needs at least 1 (400 otherwise); a criterion run may have 0 (grade the baseline alone). Ignored when candidates[] is present (candidates[] replaces it).",
        "items": "string"
      },
      {
        "name": "candidates",
        "type": "array",
        "description": "Versioned arms — an alternative to candidate_models (when present, candidate_models is ignored and this list defines the arms; max 6 total). Each item: {model: string (required, catalog id that runs the arm), label?: string (arm key shown in the report; must match /^[A-Za-z0-9][A-Za-z0-9 _.:+\\-]{0,63}$/ and must NOT contain \"/\"), system?: string (replace the logged system prompt on every sampled prompt; \"\" strips it; max 20000 chars; omit to keep the logged one), tools?: array of tool-definition objects (OpenAI format; replaces the logged tool definitions; [] offers none; max 64; omit to keep), n?: integer 2..8 (best-of-N: sample N times and keep the judge-preferred answer via N−1 pairwise knockout verdicts on the run's own rubric/judge; the arm pays for all N generations plus the selection verdicts)}. A bare {model} is identical to listing the id in candidate_models. Any arm that sets system, tools or n MUST carry a label (400 \"candidates[]: an arm that overrides system or tools needs a label\"); the label becomes the arm key in candidate_models/arms/results, and the override is stored as armOverrides[label] = {model, system?, tools?, n?}. Two arms may share one model (e.g. old prompt vs new prompt); metering follows the model that actually ran.",
        "items": "string"
      },
      {
        "name": "sample_count",
        "type": "integer",
        "description": "Number of prompts to sample from the population, integer 5..500. Defaults to 20 when omitted (non-screening). The run is refused at creation (400) if the filtered population cannot supply at least 5 distinct prompts (with references when rubric_type=\"adherence\" or baseline is \"__stored__\"). Screening: clamped to 5..500, default min(40, population).",
        "default": 20
      },
      {
        "name": "max_output_tokens",
        "type": "integer",
        "description": "Per-answer generation output cap, integer 256..16384 (default 4096) — sized so thinking models can finish reasoning and answer; the runaway-spend guard. Silently ignored in screening mode.",
        "default": 4096
      },
      {
        "name": "judge_model",
        "type": "string",
        "description": "Catalog chat model used as the judge (validated; 400 if not offered). Precedence when omitted: the workspace's default judge, then the house default judge. Ignored for criterion runs (the criterion's judge is frozen). In screening mode an explicit judge is honoured even if it shares a family with a contestant (the report discloses judge_shares_family) instead of being swapped."
      },
      {
        "name": "assertions",
        "type": "array",
        "description": "Up to 10 deterministic output checks run against every generated answer at finalize (free, exact — these are what CI should gate on via min_assertion_pass_rate). Each: {type, value?}. Types: \"json_valid\" (no value), \"json_schema\" (value = JSON Schema string ≤4000 chars, must parse), \"regex_match\" (value = pattern ≤200 chars, must compile), \"contains\" / \"not_contains\" (value = substring, required), \"max_length\" / \"min_length\" (value = non-negative integer as string), \"completed\" (finish reason was not a length cut-off), \"tool_called\" (value = tool name ≤200 chars; matches the canonical \"[tool call] name(args)\" notation), \"no_tool_call\". Invalid configs are rejected 400 with the specific reason.",
        "enum": [
          "json_valid",
          "json_schema",
          "regex_match",
          "contains",
          "not_contains",
          "max_length",
          "min_length",
          "completed",
          "tool_called",
          "no_tool_call"
        ],
        "items": "string"
      },
      {
        "name": "sample_filters",
        "type": "object",
        "description": "Which population prompts are sampled from (success-only logged requests by default). Keys: tag?: string (only requests logged with this tag); model?: string (only requests served by this model); segment?: string (an auto-detected traffic segment = the prompt FAMILY shown as `segment` on GET /v1/logs rows — one application surface's traffic, stable under interpolated dates/ids); dataset_id?: string (sample from a managed dataset — e.g. a holdout split — instead of live logs; must belong to this workspace, 404 otherwise; the run needs ≥5 usable rows); trace_replay?: boolean (replay bake-off: sample WHOLE completed agent runs from the last 7 days, one teacher-forced sample per step, max 12 steps per run; REQUIRES baseline_model=\"__stored__\" (400 otherwise) and ≥5 replayable steps). Empty-string values are treated as absent. Screening mode reads only dataset_id here."
      }
    ],
    "responseSummary": "201 with the queued run in the same shape as GET /v1/evals/{id} (status PENDING, results null, progress_ratio 0, arms[] describing each candidate key). Poll GET /v1/evals/{id} until status is DONE|ERROR|CANCELLED, or gate a pipeline directly with GET /v1/evals/{id}/gate.",
    "notes": "MONEY: a run spends wallet credit (every generation for baseline + each arm, plus judge calls; best-of-N arms pay N×). Plain runs disclose cost and are gated lazily per tick by the runner; screening runs enforce a creation-time funds gate → 402 {error:{type:\"insufficient_quota\", code:\"insufficient_balance\"}}. The key's minting user must be workspace OWNER/ADMIN → otherwise 403. 400 on: invalid JSON, schema violations (name length, rubric length, sample_count range, >6 candidates, duplicates, candidate == baseline, bad assertion, bad arm label/override), unknown model, missing criterion_id, population-binding refusal, trace_replay without stored baseline, or too little population (\"Not enough logged traffic for this filter (need at least 5 distinct prompts…)\"). 404 for a dataset/criterion not in this workspace. Screening-specific: 422 {code:\"unprocessable\"} when there is nothing to screen (no/too little logged traffic, or nothing cheaper than the incumbent — the message carries the import hint), 400 for an unusable candidate_models list, 402 for funds. All errors are {error:{message, type, code}}. Input keys are snake_case; internally converted to camelCase (candidate_models→candidateModels, candidates[]→candidateModels keys + armOverrides map keyed by label, sample_filters.dataset_id→datasetId, trace_replay→traceReplay, max_output_tokens→genMaxOutputTokens).",
    "spends": true
  },
  {
    "name": "compare_evals",
    "method": "GET",
    "path": "/v1/evals/compare",
    "summary": "Compare two finished eval runs arm-by-arm (before vs after a prompt, tool or index change) and get each arm's delta with a 95% interval and a significance flag, instead of eyeballing two reports.",
    "scope": "read",
    "query": [
      {
        "name": "a",
        "type": "string",
        "description": "Eval run id of the BEFORE run (baseline of the comparison).",
        "required": true
      },
      {
        "name": "b",
        "type": "string",
        "description": "Eval run id of the AFTER run. Delta is reported as b − a.",
        "required": true
      }
    ],
    "responseSummary": "{a:{id, name, created_at, judge_model, eval_kind}, b:{…same}, rows:[{arm (candidate key), metric (\"win_rate\" for comparison runs; \"observed_pass_rate\" and, when both runs carry one, \"corrected_pass_rate\" for criterion runs), a:{rate, n, ci:[lo,hi]}, b:{rate, n, ci}, delta (b.rate − a.rate), delta_ci:[lo,hi] (Newcombe 95%), significant (interval excludes zero)}], unmatched:{a:[arm keys only in a], b:[arm keys only in b]}}. Cache-Control: no-store.",
    "notes": "400 when a or b is missing. 404 when either run is not in this workspace. 412 {code:\"precondition_failed\"} when both runs are not DONE, when they are different eval kinds, or when they used different judge models (a delta between judges measures the judges, not your change — re-run one with the other's judge). Best used with identical sample_filters on both runs. Read-only, no spend."
  },
  {
    "name": "get_failure_clusters",
    "method": "GET",
    "path": "/v1/evals/failure_clusters",
    "summary": "See live production failures grouped into systemic causes per criterion (judge FAIL rationales plus pending scan suspects, clustered by a model) so a customer can find what to fix first rather than reading failures one by one.",
    "scope": "read",
    "query": [
      {
        "name": "window_days",
        "type": "integer",
        "description": "Look-back window in days, integer 1..90.",
        "default": 7
      },
      {
        "name": "force",
        "type": "boolean",
        "description": "Pass the literal \"true\" to bypass the per-workspace one-hour cache and re-cluster now.",
        "default": false
      }
    ],
    "responseSummary": "{window_days, generated_at, cached (true when served from the hourly cache), criteria:[{criterion_id, criterion_name, failures (online FAILs + pending suspects, deduped), without_reason (failures with no stored rationale — counted, never clustered), clusters:[{name, count, share (of this criterion's clustered failures), request_ids, example (one representative rationale verbatim)}]}]}. Cache-Control: no-store.",
    "notes": "400 \"window_days must be an integer 1..90\" for an out-of-range value. MONEY: a fresh clustering (cache miss or force=true) makes one small metered model call per criterion that has ≥4 failure reasons (at most 40 reasons per criterion) — billed to the wallet like other assists; cached responses cost nothing. Criteria with fewer than 4 reasons are listed with no clusters."
  },
  {
    "name": "get_eval",
    "method": "GET",
    "path": "/v1/evals/{id}",
    "summary": "Fetch one eval run's status, progress and — once DONE — its full results (per-arm win rate with CI, W/T/L, latency, eval cost, savings, or corrected pass rates for criterion runs); poll this after creating a run.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The eval run id returned by POST /v1/evals."
      }
    ],
    "responseSummary": "The run object: {id, name, rubric, rubric_type, eval_kind, criterion_snapshot, baseline_model, candidate_models, arms:[{key, model, label, system, tools, n}], judge_model, sample_count, sample_filters:{model?, tag?, segment?, dataset_id?, trace_replay?, screening?}, status (PENDING|RUNNING|DONE|ERROR|CANCELLED), error (null, a failure reason, or \"Cancelled by <email>\"), results (see list_evals for the comparison / criterion / screening shapes), assertions, created_at, progress_ratio (0..1; completed inference units over total — feed a progress bar)}.",
    "notes": "404 {code:\"not_found\"} when the run is not in this key's workspace. results is null until DONE. A DONE screening's results.screening carries the similarity lens (match rate — never part of win/loss), quality-vs-cost placement per candidate and a recommendation (a \"keep\" is a first-class good outcome). Read-only, no spend."
  },
  {
    "name": "delete_eval",
    "method": "DELETE",
    "path": "/v1/evals/{id}",
    "summary": "Permanently delete a finished (DONE|ERROR|CANCELLED) eval run together with its samples, generated answers and judge verdicts — for cleaning up runs a customer no longer needs as evidence.",
    "scope": "evals:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The eval run id."
      }
    ],
    "responseSummary": "200 {id} of the deleted run.",
    "notes": "Requires an OWNER/ADMIN minting user (403 otherwise). A PENDING|RUNNING run is refused with 400 \"Cancel it first — a live run can't be deleted.\" — call POST /v1/evals/{id}/cancel first. 404 if not found in this workspace. Deletion is irreversible and cascades to samples/outputs/verdicts; the models, judges and criteria the run referenced are untouched. After deletion GET /v1/evals/{id}/gate and /evidence return 404. No spend."
  },
  {
    "name": "cancel_eval",
    "method": "POST",
    "path": "/v1/evals/{id}/cancel",
    "summary": "Stop a PENDING or RUNNING eval run so no further generations or judge calls are billed — use it when a run was misconfigured or is no longer needed.",
    "scope": "evals:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The eval run id."
      }
    ],
    "responseSummary": "200 with the run object (same shape as GET /v1/evals/{id}) with status \"CANCELLED\" and error set to \"Cancelled by <email of the key's minting user>\"; progress_ratio reflects work completed so far.",
    "notes": "Requires OWNER/ADMIN minting user (403) — same gate as create, because it controls wallet spend. A run already DONE|ERROR|CANCELLED is refused 400 (\"This run is already done — only a pending or running eval can be cancelled.\"); a terminal result is never overwritten. 404 if not in this workspace. Cancelled runs are inert: no future tick claims them, so nothing more is billed; a slice already in flight finishes its bounded batch (already-paid work), and in the rare race where that was the last slice the run may still land DONE with real results. No request body is read."
  },
  {
    "name": "get_eval_evidence",
    "method": "GET",
    "path": "/v1/evals/{id}/evidence",
    "summary": "Download the forwardable proof bundle for a DONE eval run — verdict, frozen judge calibration and certificate, per-sample verdict lineage, refusal ledger events and an audit hash-chain attestation, optionally with the embedded CI-gate decision — so a customer can hand a reviewer or auditor one signed JSON that links claim to instrument to data.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The eval run id (must be DONE)."
      }
    ],
    "query": [
      {
        "name": "with_content",
        "type": "boolean",
        "description": "Pass the literal string \"true\" to include sampled prompts and generated answers in samples.lineage. Honoured only when the workspace has request logging (content storage) enabled; otherwise lineage stays ids/verdicts only and content.reason explains why.",
        "default": false
      },
      {
        "name": "min_win_rate",
        "type": "number",
        "description": "0..1. Embed the same gate evaluation as GET /v1/evals/{id}/gate: every candidate's win-rate CI lower bound must clear this. Values outside 0..1 or non-numeric are ignored."
      },
      {
        "name": "min_pass_rate",
        "type": "number",
        "description": "0..1. Criterion runs: corrected pass-rate CI lower bound (observed CI when the judge is unvalidated) must clear this."
      },
      {
        "name": "min_assertion_pass_rate",
        "type": "number",
        "description": "0..1. Exact all-assertions pass rate must clear this."
      },
      {
        "name": "noninferiority_margin",
        "type": "number",
        "description": "0..1. The certified switch test (see get_eval_gate)."
      },
      {
        "name": "model",
        "type": "string",
        "description": "Restrict the embedded gate checks to one arm/model key."
      }
    ],
    "responseSummary": "200 bundle (snake_cased): {signature|null, unsigned?:true (when no signing secret is configured), bundle_v:1, generated_at, run:{id, workspace_id, name, eval_kind, status:\"DONE\", created_at, sample_count, baseline_model, candidate_models, judge_model, rubric_type, sample_filters, assertions}, results (verdict verbatim), gate:{params, verdict}|null (only when at least one gate param was given), instrument:{judge_model, judge_prompt, criterion_snapshot, certificate|null, note|null}, samples:{count, note, lineage:[{sample id, every verdict with the ordering that measured it (\"ab\"/\"ba\" pairwise halves, \"abs\" absolute, \"sim\" screening similarity), prompt/answers only with with_content}]}, content:{included, reason}, refusals:{window_days, scope, count, complete, events:[{kind, subject, reason, created_at}]}, attestation:{ok, checked_rows, head_seq, problems:[{seq, kind, detail}], acknowledged, window:{since, until, from_seq}|null, chain_head:{seq, last_hash}|null, statement}}.",
    "notes": "404 for a run outside this key's workspace. 412 {code:\"precondition_failed\"} for any run that is not DONE (PENDING/RUNNING/ERROR/CANCELLED) — fail closed like the gate; poll until DONE. with_content silently degrades (never errors) when request logging is off. Read-only, no spend."
  },
  {
    "name": "get_eval_gate",
    "method": "GET",
    "path": "/v1/evals/{id}/gate",
    "summary": "Turn a finished eval run into a CI deploy decision with one call — 200 when every requested threshold passes, 412 otherwise — so a pipeline can `curl -f` it and block a bad model/prompt change.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The eval run id."
      }
    ],
    "query": [
      {
        "name": "min_win_rate",
        "type": "number",
        "description": "0..1. Comparison runs: every candidate arm's win-rate 95% CI LOWER bound must be ≥ this (never the point estimate). Each check names its basis: \"corrected\" when the run carries ≥30 human pair labels and a usable calibration (the number to gate on — the PRINTED win rate is compressed toward 50% by judge error), else \"printed\" with a note saying how to attach labels (label_eval_pair). When the corrected point clears the bar but the calibration floor cannot, the note prices the missing labels instead of asking for more samples. Fails closed when the judge returned no verdict on too many pairs (unreportable)."
      },
      {
        "name": "min_pass_rate",
        "type": "number",
        "description": "0..1. Criterion runs: every model's calibration-corrected pass-rate CI lower bound must be ≥ this; falls back to the observed CI when the judge is unvalidated (the check's note says so)."
      },
      {
        "name": "min_assertion_pass_rate",
        "type": "number",
        "description": "0..1. Every model's exact all-assertions pass rate must be ≥ this (deterministic count). Fails if the run has no assertions configured."
      },
      {
        "name": "noninferiority_margin",
        "type": "number",
        "description": "0..1. THE CERTIFIED SWITCH TEST: on a criterion run whose baseline is \"__stored__\" (the incumbent's logged answers) scored by a calibrated judge, each candidate's pass-rate CI floor must reach the incumbent's rate minus this margin (0.05 = provably within 5 points at worst). Requires the stored-baseline arm AND a calibrated judge (corrected rates) — no observed-rate fallback; fails otherwise with an explanatory note."
      },
      {
        "name": "win_rate_ties",
        "type": "string",
        "description": "Tie lever for the win-rate check. \"half\" (default): tie = half a win, parity 50%, comparable to the printed rate. \"decided\": ties dropped on both sides — wins/(wins+losses), the share among pairs someone decided; compresses less and needs fewer labels, answers a narrower question. Anything else is a 400."
      },
      {
        "name": "model",
        "type": "string",
        "description": "Restrict the checks to one arm/model key (candidate key as listed in candidate_models)."
      }
    ],
    "responseSummary": "{pass: boolean, status: run status, checks:[{check: \"win_rate\"|\"pass_rate\"|\"assertion_pass_rate\"|\"noninferiority\", model, required, actual (CI lower bound or exact rate, null when unavailable), pass, note?}], reason? (set when the gate could not evaluate: run not DONE, run ERROR, or no thresholds given)}. HTTP 200 only when pass is true; 412 whenever anything failed.",
    "notes": "412 (not 4xx-error shape — the verdict body itself) when: the run is not DONE (\"Run not complete yet — poll until status is DONE.\" — fail closed), the run is ERROR, no threshold param was passed, or any check fails. Query values must parse as numbers in 0..1; anything else is treated as absent. 404 {error:{…}} when the run is not in this workspace. Keys in this response are NOT re-cased (they are already snake/single-word). Read-only, no spend. Pair it with a `read`-only scoped key for CI."
  },
  {
    "name": "get_eval_samples",
    "method": "GET",
    "path": "/v1/evals/{id}/samples",
    "summary": "Inspect the test cases behind a run's score — each sampled prompt, the answer every arm produced (reasoning traces stripped, as the judge saw them) and the per-sample verdict — the audit trail that makes a win rate trustworthy.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The eval run id."
      }
    ],
    "responseSummary": "A bare JSON array (no list envelope), one item per sample in order: {prompt (messages rendered as \"ROLE: content\" lines, clipped to 2000 chars), baseline_answer (the baseline's fresh answer, or the stored logged reply when baseline is \"__stored__\"; empty string on criterion runs), candidates:[{model (arm key), answer (clipped to 2000 chars), outcome}]}. outcome is \"win\"|\"loss\"|\"tie\"|\"failed\" (judge gave no reading) on comparison runs and \"pass\"|\"fail\"|\"unparsed\" on criterion runs; criterion runs list the baseline among candidates.",
    "notes": "404 when the run is not in this workspace. Works on any status (partial data while RUNNING; empty array before sampling). Texts are clipped server-side at 2000 chars with a \"…[clipped]\" marker — use GET /v1/evals/{id}/evidence?with_content=true for full transcripts. Comparison items also carry human_verdict (\"candidate\"|\"baseline\"|\"tie\"|null) per candidate once pairs are labelled (label_eval_pair). Read-only, no spend."
  },
  {
    "name": "label_eval_pair",
    "method": "POST",
    "path": "/v1/evals/{id}/pair_labels",
    "summary": "Record a HUMAN's verdict on one candidate-vs-baseline pair of a comparison run — the calibration evidence behind the corrected win rate. A pairwise judge's printed win rate is compressed toward 50/50 (a true 80/20 prints ~70/30 even for a judge at the human ceiling); from 30 labels the run reports a corrected rate with an interval that carries the calibration uncertainty.",
    "scope": "evals:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The eval run id (a comparison run; criterion runs are refused — they are graded pass/fail per exchange with trace labels)."
      }
    ],
    "body": [
      {
        "name": "sample_index",
        "type": "number",
        "description": "0-based sample index within the run (the order get_eval_samples returns).",
        "required": true
      },
      {
        "name": "candidate",
        "type": "string",
        "description": "The candidate arm key the verdict is about (as listed in candidate_models / get_eval_samples).",
        "required": true
      },
      {
        "name": "verdict",
        "type": "string",
        "description": "Which answer the human preferred: \"candidate\", \"baseline\", or \"tie\" (a tie is a real answer, not a skip).",
        "required": true
      },
      {
        "name": "critique",
        "type": "string",
        "description": "Optional free-text WHY (≤2000 chars)."
      }
    ],
    "responseSummary": "{sample_index, candidate, verdict, critique, pairwise} — pairwise is the run's refreshed calibration block (same shape as get_eval_pairwise), so one call shows what the label bought. One label per (sample, candidate); posting again overwrites. DELETE /v1/evals/{id}/pair_labels?sample_index=…&candidate=… removes one; GET lists them.",
    "notes": "Labelling is a human's job: only relay verdicts the user actually gave — never invent preferences to reach 30. 400 with the offender named on a bad sample_index/candidate/verdict; 404 when the run is not in this workspace. No spend."
  },
  {
    "name": "get_eval_pairwise",
    "method": "GET",
    "path": "/v1/evals/{id}/pairwise",
    "summary": "The pairwise judge's spec sheet and calibration for a comparison run — position bias measured on THIS run's pairs (it ranges from +0 to +45 points for the same judge on different traffic), tie behaviour, swap consistency, and the corrected win rate once pairs are labelled.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The eval run id (comparison runs only)."
      }
    ],
    "responseSummary": "{v, computed_at, labelled_pairs, calibration: null until pairs are labelled, else {n, agreement, kappa, usable, reason (why not, when unusable), wins/losses/decided: per-side Se/Sp with CIs}, candidates: {<arm>: {spec_sheet: {pairs, failed_pairs, swap_consistency (+CI), picks_first/second/tie, first_minus_second (+CI — the position bias in points; humans measure ~0), tie_rate, disagreement_ties (ties that are the two orderings disagreeing = the judge preferring whichever answer it saw first)}, labelled_pairs, corrected: null until usable, else {win_rate (½ + (W−L)/2, tie = half a win, parity 50%), win_rate_ci (Lang–Reiczigel — includes calibration uncertainty), floor_half_width (the width no amount of judged pairs can beat at this label count), calibration_variance_share, decided: the ties-dropped variant}}}}.",
    "notes": "Recomputed on read from the run's persisted verdicts and labels — never stale. The same block is stored on the run's results as results.pairwise at finalize and on every label write, so gate/evidence read identical numbers. Report the corrected rate WITH its interval and the printed rate alongside; the floor says when to ask for more labels instead of more samples. 404 when the run is not in this workspace; 400 for criterion runs. Read-only, no spend."
  },
  {
    "name": "list_training_files",
    "method": "GET",
    "path": "/v1/fine_tuning/files",
    "summary": "List the training files this workspace has uploaded for fine-tuning, newest first, so a customer can find the file id to start a job with.",
    "scope": "read",
    "responseSummary": "A bare JSON array (no list envelope): [{id (local record id), provider_file_id (the opaque upstream file id — THIS is the value to pass as training.file_id / training_file_id when creating a job), filename, bytes, purpose (\"fine-tune\"), created_at}].",
    "notes": "Feature-flag gated: when the `fineTuning` flag is off every /v1/fine_tuning route returns 404 {error:\"Fine-tuning is not enabled\"} (plain string error, not the nested shape). Note: the fine-tuning routes authenticate the key directly and do NOT currently enforce management scopes (any valid key of the workspace works); requiredScopeFor would classify writes here as platform:write. Read-only, no spend."
  },
  {
    "name": "upload_training_file",
    "method": "POST",
    "path": "/v1/fine_tuning/files",
    "summary": "Upload a JSONL training (or validation) file for fine-tuning; the returned provider_file_id is what a job creation references.",
    "scope": "platform:write",
    "body": [
      {
        "name": "file",
        "type": "string",
        "description": "multipart/form-data field named \"file\" (NOT JSON). The file's own name is used as the filename (falls back to \"training.jsonl\" when empty). Empty files are refused (400 \"File is empty\").",
        "required": true
      }
    ],
    "responseSummary": "201 {id, provider_file_id, filename, bytes, purpose:\"fine-tune\", created_at}. Use provider_file_id (not id) as training.file_id / training_file_id / validation_file_id in POST /v1/fine_tuning/jobs.",
    "notes": "Request must be multipart/form-data with a 'file' field — 400 \"Expected multipart/form-data with a 'file' field\" / \"Missing 'file' field\" otherwise. Requires OWNER/ADMIN minting user (403). Rate limited per workspace: 20 uploads per 60s → 429 with Retry-After. Feature-flag gated (404 when fineTuning is off). Storage is billable; the upload itself does not charge the wallet. Scopes are not enforced on this route today (see list_training_files)."
  },
  {
    "name": "list_fine_tuning_jobs",
    "method": "GET",
    "path": "/v1/fine_tuning/jobs",
    "summary": "List this workspace's fine-tuning jobs (newest first) with live status, progress, output model and price — for monitoring training from CI or a script.",
    "scope": "read",
    "responseSummary": "A bare JSON array: [{id, provider_job_id, name|null, base_model, method (\"supervised\"|\"spec-draft\"), status (VALIDATING_FILES|QUEUED|RUNNING|SUCCEEDED|FAILED|CANCELLED), fine_tuned_model|null, deployed_model_name|null (servable name after deployment), deploy_status|null (\"queued\"|\"staging\"|\"relaying\"|\"converting\"|\"provisioning\"|\"serving\"|\"failed\"), deploy_error|null, trained_tokens (string)|null, trained_steps|null, total_steps|null, rate_per_m_token_usd (customer price per 1M trained tokens), billed_cost_usd|null (set on completion), error|null, created_at}].",
    "notes": "Statuses are reconciled live against the training backend on each call (best effort; DB state served on backend error); a locally terminal status is never resurrected. Internal margin (markup) is stripped from the wire shape. Feature-flag gated (404 when fineTuning is off). Read-only, no spend. Scopes not enforced on this route today."
  },
  {
    "name": "create_fine_tuning_job",
    "method": "POST",
    "path": "/v1/fine_tuning/jobs",
    "summary": "Start a supervised (SFT/LoRA) or spec-draft fine-tune of a catalog base model on an uploaded file or a workspace dataset, with bounds-checked hyperparameters — the way a customer trains a custom model from their own data.",
    "scope": "platform:write",
    "body": [
      {
        "name": "base_model",
        "type": "string",
        "description": "Base model id from the fine-tunable catalog (1..300 chars). Supervised jobs accept only the curated fine-tunable list (400 \"This model isn't available for fine-tuning. Pick one from the list.\"); spec-draft jobs need a model in the spec-draft catalog. camelCase alias baseModel also accepted (camelCase wins if both present).",
        "required": true
      },
      {
        "name": "training",
        "type": "object",
        "description": "Training data source (required unless training_file_id is given). Either {kind:\"file\", file_id: string (a provider_file_id from /v1/fine_tuning/files; alias fileId)} or {kind:\"dataset\", provider_dataset_id: string (alias providerDatasetId; a workspace dataset's provider id), version?: string (≤200), mapping: <column mapping>}. mapping is one of: {type:\"text\", text:{type:\"column\", name}} | {type:\"prompts\", prompt:{type:\"column\", name}, completion:{type:\"column\", name}} | {type:\"messages\", messages:{type:\"column\", name}} | {type:\"pretokenized\", input_ids:{type:\"column\", name}, labels?:{type:\"column\", name}, attention_mask?:{type:\"column\", name}}. Datasets are converted to a training file after the wallet gate. The file/dataset MUST belong to this workspace (404 \"Training file not found\" / \"Dataset not found\" otherwise)."
      },
      {
        "name": "validation",
        "type": "object",
        "description": "Optional held-out/validation data source, same shape as training ({kind:\"file\", file_id} or {kind:\"dataset\", provider_dataset_id, version?, mapping}). Providing one is what makes a later bake-off (POST /v1/fine_tuning/jobs/{id}/bakeoff) possible."
      },
      {
        "name": "training_file_id",
        "type": "string",
        "description": "Legacy shortcut: a provider_file_id to train on (1..500 chars); equivalent to training:{kind:\"file\", file_id}. Ignored when training is present. Alias trainingFileId."
      },
      {
        "name": "validation_file_id",
        "type": "string",
        "description": "Legacy shortcut for validation:{kind:\"file\", file_id}. Alias validationFileId."
      },
      {
        "name": "name",
        "type": "string",
        "description": "Display name for the job (≤300 chars)."
      },
      {
        "name": "suffix",
        "type": "string",
        "description": "Suffix appended to the fine-tuned model name (≤120 chars)."
      },
      {
        "name": "seed",
        "type": "integer",
        "description": "Training seed, integer 0..2147483647."
      },
      {
        "name": "method",
        "type": "string",
        "description": "\"supervised\" (SFT / LoRA; default) or \"spec-draft\" (train a draft speculator for speculative decoding).",
        "enum": [
          "supervised",
          "spec-draft"
        ],
        "default": "supervised"
      },
      {
        "name": "hyperparameters",
        "type": "object",
        "description": "Supervised hyperparameters, all optional and bounds-checked (400 naming the field otherwise): n_epochs (int 1..100), learning_rate (number >0 and ≤1), batch_size (int 1..1024), context_length (int 128..262144), warmup_ratio (0..1), weight_decay (0..1), packing (boolean), max_grad_norm (>0 and ≤1000), lora (boolean; some bases are full-parameter only → 400 \"… supports full-parameter fine-tuning only\"), lora_r (int 1..512), lora_alpha (int 1..1024), lora_dropout (0..1). Keys are snake_case only."
      },
      {
        "name": "spec_draft_hyperparameters",
        "type": "object",
        "description": "Spec-draft hyperparameters (used when method=\"spec-draft\"): the common fields n_epochs, learning_rate, batch_size, context_length, warmup_ratio, weight_decay, packing, max_grad_norm (same bounds as above) plus architecture (string ≤200), num_decoding_heads (int 1..16), loss (string ≤100). Alias specDraftHyperparameters."
      },
      {
        "name": "integrations",
        "type": "array",
        "description": "Up to 10 export integrations; ONLY these two types are accepted (anything else is 400): {type:\"wandb\", wandb:{project (1..200), api_key (1..500), name? (≤200), entity? (≤200), tags? (≤50 strings ≤100)}} or {type:\"hf\", hf:{output_repo_name (1..200), api_token (1..500)}}.",
        "items": "string"
      }
    ],
    "responseSummary": "201 {id (job id for all other /v1/fine_tuning/jobs/{id} calls), provider_job_id}. Poll GET /v1/fine_tuning/jobs/{id} for status and fine_tuned_model.",
    "notes": "MONEY: the wallet must hold a prepay runway of (1,000,000 estimated trained tokens × the model's per-token rate incl. markup) or the call fails 402 \"Insufficient balance: starting a fine-tune requires at least $X of runway. Top up and try again.\"; the final charge is metered from real trained tokens on completion (billed_cost_usd). Requires OWNER/ADMIN minting user (403). Rate limited per workspace: 20 creates per 60s → 429 with Retry-After. 400 \"Invalid JSON body\" or \"Invalid body: <path> — <zod message>\" (e.g. missing training data: pass training or training_file_id). 400 when no price is configured for the model (\"No fine-tuning price is set for this model yet.\"). Top-level keys accept both snake_case and camelCase; nested hyperparameter/integration/mapping keys are snake_case only. Feature-flag gated (404 when fineTuning is off). Scopes not enforced on this route today.",
    "spends": true
  },
  {
    "name": "get_fine_tuning_job",
    "method": "GET",
    "path": "/v1/fine_tuning/jobs/{id}",
    "summary": "Get one fine-tuning job's live status, step progress, trained tokens, output model name, deployment state and billed cost — poll this after creating a job.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The job id returned by POST /v1/fine_tuning/jobs (not the provider_job_id)."
      }
    ],
    "responseSummary": "{id, provider_job_id, name, base_model, method, status (VALIDATING_FILES|QUEUED|RUNNING|SUCCEEDED|FAILED|CANCELLED), fine_tuned_model|null, deployed_model_name|null, deploy_status|null, deploy_error|null, trained_tokens (string)|null, trained_steps|null, total_steps|null, rate_per_m_token_usd, billed_cost_usd|null, error|null, created_at}.",
    "notes": "404 \"Job not found\" when the job is not in this workspace. Live progress (trained_steps/total_steps) is fetched from the training backend best-effort; DB state is served if that fails. A SUCCEEDED job is trainable-not-servable until deployed (deployed_model_name stays null). Feature-flag gated (404 when fineTuning is off). Read-only, no spend. Scopes not enforced on this route today."
  },
  {
    "name": "cancel_fine_tuning_job",
    "method": "DELETE",
    "path": "/v1/fine_tuning/jobs/{id}",
    "summary": "Cancel a queued or running fine-tuning job so no more training is metered — the customer's cancel is authoritative even if the backend lags.",
    "scope": "platform:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The job id."
      }
    ],
    "responseSummary": "200 {ok:true}. The job's status becomes CANCELLED (idempotent: cancelling an already-CANCELLED job also returns 200 {ok:true}).",
    "notes": "This is a CANCEL, not a delete — the job record remains listed. Requires OWNER/ADMIN minting user (403). 404 when not in this workspace. 400 \"This run already finished — there is nothing to cancel.\" for SUCCEEDED or FAILED jobs. The backend cancel is attempted but a backend error does not block the local cancel; metering treats local CANCELLED as final and finalizes at $0 further spend. Feature-flag gated (404 when fineTuning is off). Scopes not enforced on this route today."
  },
  {
    "name": "get_fine_tuning_bakeoff",
    "method": "GET",
    "path": "/v1/fine_tuning/jobs/{id}/bakeoff",
    "summary": "Read a fine-tune's bake-off state, verdict (improved / regressed / inconclusive with NLL, perplexity and optional judged pass rates) and ledger-true spend — to decide whether the tuned model is worth deploying.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The fine-tuning job id."
      }
    ],
    "responseSummary": "{status (\"none\"|\"queued\"|\"running\"|\"done\"|\"failed\"), error|null (customer-safe reason when failed), holdout_present (false = no validation split, so a comparison cannot be offered), available (platform compute configured), estimated_max_usd|null (the consent ceiling a start would hold; null when no GPU rate is configured), verdict|null: {verdict (\"improved\"|\"regressed\"|\"inconclusive\", sign-test backed), nll_base, nll_tuned, win_count, total, ppl_base, ppl_tuned, judged?: {criterion_id, criterion_name, base_pass_rate, tuned_pass_rate, scored}|null}, spent_usd}.",
    "notes": "Unlike other GETs this one requires an OWNER/ADMIN minting user (403 otherwise) because it reads spend. 404 \"Run not found\" when the job is not in this workspace. status \"none\" with holdout_present=false means the run can never be compared (no held-out split). Feature-flag gated (404 when fineTuning is off). Read-only, no spend."
  },
  {
    "name": "start_fine_tuning_bakeoff",
    "method": "POST",
    "path": "/v1/fine_tuning/jobs/{id}/bakeoff",
    "summary": "Start a held-out bake-off that proves a succeeded supervised fine-tune against its base model (teacher-forced NLL/perplexity wins, optionally a judged win-rate) on an ephemeral GPU box — quality proof without deploying the model.",
    "scope": "platform:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The fine-tuning job id (must be method \"supervised\", status SUCCEEDED, and have a validation/held-out split)."
      }
    ],
    "body": [
      {
        "name": "judge_criterion_id",
        "type": "string",
        "description": "Optional id of a calibrated (aligned, request-unit) workspace criterion; adds a judged pass-rate comparison (base vs tuned, up to 100 generated answers per side) next to the objective NLL signal. Must be a string if present (400 otherwise). The body may be empty."
      }
    ],
    "responseSummary": "202 {trigger_run_id} — the comparison is queued; poll GET /v1/fine_tuning/jobs/{id}/bakeoff for status and verdict.",
    "notes": "MONEY: metered GPU-box minutes (plus judge calls) bill to the wallet under the bakeoff:<jobId>: ledger prefix; a wallet HOLD for the whole cost ceiling (max 3 hours × up to 2 GPUs at the reference GPU rate, with markup) is placed before starting — 402 (\"…Top up and try again.\") if the wallet cannot hold it; only metered minutes are actually billed and the hold is released at the end. Requires OWNER/ADMIN minting user (403). Rate limited per workspace: 20 starts per 60s → 429. 404 \"Run not found\". 400 for: a spec-draft job, a job not SUCCEEDED, no held-out split (\"A comparison needs a held-out split the model didn't train on — this run has none.\"), a comparison already queued/running, comparison compute or orchestration not configured on the platform, a base model whose parameter count can't be parsed from its name, or a base model over 75B parameters. Invalid JSON body → 400. Feature-flag gated (404 when fineTuning is off). Scopes not enforced on this route today.",
    "spends": true
  },
  {
    "name": "list_grpo_runs",
    "method": "GET",
    "path": "/v1/grpo/runs",
    "summary": "List the workspace's online-RL (GRPO) training runs with ledger-true spend and outcomes, plus how many self-improvement candidates are waiting in the queue — use it to monitor training and decide whether to start another run.",
    "scope": "read",
    "responseSummary": "JSON object: { candidates_waiting: integer, auto_provision_available: boolean, runs: [ { id, status (ACTIVE|STOPPED|COMPLETED|FAILED|OVERBUDGET), model, budget_usd, spent_usd (reward/judge spend), gpu_spent_usd, env_spent_usd, gpu_hour_budget: number|null, gpu_rate_usd_per_hour: number|null, created_at (ISO), outcome: null | { steps?, first_half_mean_reward?, second_half_mean_reward?, stopped_by_tripwire?, bakeoff?: { verdict, delta, delta_ci95: [lo, hi], prompts, k, mean_sim_fraction, mean_tool_steps } } } ] }. Newest first, at most 50 runs; outcome is only fetched for the 10 newest non-ACTIVE runs (older ones return outcome null).",
    "notes": "Feature-flag gated: the entire training API (fineTuning flag) returns 404 'Fine-tuning is not enabled' when the flag is off. The key's minting user must be workspace OWNER/ADMIN or the call is 403. Spend figures come from the billing ledger, never self-reported. No pagination parameters."
  },
  {
    "name": "start_grpo_run",
    "method": "POST",
    "path": "/v1/grpo/runs",
    "summary": "Start an online-RL (GRPO) training run that improves a fine-tunable base model against a calibrated judge as the reward, with hard reward and GPU-hour budgets — use it to turn logged traffic or the candidate queue into a trained adapter.",
    "scope": "platform:write",
    "body": [
      {
        "name": "reward",
        "type": "object",
        "description": "Reward spec (camelCase keys). Either { mode: \"single\", criterionId: string } or { mode: \"compositional\", criterionIds: string[] (min 1), assertions?: object[] }. Each assertion is { type: \"json_valid\"|\"json_schema\"|\"regex_match\"|\"contains\"|\"not_contains\"|\"max_length\"|\"min_length\"|\"completed\"|\"tool_called\"|\"no_tool_call\", value?: string } or an exec assertion { type: \"exec\", command: string, timeoutSec?: integer (1..120) } — exec assertions are only allowed when `environment` is set (agentic/trace-unit rewards). Every criterion must exist in the workspace and be calibrated; a non-agentic run requires request-unit criteria, an agentic run (with `environment`) requires trace-unit criteria.",
        "required": true
      },
      {
        "name": "model",
        "type": "string",
        "description": "The policy model to train. Must be on the platform's fine-tunable base-model list, otherwise 400.",
        "required": true
      },
      {
        "name": "promptTag",
        "type": "string",
        "description": "Draw training prompts only from logged requests carrying this tag. Omit to sample the whole workspace's successful logged traffic."
      },
      {
        "name": "promptCount",
        "type": "integer",
        "description": "Number of prompts to train on. Minimum 10 (400 below that); clamped to 1..10000 at scheduling. A ~20% holdout (min 3) is carved off on top, and the workspace must have promptCount+holdout matching prompts logged or the run is refused with the real counts.",
        "required": true
      },
      {
        "name": "groupSize",
        "type": "integer",
        "description": "Rollouts sampled per prompt. Default 8, clamped 2..16."
      },
      {
        "name": "maxSteps",
        "type": "integer",
        "description": "Training steps. Default 100, clamped 1..5000."
      },
      {
        "name": "rewardBudgetUsd",
        "type": "number",
        "description": "Hard cap (USD) on judge/reward spend. Must be > 0. Held on the wallet at start.",
        "required": true
      },
      {
        "name": "gpuHourBudget",
        "type": "number",
        "description": "Hard cap on GPU hours. Must be > 0. For platform-provisioned GPUs the hours x frozen marked-up rate are held on the wallet at start.",
        "required": true
      },
      {
        "name": "useCandidateQueue",
        "type": "boolean",
        "description": "Train on the workspace's GRPO candidate queue (the self-improvement give-up set) for the single reward criterion instead of a tag sample. Only effective with reward.mode=single."
      },
      {
        "name": "platformGpu",
        "type": "object",
        "description": "Bill a platform-provisioned GPU: { gpuType: string, region: string, gpuCount?: integer (clamped 1..8) }. Rate + markup are frozen at start. Omit for bring-your-own compute (no GPU billing). 400 if no price is set for that GPU/region."
      },
      {
        "name": "allowSideEffects",
        "type": "boolean",
        "description": "Agentic runs only: permit calls to tools not declared read-only. Default false."
      },
      {
        "name": "environment",
        "type": "object",
        "description": "Agentic mode — run episodes inside the tool environment: { proxy_base_url: string (snake_case, required), max_steps?: integer, simulate?: boolean }. Setting this forces useVllm=true and requires trace-unit reward criteria."
      },
      {
        "name": "useVllm",
        "type": "boolean",
        "description": "Colocated vLLM rollouts (much faster steps). Forced true when `environment` is set."
      },
      {
        "name": "vllmGpuMemoryUtilization",
        "type": "number",
        "description": "Clamped 0.05..0.9."
      },
      {
        "name": "qlora",
        "type": "boolean",
        "description": "QLoRA 4-bit training. Default true."
      },
      {
        "name": "paramsB",
        "type": "number",
        "description": "Parameter count (billions) override for models whose name doesn't carry it. Must be > 0; capped at 1000."
      },
      {
        "name": "autoProvision",
        "type": "boolean",
        "description": "Let the platform provision an auto-sized GPU box. 400 if provisioning isn't configured; holds a conservative GPU commitment (highest active rate x 8 GPUs x gpuHourBudget) on the wallet."
      },
      {
        "name": "curriculumMixRatio",
        "type": "number",
        "description": "Candidate-queue runs: fraction of the training slice drawn from regular successful traffic. Clamped 0..0.9."
      },
      {
        "name": "holdoutCount",
        "type": "number",
        "description": "Holdout size override (rounded, clamped 1..2000). Use 50+ for a real bake-off claim. Default max(3, ceil(promptCount*0.2))."
      },
      {
        "name": "maxCompletionTokens",
        "type": "integer",
        "description": "Per-rollout generated-token budget, clamped 256..32768. Defaults: 8192 agentic, 1024 single-turn."
      },
      {
        "name": "tasksInline",
        "type": "array",
        "description": "Up to 10000 task objects for agentic runs: { goal: any[] (min 1), image?: string (<=500 chars), recorded?: any[], verifier?: [ { command: string (1..4000 chars), timeout_sec?: integer 1..120 } ] }.",
        "items": "object"
      },
      {
        "name": "autoAdopt",
        "type": "object",
        "description": "Opt-in auto-deploy on an 'improved' bake-off verdict: { aliasName: string (1..120, must already exist in the workspace or the start is refused), canaryPercent?: integer 1..50, gpuType: string, region: string, templateFlavor?: string }. Deploys to a dedicated endpoint, canaries on the alias, and the online gate earns the promote. Inconclusive/regressed rounds never deploy."
      }
    ],
    "responseSummary": "201 with { trigger_run_id: string } — the orchestration handle for the run (the GrpoRun id shows up in GET /v1/grpo/runs once registered).",
    "notes": "SPENDS MONEY: the whole commitment (rewardBudgetUsd + GPU hours at the frozen marked-up rate, or a conservative ceiling for autoProvision) is atomically HELD on the wallet at start; 402 when the wallet can't hold it; 400 'No wallet for this workspace' when there is no payment method. Body keys are camelCase only (except environment.proxy_base_url / max_steps and verifier[].timeout_sec, which are snake_case); unknown keys pass through. Zod validation failure returns 400 { error: 'Invalid body: <path> — <message>' } (flat error shape). Rate limited to 20 starts/min per workspace (429). Feature-flag gated (fineTuning flag off → 404). Requires OWNER/ADMIN (403). Other 400 refusals: unaligned/wrong-unit/drift-flagged judge, iterated-RL round gate (fresh grades needed on a self-trained policy), model not fine-tunable, promptCount < 10, not enough logged prompts or queued candidates, autoAdopt alias missing, no GPU price set, orchestration not configured.",
    "spends": true
  },
  {
    "name": "get_grpo_run",
    "method": "GET",
    "path": "/v1/grpo/runs/{id}",
    "summary": "Fetch one online-RL (GRPO) run's status, ledger-true spend, and training outcome (reward trend, bake-off verdict) — use it to poll a run you started.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The GRPO run id (from the runs list). Scoped to the workspace: a foreign or unknown id is 404."
      }
    ],
    "responseSummary": "JSON object: { id, status, model, budget_usd, spent_usd, gpu_spent_usd, env_spent_usd, gpu_hour_budget, gpu_rate_usd_per_hour, created_at, outcome: null | { steps, first_half_mean_reward, second_half_mean_reward, stopped_by_tripwire, bakeoff?: { verdict, delta, delta_ci95, prompts, k, mean_sim_fraction, mean_tool_steps } } }. Outcome is always attempted for this single run (null while ACTIVE or when no artifact exists).",
    "notes": "Feature-flag gated (fineTuning flag off → 404). OWNER/ADMIN key required (403). 404 'Run not found' for foreign ids."
  },
  {
    "name": "stop_grpo_run",
    "method": "POST",
    "path": "/v1/grpo/runs/{id}/stop",
    "summary": "Stop an ACTIVE online-RL (GRPO) run and release its wallet hold immediately — use it to cut a run short when spend or results aren't what you expected.",
    "scope": "platform:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The GRPO run id. Must be ACTIVE and belong to the workspace."
      }
    ],
    "responseSummary": "200 { ok: true }. The run flips to STOPPED; the reward server refuses further scoring and the orchestrator exits on its next sweep.",
    "notes": "Idempotency: a run that is not ACTIVE (already stopped/completed) or not in the workspace returns 404 'Run not found or not active'. Money: the commitment hold is released right away; already-metered spend stays billed. Feature-flag gated (fineTuning flag off → 404). OWNER/ADMIN key required (403). No body is read."
  },
  {
    "name": "get_grpo_run_weights",
    "method": "GET",
    "path": "/v1/grpo/runs/{id}/weights",
    "summary": "Get short-lived presigned download links for a finished online-RL (GRPO) run's trained adapter files so you can self-host the weights — use it after a run completes (or stops with a partial checkpoint).",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The GRPO run id. Must be in a terminal status (COMPLETED, STOPPED, or FAILED)."
      }
    ],
    "responseSummary": "JSON object: { run_id, status, partial: boolean (true for STOPPED/FAILED — files are a partial checkpoint, not the finished adapter), files: [ { name (e.g. adapter_model.safetensors), size_bytes: integer|null, url (presigned GET, valid 15 minutes), expires_at (ISO) } ], empty_reason?: string (present when files is empty), storage_unavailable?: true (weight storage not configured — try later) }. Files sorted safetensors first, then adapter files, then config/tokenizer.",
    "notes": "400 while the run is ACTIVE ('Weights are available once the run finishes.') and for OVERBUDGET runs ('This run has no trained adapter to download.'). 404 for foreign/unknown runs. Links expire after 15 minutes — re-call to refresh. Every call is audit-logged as a weight export. Feature-flag gated (fineTuning flag off → 404). OWNER/ADMIN key required (403)."
  },
  {
    "name": "list_label_sets",
    "method": "GET",
    "path": "/v1/label_sets",
    "summary": "List the workspace's golden sets — named collections of human-graded requests with their measured label quality (inter-rater kappa) — use it to see which sets exist, which are frozen, and which judges calibrate on them.",
    "scope": "read",
    "responseSummary": "JSON array (bare array, newest first) of { id, name, description, size: integer, membership_hash: string|null, frozen_at: ISO|null, kappa: number|null, agreement: number|null, kappa_n: integer|null, rater_count: integer|null, attached_to: [ { id, name } ] (criteria calibrating on this set), created_at }.",
    "notes": "Returns a bare JSON array, not a { object: 'list' } envelope. kappa is null until the set is frozen, and stays null after freezing when no blind re-grades by a second rater exist inside the set."
  },
  {
    "name": "create_label_set",
    "method": "POST",
    "path": "/v1/label_sets",
    "summary": "Create a golden set from human-graded requests — either explicit request ids or the newest N grades — as the first step toward a frozen, kappa-measured calibration set for a judge.",
    "scope": "evals:write",
    "body": [
      {
        "name": "name",
        "type": "string",
        "description": "Set name, trimmed, 1..80 chars (400 otherwise).",
        "required": true
      },
      {
        "name": "description",
        "type": "string",
        "description": "Optional description; trimmed and truncated to 500 chars."
      },
      {
        "name": "request_ids",
        "type": "array",
        "description": "Explicit members. Every id must carry a human (non-verifier) grade in this workspace, otherwise 400 naming how many are missing. Deduplicated. Takes precedence over `latest` when non-empty.",
        "items": "string"
      },
      {
        "name": "latest",
        "type": "integer",
        "description": "When request_ids is absent/empty: take the newest N human grades. Default 200; clamped to 20..5000."
      }
    ],
    "responseSummary": "201 with the set object: { id, name, description, size, membership_hash: null, frozen_at: null, kappa: null, agreement: null, kappa_n: null, rater_count: null, attached_to: [], created_at }. The set is NOT frozen yet.",
    "notes": "A set needs at least 20 distinct graded requests (400 'A golden set needs at least 20 graded requests (have N)') and at most 5000. Verifier-sourced labels never count as members. Freeze the set (POST /v1/label_sets/{id}/freeze) before attaching it to a criterion."
  },
  {
    "name": "attach_label_set",
    "method": "POST",
    "path": "/v1/label_sets/{id}/attach",
    "summary": "Attach a frozen golden set to a judge criterion so its calibration runs on that set and its certificate carries the set's kappa — or detach it.",
    "scope": "evals:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The golden set id. Must be frozen to attach; ignored when detach=true."
      }
    ],
    "body": [
      {
        "name": "criterion_id",
        "type": "string",
        "description": "The judge criterion to attach the set to. Non-empty string required (400 'criterion_id is required'); 404 'Criterion not found' if not in the workspace.",
        "required": true
      },
      {
        "name": "detach",
        "type": "boolean",
        "description": "When exactly true, clears the criterion's golden set (sets label_set_id to null) instead of attaching {id}."
      }
    ],
    "responseSummary": "200 { criterion_id: string, label_set_id: string|null } — the criterion's new golden-set binding.",
    "notes": "400 'Freeze the golden set first — an unfrozen set can change under the calibration.' when the set has no frozen_at. 404 'Golden set not found' for foreign/unknown set ids (when attaching). A criterion holds at most one golden set; attaching replaces the previous one."
  },
  {
    "name": "freeze_label_set",
    "method": "POST",
    "path": "/v1/label_sets/{id}/freeze",
    "summary": "Freeze a golden set: seal its membership with a hash and measure inter-rater agreement (kappa) on its members — required before a judge can calibrate on it.",
    "scope": "evals:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The golden set id (workspace-scoped; 404 'Golden set not found' otherwise)."
      }
    ],
    "responseSummary": "200 with the updated set object: { id, name, description, size, membership_hash (sha256 of sorted member ids), frozen_at (ISO), kappa: number|null, agreement: number|null, kappa_n: integer|null, rater_count: integer, attached_to: [ { id, name } ], created_at }.",
    "notes": "No body. Re-freezing an already-frozen set re-measures kappa/agreement/rater_count but keeps the original frozen_at and membership. kappa is null (and reported as null, never as good) when fewer than two raters' blind re-grades exist inside the set. 400 if inter-rater stats are unavailable."
  },
  {
    "name": "list_labels",
    "method": "GET",
    "path": "/v1/labels",
    "summary": "List the workspace's human pass/fail grades (ground-truth labels) on logged requests, newest first — use it to audit or export the verdicts every judge is measured against.",
    "scope": "read",
    "query": [
      {
        "name": "verdict",
        "type": "string",
        "description": "Filter to one verdict. Any other value is ignored (no filter).",
        "enum": [
          "pass",
          "fail"
        ]
      },
      {
        "name": "limit",
        "type": "integer",
        "description": "Page size. Default 50, clamped 1..200. Non-numeric or 0 falls back to the default.",
        "default": 50
      },
      {
        "name": "offset",
        "type": "integer",
        "description": "Rows to skip (offset pagination). Default 0.",
        "default": 0
      }
    ],
    "responseSummary": "JSON { object: 'list', total: integer (matching rows across all pages), data: [ { id, request_id, verdict ('pass'|'fail'), critique: string|null, source ('human'|'assist_accepted'|'verifier'), scope ('request'|'trace'), created_at (ISO) } ] }.",
    "notes": "Offset pagination: page through with offset += limit until offset >= total. Rows include labels of every source (human, assist_accepted, verifier)."
  },
  {
    "name": "create_label",
    "method": "POST",
    "path": "/v1/labels",
    "summary": "Record a human or downstream-system pass/fail verdict on a logged request (or on the whole agent run it belongs to) — this is the ground truth judge calibration, corrected pass rates, and training rewards are measured against.",
    "scope": "evals:write",
    "body": [
      {
        "name": "request_id",
        "type": "string",
        "description": "The gateway request id being graded (1..128 chars after trim). For scope=trace, send the run's FINAL-step request id. Missing/empty → 400.",
        "required": true
      },
      {
        "name": "verdict",
        "type": "string",
        "description": "The grade. WARNING: if omitted the route defaults to \"pass\" — always send it explicitly.",
        "required": true,
        "enum": [
          "pass",
          "fail"
        ]
      },
      {
        "name": "critique",
        "type": "string",
        "description": "Why (max 2000 chars). Strongly encouraged on fails — becomes judge few-shot material and failure-taxonomy text. null allowed."
      },
      {
        "name": "scope",
        "type": "string",
        "description": "\"request\" (default) grades this one exchange; \"trace\" grades the whole agent run the request belongs to. Trace-unit judges calibrate only against trace-scoped labels. Unknown values are rejected with 400, never silently dropped.",
        "enum": [
          "request",
          "trace"
        ]
      }
    ],
    "responseSummary": "201 with the stored label: { id, request_id, verdict, critique, source ('human'), scope, fail_causes: string[], created_at }.",
    "notes": "Upsert by request_id: re-labeling the same request replaces the verdict/critique/scope (newest judgment wins); a 'pass' clears any prior failure attributions. Requires the key's minting user to be workspace OWNER/ADMIN (403) — labels define quality. Side effects: settles pending judge suspicions on the trace, fulfils pending recalibration-slice requests, and flags affected judges' calibrations for revision. Validation errors (e.g. bad scope, over-long critique) return 400 with the schema message."
  },
  {
    "name": "list_logs",
    "method": "GET",
    "path": "/v1/logs",
    "summary": "Browse the workspace's logged chat exchanges (request messages + assistant reply, secret-scrubbed) with filters for model, tag, auto-detected traffic segment, finish reason, cache hit and time range — use it to inspect real traffic before grading, building datasets, or running evals.",
    "scope": "read",
    "query": [
      {
        "name": "model",
        "type": "string",
        "description": "Exact model name filter."
      },
      {
        "name": "tag",
        "type": "string",
        "description": "Exact request tag filter."
      },
      {
        "name": "segment",
        "type": "string",
        "description": "Auto-detected traffic segment: the FAMILY of system prompts sharing one template (value of a row's `segment` field; the reserved value \"none\" is the no-system-prompt segment). Exact match."
      },
      {
        "name": "finish_reason",
        "type": "string",
        "description": "Exact finish-reason filter (e.g. stop, length, tool_calls)."
      },
      {
        "name": "cache_hit",
        "type": "boolean",
        "description": "\"true\" or \"false\" — filter to cached / uncached responses. Any other value = no filter.",
        "enum": [
          "true",
          "false"
        ]
      },
      {
        "name": "start",
        "type": "integer",
        "description": "Inclusive lower bound, Unix seconds (positive integer; other values ignored)."
      },
      {
        "name": "end",
        "type": "integer",
        "description": "Upper bound, Unix seconds (positive integer; other values ignored)."
      },
      {
        "name": "limit",
        "type": "integer",
        "description": "Page size, clamped 1..100. Default 25.",
        "default": 25
      },
      {
        "name": "offset",
        "type": "integer",
        "description": "Rows to skip (offset pagination). Default 0.",
        "default": 0
      }
    ],
    "responseSummary": "JSON { object: 'list', total: integer, limit, offset, data: [ { request_id, created_at (Unix seconds), model, tag, segment (prompt family id), segment_exact (exact system-prompt hash), trace_id, finish_reason, streamed: boolean, cache_hit: boolean, fallback_from: string|null, prompt_tokens, completion_tokens, messages: parsed JSON array of request messages (null if unparseable), response: parsed assistant message object (null if unparseable) } ] }. Newest first, successful (non-aborted) exchanges only.",
    "notes": "Request logging is opt-in per workspace: returns 409 { error: { message, type: 'invalid_request_error', code: 'logging_disabled' } } when it is off — an empty list would otherwise read as 'no traffic'. Offset pagination: repeat with offset += limit until offset >= total. Pass a row's `segment` back as ?segment= or into an eval's sample_filters.segment to slice by that application surface."
  },
  {
    "name": "export_logs",
    "method": "GET",
    "path": "/v1/logs/export",
    "summary": "Export the filtered logged exchanges as JSONL in chat format — one {\"messages\":[...]} line per exchange with the assistant reply appended — ready to pipe into your own training or eval tooling.",
    "scope": "read",
    "query": [
      {
        "name": "model",
        "type": "string",
        "description": "Exact model name filter."
      },
      {
        "name": "tag",
        "type": "string",
        "description": "Exact request tag filter."
      },
      {
        "name": "segment",
        "type": "string",
        "description": "Auto-detected traffic segment (prompt family) — exact match, same values as GET /v1/logs rows' `segment`."
      },
      {
        "name": "finish_reason",
        "type": "string",
        "description": "Exact finish-reason filter."
      },
      {
        "name": "cache_hit",
        "type": "boolean",
        "description": "\"true\" or \"false\".",
        "enum": [
          "true",
          "false"
        ]
      },
      {
        "name": "start",
        "type": "integer",
        "description": "Inclusive lower bound, Unix seconds."
      },
      {
        "name": "end",
        "type": "integer",
        "description": "Upper bound, Unix seconds."
      }
    ],
    "responseSummary": "200 with Content-Type application/jsonl; charset=utf-8. Body: newline-terminated lines, each {\"messages\": [ ...request messages, assistantReplyMessage ]}, newest first. Response headers: X-Omnia-Export-Count (lines written) and X-Omnia-Export-Capped ('true' when the 10,000-row cap was hit — narrow the filter, e.g. a time range, to get the rest).",
    "notes": "No limit/offset — the export is capped at 10,000 rows; use X-Omnia-Export-Capped to detect truncation. Rows whose stored JSON doesn't parse are skipped, never fail the export. 409 { error: string } (flat shape) when request logging is disabled for the workspace. Only successful (non-aborted) exchanges are exported.",
    "raw": true
  },
  {
    "name": "import_logs",
    "method": "POST",
    "path": "/v1/logs/import",
    "summary": "Import graded traffic: turn external (conversation, reply, optional human verdict) rows into logged exchanges the judge and alignment paths can grade — a labelled export from another tool, a physician-rated benchmark, a spreadsheet of tickets — without replaying prompts through a model. Verdicts become human labels in the same call.",
    "scope": "evals:write",
    "body": [
      {
        "name": "rows",
        "type": "array",
        "required": true,
        "description": "Up to 200 rows: { request_id?: string (letters, digits, _ . : -, max 100 — becomes pg_im_<id>), messages: [{role, content}], response: string | {content, tool_calls?}, model?: string (default external/import), tag?: string, tools?: object[], prompt_tokens?, completion_tokens?, finish_reason?, verdict?: \"pass\"|\"fail\", critique?: string, scope?: \"request\"|\"trace\" }."
      },
      {
        "name": "tag",
        "type": "string",
        "description": "Default traffic tag for rows without one (max 64). Use it as the criterion's population when calibrating on these rows."
      }
    ],
    "responseSummary": "{ object: 'list', data: [ { request_id, logged, reason?, labelled?, label_error? } ], imported, failed, labelled }.",
    "notes": "409 logging_disabled when request logging is off for the workspace. Rows carrying a verdict require OWNER/ADMIN (403). Never retried — a re-sent request_id is a duplicate you own. Rate limited to 30 calls/min."
  },
  {
    "name": "list_model_versions",
    "method": "GET",
    "path": "/v1/model_versions",
    "summary": "List the workspace's model-version chain — one immutable record per completed training round, pinning the judge, curriculum and holdout its verdict depended on — use it to review improvement history and pick a version to adopt or roll back to.",
    "scope": "read",
    "query": [
      {
        "name": "base_model",
        "type": "string",
        "description": "Filter to one base model's lineage (exact match)."
      }
    ],
    "responseSummary": "JSON { object: 'list', data: [ { id, parent_id: string|null, base_model, artifact_ref, served_model: string|null (null = not deployed/servable yet), source_run_id, source_kind ('grpo'|'finetune'), verdict: any (bake-off verdict JSON), judge_criterion_id, curriculum_hash, holdout_hash, comparable_to_parent: boolean (true only when parent's holdout hash matches — otherwise treat the delta as a discontinuity), adopted_at: ISO|null, created_at: ISO } ] }. Newest first, at most 200.",
    "notes": "NOT feature-flag gated (deliberately readable even when training is paused, so the audit trail stays visible). The key's minting user must be workspace OWNER/ADMIN (403). No pagination beyond the 200 cap."
  },
  {
    "name": "get_model_version",
    "method": "GET",
    "path": "/v1/model_versions/{id}",
    "summary": "Fetch one model version's record (lineage, artifact, served model name, verdict, pinned hashes, adoption time) — use it to inspect a specific training round before adopting it.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The model version id. Workspace-scoped: a foreign or unknown id is 404 'Version not found in this workspace.'"
      }
    ],
    "responseSummary": "JSON object { id, parent_id, base_model, artifact_ref, served_model, source_run_id, source_kind, verdict, judge_criterion_id, curriculum_hash, holdout_hash, comparable_to_parent, adopted_at, created_at } — same shape as the list rows.",
    "notes": "Not feature-flag gated. OWNER/ADMIN key required (403)."
  },
  {
    "name": "adopt_model_version",
    "method": "POST",
    "path": "/v1/model_versions/{id}/adopt",
    "summary": "Point a model alias at a deployed model version — adoption and rollback are the same audited repoint on different rows of the chain — use it to promote a trained round into production or roll back to an earlier one.",
    "scope": "platform:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "description": "The model version id to route traffic to. Must be in the workspace and have a served_model (deployed)."
      }
    ],
    "body": [
      {
        "name": "aliasName",
        "type": "string",
        "description": "camelCase only. Name of an existing alias in the workspace (404 'Alias \"<name>\" not found.' otherwise). Non-empty string required (400).",
        "required": true
      }
    ],
    "responseSummary": "200 { served_model: string } — the model name the alias now resolves to.",
    "notes": "MOVES PRODUCTION TRAFFIC: the alias's target is replaced and any live canary split on it is cleared (canary_model null, canary_percent 0). 400 'This version is not deployed yet — deploy its weights before routing traffic to it.' when served_model is null. 404 for a foreign version id or unknown alias. Feature-flag gated (fineTuning flag off → 404) unlike the GET routes. OWNER/ADMIN key required (403). Zod failure returns 400 { error: 'Invalid body: aliasName — ...' } (flat shape). Adoption stamps adopted_at on first adoption only; it is audit-logged."
  },
  {
    "name": "list_reward_sessions",
    "method": "GET",
    "path": "/v1/reward/sessions",
    "summary": "List this workspace's reward sessions — the certified reward handed to your own trainer — with status, ledger-true spend, expiry, the judges' certificates and the mid-run anchor state.",
    "scope": "read",
    "responseSummary": "{ object: \"list\", data: [RewardSession] } where RewardSession = { id, status (ACTIVE|COMPLETED|OVERBUDGET|STOPPED|FAILED), agentic, reward, label, budget_usd, spent_usd, expires_at, created_at, stopped_at, certificates: [JudgeCertificate], anchor: null | { criterion_id, criterion_name, held, held_at, held_reason, pinned_step, checks, history: [AnchorPoint] } }.",
    "notes": "Newest first, max 100. errorbar never runs the training — the certificate is issued by a party with no stake in the run."
  },
  {
    "name": "create_reward_session",
    "method": "POST",
    "path": "/v1/reward/sessions",
    "summary": "Register a certified reward session for your own trainer: a validated reward (calibrated, non-drift-flagged judges), a reward budget held in the wallet, an expiry, and every judge's signed certificate returned before the first rollout is scored — optionally with an independent anchor judge that holds the run when the reward is being gamed.",
    "scope": "platform:write",
    "spends": true,
    "body": [
      {
        "name": "reward",
        "type": "object",
        "required": true,
        "description": "{ mode: \"single\", criterionId } or { mode: \"compositional\", criterionIds: string[] (≥2), assertions?: object[] }. Judges must be calibrated (single ≥0.9 TPR/TNR; compositional ≥0.75 each), not drift-flagged, and on the unit the session grades; refused with the reason otherwise."
      },
      {
        "name": "rewardBudgetUsd",
        "type": "number",
        "required": true,
        "description": "Hard cap on judge spend (max 10000). Held in the wallet at creation; released on stop, expiry or exhaustion (402 budget_exhausted on the next score call)."
      },
      {
        "name": "agentic",
        "type": "boolean",
        "description": "Whole-trajectory rewards (steps[]) need trace-unit judges; default false = single-turn, request-unit judges."
      },
      {
        "name": "ttlHours",
        "type": "number",
        "description": "Session expiry in hours (default 72, max 720). Scoring past it is refused and the hold released."
      },
      {
        "name": "label",
        "type": "string",
        "description": "Free text, ≤120 chars."
      },
      {
        "name": "anchor",
        "type": "object",
        "description": "{ criterionId } — an INDEPENDENT calibrated judge: a different criterion whose model or prompt differs from every reward judge (a clone with a new id is refused), aligned ≥0.9, not drift-flagged, same unit. Enables anchor_check."
      }
    ],
    "responseSummary": "201 RewardSession (see list_reward_sessions) including certificates[] and anchor.",
    "notes": "Requires an OWNER/ADMIN key with platform:write. 402 when the wallet cannot hold the budget; 400 with the exact reason when the reward or anchor fails validation."
  },
  {
    "name": "get_reward_session",
    "method": "GET",
    "path": "/v1/reward/sessions/{id}",
    "summary": "Read one reward session: status, ledger-true spend, expiry, the judges' certificates, and the anchor's hold state and recent checks.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "required": true,
        "description": "Session id."
      }
    ],
    "responseSummary": "RewardSession (see list_reward_sessions).",
    "notes": "404 for unknown or foreign sessions."
  },
  {
    "name": "stop_reward_session",
    "method": "DELETE",
    "path": "/v1/reward/sessions/{id}",
    "summary": "Stop a reward session: further scoring is refused and the wallet hold for its budget is released. Idempotent.",
    "scope": "platform:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "required": true,
        "description": "Session id."
      }
    ],
    "responseSummary": "RewardSession with status STOPPED.",
    "notes": "Owner/admin only."
  },
  {
    "name": "score_reward",
    "method": "POST",
    "path": "/v1/reward/score",
    "summary": "Score a rollout group (≤64) against a reward session — the certified reward as your trainer's reward function: composite grade = mean of judge P(pass) and 0/1 assertions, strict pass/fail verdict, masked (null) when a judge cannot parse.",
    "scope": "platform:write",
    "spends": true,
    "body": [
      {
        "name": "sessionId",
        "type": "string",
        "required": true,
        "description": "The reward session."
      },
      {
        "name": "step",
        "type": "string",
        "description": "Optimizer step tag, ≤40 chars of [A-Za-z0-9_.-]. Namespaces billing ids so a re-sent step is idempotent."
      },
      {
        "name": "items",
        "type": "array",
        "items": "object",
        "required": true,
        "description": "1..64 rollouts: { requestId: string, conversation: string, response?: string } for single-turn, or { requestId, conversation, steps: [{ role: \"assistant\"|\"tool\", content, source?, toolName? }], sessionId? } for agentic sessions. The server renders trajectories through the same instrument trace calibration uses."
      }
    ],
    "responseSummary": "{ session_id, scores: [{ request_id, grade: number|null, verdict: pass|fail|unparsed, sim_fraction?, raw_grade?, exec_unverified?, attested?, attestation_mismatch? }], spend_micros, criteria: [criterionId] }.",
    "notes": "grade null = MASK the sample out of the loss; never treat it as 0. Refusals: 402 budget_exhausted (the session's kill switch), 409 held (the anchor held the run — resume deliberately or ship pinned_step), 404 unknown/foreign session, 422 the reward no longer validates. Billing ids are reward:<session>:<step> so a re-sent step settles idempotently."
  },
  {
    "name": "anchor_check",
    "method": "POST",
    "path": "/v1/reward/sessions/{id}/anchor",
    "summary": "Mid-run anchor: submit the current policy's outputs on your FROZEN prompt set; the server scores them with the session's reward and with the independent anchor judge (corrected for its measured error) and decides whether to HOLD the run — reward up ≥10 points over the last three checks while the anchor moves ≤2, or the anchor ≥10 points below its best.",
    "scope": "platform:write",
    "spends": true,
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "required": true,
        "description": "Session id (created with anchor.criterionId)."
      }
    ],
    "body": [
      {
        "name": "step",
        "type": "string",
        "description": "Optimizer step tag, ≤40 chars of [A-Za-z0-9_.-]. Namespaces billing ids so a re-sent step is idempotent.",
        "required": true
      },
      {
        "name": "items",
        "type": "array",
        "items": "object",
        "required": true,
        "description": "1..64 rollouts: { requestId: string, conversation: string, response?: string } for single-turn, or { requestId, conversation, steps: [{ role: \"assistant\"|\"tool\", content, source?, toolName? }], sessionId? } for agentic sessions. The server renders trajectories through the same instrument trace calibration uses."
      }
    ],
    "responseSummary": "{ session_id, held: boolean, reason: string|null, pinned_step: string|null (the best anchor point — the checkpoint to ship), point: { step, at, n, reward_rate, anchor_rate, anchor_ci: [lo, hi], anchor_corrected, masked }, underpowered: string|null, history: [AnchorPoint] (last 20), spend_micros }.",
    "notes": "Hold, never kill: a held session refuses score_reward with 409 until resume_reward_session. Points with fewer than 20 gradable prompts hold nothing (underpowered says so). 409 held when already held; 422 when the session has no anchor."
  },
  {
    "name": "resume_reward_session",
    "method": "POST",
    "path": "/v1/reward/sessions/{id}/resume",
    "summary": "A human clears an anchor hold on a reward session; the history is kept and the next anchor check decides again from the same window. Never automatic.",
    "scope": "platform:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "required": true,
        "description": "Session id."
      }
    ],
    "responseSummary": "RewardSession with anchor.held = false.",
    "notes": "Owner/admin only. 400 when the session has no anchor; 404 unknown/foreign."
  },
  {
    "name": "export_reward_session",
    "method": "GET",
    "path": "/v1/reward/sessions/{id}/export",
    "summary": "Export the graded trajectories a reward session scored, as JSONL — rl (one line per scored item: prompt, completion, reward, verdict, per-judge grades), sft (passing winners, reward ≥ min_grade, fine-tuning prompts format), or pairwise (chosen/rejected from the same prompt within a step, gap ≥ 0.2, for DPO).",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "required": true,
        "description": "Session id."
      }
    ],
    "query": [
      {
        "name": "format",
        "type": "string",
        "description": "rl (default) | sft | pairwise.",
        "enum": [
          "rl",
          "sft",
          "pairwise"
        ]
      },
      {
        "name": "step",
        "type": "string",
        "description": "Only items scored under this step tag."
      },
      {
        "name": "min_grade",
        "type": "number",
        "description": "sft only: minimum reward for a winner (0..1). Default 0.9."
      },
      {
        "name": "limit",
        "type": "integer",
        "description": "Rows to scan, at most 10,000."
      }
    ],
    "responseSummary": "200 application/jsonl; newline-terminated lines. Headers X-Errorbar-Export-Count (lines written), X-Errorbar-Export-Scanned (records read), X-Errorbar-Export-Capped ('true' when the 10,000-row scan cap was hit — narrow with step).",
    "notes": "Only REGISTERED sessions keep records; a session that never scored returns an empty body. 404 for unknown or foreign sessions.",
    "raw": true
  },
  {
    "name": "get_reward_environment",
    "method": "GET",
    "path": "/v1/reward/sessions/{id}/environment",
    "summary": "Fetch a reward session's signed environment bundle — reward spec, each judge's calibration certificate, assertions, declared env tools (names only), stored tasks, anchor state, and TRL/verifiers adapter snippets — or just tasks.jsonl with format=tasks.",
    "scope": "read",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "required": true,
        "description": "Session id."
      }
    ],
    "query": [
      {
        "name": "format",
        "type": "string",
        "description": "bundle (default, JSON) | tasks (JSONL, one task per line).",
        "enum": [
          "bundle",
          "tasks"
        ]
      }
    ],
    "responseSummary": "JSON bundle { bundle_v, kind: 'errorbar.reward_environment', issued_at, session { id, status, agentic, label, created_at, expires_at, held, pinned_step }, reward, grader { criteria[], certificates[], assertions[] }, anchor, tools[], tasks[], task_count, endpoints, adapters { trl, verifiers }, signature } — verify with verify_document. format=tasks returns application/jsonl.",
    "notes": "Signed with the same key as eval evidence bundles. Tool endpoint URLs and auth are never included. 404 for unknown or foreign sessions."
  },
  {
    "name": "list_eval_endpoints",
    "method": "GET",
    "path": "/v1/endpoints",
    "summary": "List the customer endpoints registered as eval candidates (endpoint/<name>) — bring-your-own checkpoints served anywhere OpenAI-compatible.",
    "scope": "read",
    "responseSummary": "{ object: 'list', data: [ { id, name, ref ('endpoint/<name>'), base_url, model, key_prefix, has_key, created_at } ] }. Keys are never returned."
  },
  {
    "name": "register_eval_endpoint",
    "method": "POST",
    "path": "/v1/endpoints",
    "summary": "Register (or rotate) a customer OpenAI-compatible endpoint so a checkpoint trained anywhere can be an eval candidate named endpoint/<name>, facing the same holdout, judge, gate and certificate as a catalog model; generations are metered at $0.",
    "scope": "platform:write",
    "body": [
      {
        "name": "name",
        "type": "string",
        "required": true,
        "description": "Letters, digits, _ . - (max 64). Becomes endpoint/<name>."
      },
      {
        "name": "baseUrl",
        "type": "string",
        "required": true,
        "description": "OpenAI-compatible base URL (https)."
      },
      {
        "name": "model",
        "type": "string",
        "required": true,
        "description": "The model name the endpoint expects."
      },
      {
        "name": "apiKey",
        "type": "string",
        "description": "Optional bearer key; stored encrypted, never returned."
      }
    ],
    "responseSummary": "201 EvalEndpoint { id, name, ref, base_url, model, key_prefix, has_key, created_at }.",
    "notes": "Owner/admin only (403). Re-registering a name rotates URL, model and key. Validated by existence, never by the catalog; a customer endpoint is never a judge. 400 'Invalid body: <path> — <message>'."
  },
  {
    "name": "delete_eval_endpoint",
    "method": "DELETE",
    "path": "/v1/endpoints/{id}",
    "summary": "Remove a registered customer endpoint; past eval results keep their lineage, new runs naming it are refused.",
    "scope": "platform:write",
    "pathParams": [
      {
        "name": "id",
        "type": "string",
        "required": true,
        "description": "Endpoint id (from list_eval_endpoints)."
      }
    ],
    "responseSummary": "{ ok: true }.",
    "notes": "Owner/admin only (403). 404 for unknown or foreign endpoints."
  },
  {
    "name": "list_raft_rounds",
    "method": "GET",
    "path": "/v1/raft/rounds",
    "summary": "List the workspace's self-improvement (rejection-sampling fine-tuning) rounds, newest first, with winners/give-ups, budget and ledger-true spend — read-only observability for rounds started from the dashboard.",
    "scope": "read",
    "responseSummary": "JSON { rounds: [ { id, status, criterion_name, policy_model, prompt_count, candidates_per_prompt, winners_count, giveups_count, produced_job_id: string|null (the fine-tuning job a COMPLETED round produced), skip_reason: string|null (SKIPPED rounds), budget_usd: number|null, spent_usd: number, created_at: ISO, completed_at: ISO|null } ] }. At most 200 rounds.",
    "notes": "List-only: there is no public start endpoint for rounds. Feature-flag gated (fineTuning flag off → 404). OWNER/ADMIN key required (403). Returns { rounds: [] } (not an error) when the round history table hasn't been provisioned yet. spent_usd is 0 for rounds created before per-round budgets existed."
  },
  {
    "name": "get_judge_settings",
    "method": "GET",
    "path": "/v1/settings/judge",
    "summary": "Read the workspace's default judge model (used for eval runs that don't name their own judge) and the platform's house default.",
    "scope": "read",
    "responseSummary": "JSON { default_judge_model: string|null (null = house default / auto), house_default: string }. Sent with Cache-Control: no-store.",
    "notes": "Precedence at run time: a run's own judge_model > this workspace default > house_default. Screening still swaps a default that would judge its own sibling model."
  },
  {
    "name": "set_judge_settings",
    "method": "PUT",
    "path": "/v1/settings/judge",
    "summary": "Set (or clear) the workspace's default judge model for eval runs that don't specify one — must be a chat model from the platform catalog offered to this workspace.",
    "scope": "platform:write",
    "body": [
      {
        "name": "default_judge_model",
        "type": "string",
        "description": "Model id (e.g. \"openai/gpt-4.1\") to use as the default judge, or null / omitted / empty string to revert to the house default. Any non-string, non-null value → 400 'default_judge_model must be a string or null'. Must be a chat (non-embedding) model this workspace is offered, otherwise 400 '\"<model>\" isn't a chat model this workspace is offered.'"
      }
    ],
    "responseSummary": "200 { default_judge_model: string|null, house_default: string } — the settings after the update.",
    "notes": "Judges run on the platform's key and are metered to the wallet, so only platform-catalog models qualify (a workspace's own provider keys are for inference, not judging). Needs platform:write (it is a workspace setting)."
  },
  {
    "name": "get_setup_status",
    "method": "GET",
    "path": "/v1/setup/status",
    "summary": "Answer 'where am I and what should I do next?' in one call — workspace identity, logging state, traffic and grade counts, judge calibration progress, and the single dependency-ordered next step; also the cheapest way to check that an API key is live and which workspace it belongs to.",
    "scope": "read",
    "responseSummary": "JSON (camelCase keys — this route does NOT snake-case): { workspace: { slug, name }, logging: { enabled: boolean, retentionDays: integer }, traffic: { loggedConversations: integer|null (null = log store unreachable, NOT zero traffic) }, grades: { total, neededToCalibrate (grades still short of the 30 required) }, judges: { total, calibrated, trustworthy, failGradesNeeded: integer|null }, next: { action: 'enable_logging'|'send_traffic'|'grade'|'create_judge'|'calibrate'|'grade_failures'|'recalibrate'|'compare', detail: string, href: string (dashboard path) } }. With request header Accept: text/plain the same data is returned as flat snake_case key=value lines (e.g. grades_total=12, next_action=grade), one per line.",
    "notes": "Never cached (Cache-Control: no-store). A 200 proves the key is valid; 401 otherwise. Field casing differs from every other /v1 route (camelCase in JSON, snake_case only in the text/plain form)."
  },
  {
    "name": "get_trace",
    "method": "GET",
    "path": "/v1/traces/{traceId}",
    "summary": "Fetch every logged step of one agent run or conversation (grouped by the X-Omnia-Trace-Id you sent), oldest-first in execution order and including aborted partials — use it for error analysis of a multi-step run.",
    "scope": "read",
    "pathParams": [
      {
        "name": "traceId",
        "type": "string",
        "description": "The trace id sent as X-Omnia-Trace-Id on the gateway requests. 404 'Trace not found' when no logged step carries it."
      }
    ],
    "responseSummary": "JSON { object: 'list', trace_id, data: [ { request_id, created_at (Unix seconds), model, alias: string|null, tag, status ('SUCCESS'|'ABORTED'), finish_reason, streamed, cache_hit, fallback_from, prompt_tokens, completion_tokens, messages: parsed request messages (null if unparseable), response: parsed assistant message (null if unparseable) } ] } ordered oldest first.",
    "notes": "Requires request logging to be enabled — 409 { error: string } (flat shape) otherwise. Unlike /v1/logs this includes ABORTED partial rows (a run that died at step 4 is the finding). No pagination or filters."
  },
  {
    "name": "verify_document",
    "method": "POST",
    "path": "/v1/verify",
    "summary": "Verify that a downloaded certificate or evidence bundle was issued by the platform and has not been altered, by re-deriving its HMAC signature — use it when a third party hands you a document and you need to trust its numbers.",
    "scope": "read",
    "body": [
      {
        "name": "document",
        "type": "object",
        "description": "The full signed JSON document exactly as downloaded (a certificate or evidence bundle carrying signature: { alg: 'HS256', key_id, value }). The `document` key must be present (400 'Body must be { document: <signed JSON> }' otherwise); its value may be any JSON.",
        "required": true
      }
    ],
    "responseSummary": "Always 200 for a well-formed body: { ok: true, key_id: string } when the bytes are ours and unaltered; otherwise { ok: false, reason: 'unsigned' (no signature field) | 'malformed' (not an object or signature shape wrong) | 'unknown_key' (signed by a key this platform doesn't hold, e.g. after rotation) | 'mismatch' (any field was edited) | 'no_secret' (verification not configured on the platform) }.",
    "notes": "Read scope suffices (POST that writes nothing); nothing is stored. Verification canonicalises the document (keys sorted recursively, undefined dropped) before hashing, so key order does not matter but any value change does. Sent with Cache-Control: no-store."
  }
] as const;
