# @error-bar/mcp

The errorbar platform as MCP tools — every public API operation (evals, judges/criteria, gates, logs, datasets, aliases, label sets, audit/proving, dedicated endpoints, training) callable from Claude Code, Claude Desktop, Cursor, or any MCP client.

One tool per API operation, 76 tools, generated from the platform's route contracts. Inputs are validated with the same field names and casing the REST API accepts; responses come back exactly as the API returned them (JSON pretty-printed, exports as text), including the API's own error status and message.

> Renamed from `@omnia-voice/mcp` (2026-08-30). The old name is published as a shim that forwards here; update your config when convenient.

## Install

```bash
npx -y @error-bar/mcp        # or: npm i -g @error-bar/mcp && errorbar-mcp
```

Needs `ERRORBAR_API_KEY` (a workspace API key, `sk_…`, from **Settings → API keys**). Give the key only the scopes the agent should have — `read` for a monitoring agent, `read` + `evals:write` for one that runs evals — the platform enforces them and each tool's description says which scope it needs.

### Claude Code

```bash
claude mcp add errorbar -e ERRORBAR_API_KEY=sk_… -- npx -y @error-bar/mcp
```

### Claude Desktop / Cursor / any `mcpServers` config

```json
{
  "mcpServers": {
    "errorbar": {
      "command": "npx",
      "args": ["-y", "@error-bar/mcp"],
      "env": { "ERRORBAR_API_KEY": "sk_…" }
    }
  }
}
```

## Profiles — hand the agent the tools for one job

Seventy-six tools is the complete contract and the wrong thing to give a model with one question: every description is read before the first call, and a long list makes the pick worse. A profile is the handful a job needs, plus the task-shaped tools that answer the job's question directly.

```bash
npx -y @error-bar/mcp --profile monitor      # or ERRORBAR_MCP_PROFILE=monitor
```

| Profile | For | Tools |
| --- | --- | --- |
| `setup` | connect traffic and reach the first verdict | `get_setup_status`, `screen_my_traffic`, `list_logs`, `get_trace`, `list_evals`, `get_eval`, `list_criterion_templates`, `list_criteria`, `create_criterion`, `get_criterion`, `run_criterion_alignment`, `is_my_judge_trustworthy` |
| `monitor` | is quality holding, can the judges be trusted — read-only by construction | `get_setup_status`, `is_my_judge_trustworthy`, `list_criteria`, `get_criterion`, `get_criterion_alignment`, `get_criterion_certificate`, `list_alerts`, `get_judge_settings`, `get_failure_clusters`, `list_refusals`, `list_evals`, `get_eval` |
| `release` | ship or hold: comparison, gate on the interval, repoint the alias | `can_i_ship`, `screen_my_traffic`, `list_evals`, `get_eval`, `create_eval`, `get_eval_gate`, `get_eval_evidence`, `compare_evals`, `list_aliases`, `upsert_alias`, `get_criterion_certificate`, `verify_document` |
| `all` (default) | everything: all 76 operations plus the task tools | — |

`--read-only`, `--no-spend` and `--only` apply on top of a profile.

## Task-shaped tools

Three tools answer the questions people actually ask, with the doctrine applied (verdicts from the interval, never the point estimate) and a pointer to the one-per-endpoint tool for the detail:

| Tool | Question | Does |
| --- | --- | --- |
| `screen_my_traffic` | would a cheaper (or newer) model hold on my traffic? | starts a zero-config screening against the incumbent's stored answers, waits for it, returns each candidate's verdict with its win-rate interval, cost vs today and similarity to production, plus switch/keep. **Spends** wallet credit. |
| `is_my_judge_trustworthy` | can I believe this judge? | one criterion or all: trust verdict from the TPR/TNR intervals, catches-failures / passes-clean with 95% CIs, κ, grades, drift, and the one action that changes its state. Read-only. |
| `can_i_ship` | does the evidence let this change through? | gates the newest finished run (or `eval_id`) with your thresholds — defaults: certified-switch `noninferiority_margin 0.05` for a criterion run against stored answers, `min_win_rate 0.5` for a comparison — and returns ship/hold with every check's required vs actual (the interval's lower bound). Read-only; the same call is the CI step. |

## Resources and prompts

Resources: `errorbar://agent-setup.md` and `errorbar://llms.txt` (fetched live from www.errorbar.ai, so an installed server never rots) and `errorbar://after-traffic-flows` (the first five steps, each naming the tool that performs it). Prompts: `set-up-errorbar`, `after-traffic-flows`, `release-check` (`eval_id` optional).

## Flags

| Flag | Effect |
| --- | --- |
| `--profile NAME` (or `ERRORBAR_MCP_PROFILE`) | `setup` · `monitor` · `release` · `all` (default) — see Profiles |
| `--read-only` (or `ERRORBAR_MCP_READ_ONLY=1`) | expose only `GET` tools (and the read-only task tools) |
| `--no-spend` (or `ERRORBAR_MCP_NO_SPEND=1`) | hide tools that start billable work (eval runs, screening, training, dedicated capacity, judge assists) |
| `--only list_evals,get_eval` | expose just these tools |
| `--base-url URL` (or `ERRORBAR_BASE_URL`) | API root, default `https://gateway.errorbar.ai` |

The `OMNIA_*` spellings of every environment variable are still accepted.

Tools that spend wallet credit say **SPENDS MONEY** in their description and are not `readOnlyHint`; MCP clients that confirm before non-read-only calls will ask for those.

## Tools

| Tool | Operation | Scope |
| --- | --- | --- |
| `list_alerts` | `GET /v1/alerts` | read |
| `list_aliases` | `GET /v1/aliases` | read |
| `upsert_alias` | `PUT /v1/aliases` | aliases:write |
| `delete_alias` | `DELETE /v1/aliases/{id}` | aliases:write |
| `export_audit_log` | `GET /v1/audit/export` | read |
| `list_audit_tombstones` | `GET /v1/audit/tombstones` | read |
| `create_audit_tombstone` | `POST /v1/audit/tombstones` | platform:write |
| `get_audit_verification` | `GET /v1/audit/verify` | read |
| `list_batches` | `GET /v1/batches` | read |
| `create_batch` | `POST /v1/batches` | platform:write · **spends** |
| `get_batch` | `GET /v1/batches/{id}` | read |
| `cancel_batch` | `POST /v1/batches/{id}/cancel` | platform:write |
| `list_criteria` | `GET /v1/criteria` | read |
| `create_criterion` | `POST /v1/criteria` | evals:write |
| `suggest_criteria` | `POST /v1/criteria/suggest` | evals:write · **spends** |
| `list_criterion_templates` | `GET /v1/criteria/templates` | read |
| `get_criterion` | `GET /v1/criteria/{id}` | read |
| `update_criterion` | `PATCH /v1/criteria/{id}` | evals:write |
| `delete_criterion` | `DELETE /v1/criteria/{id}` | evals:write |
| `run_criterion_alignment` | `POST /v1/criteria/{id}/align` | evals:write · **spends** |
| `get_criterion_alignment` | `GET /v1/criteria/{id}/alignment` | read |
| `auto_improve_criterion` | `POST /v1/criteria/{id}/auto_improve` | evals:write · **spends** |
| `get_criterion_certificate` | `GET /v1/criteria/{id}/certificate` | read |
| `scan_criterion_suspects` | `POST /v1/criteria/{id}/scan` | evals:write · **spends** |
| `decontaminate_texts` | `POST /v1/datasets/decontaminate` | evals:write |
| `create_dataset_from_logs` | `POST /v1/datasets/from_logs` | evals:write |
| `list_dedicated_endpoints` | `GET /v1/dedicated` | read |
| `create_dedicated_endpoint` | `POST /v1/dedicated` | platform:write · **spends** |
| `list_dedicated_templates` | `GET /v1/dedicated/templates` | read |
| `get_dedicated_endpoint` | `GET /v1/dedicated/{id}` | read |
| `update_dedicated_endpoint` | `PATCH /v1/dedicated/{id}` | platform:write · **spends** |
| `delete_dedicated_endpoint` | `DELETE /v1/dedicated/{id}` | platform:write |
| `list_refusals` | `GET /v1/enforcement/refusals` | read |
| `list_env_tools` | `GET /v1/env/tools` | read |
| `register_env_tool` | `POST /v1/env/tools` | platform:write |
| `delete_env_tool` | `DELETE /v1/env/tools/{id}` | platform:write |
| `list_evals` | `GET /v1/evals` | read |
| `create_eval` | `POST /v1/evals` | evals:write · **spends** |
| `compare_evals` | `GET /v1/evals/compare` | read |
| `get_failure_clusters` | `GET /v1/evals/failure_clusters` | read |
| `get_eval` | `GET /v1/evals/{id}` | read |
| `delete_eval` | `DELETE /v1/evals/{id}` | evals:write |
| `cancel_eval` | `POST /v1/evals/{id}/cancel` | evals:write |
| `get_eval_evidence` | `GET /v1/evals/{id}/evidence` | read |
| `get_eval_gate` | `GET /v1/evals/{id}/gate` | read |
| `get_eval_samples` | `GET /v1/evals/{id}/samples` | read |
| `list_training_files` | `GET /v1/fine_tuning/files` | read |
| `upload_training_file` | `POST /v1/fine_tuning/files` | platform:write |
| `list_fine_tuning_jobs` | `GET /v1/fine_tuning/jobs` | read |
| `create_fine_tuning_job` | `POST /v1/fine_tuning/jobs` | platform:write · **spends** |
| `get_fine_tuning_job` | `GET /v1/fine_tuning/jobs/{id}` | read |
| `cancel_fine_tuning_job` | `DELETE /v1/fine_tuning/jobs/{id}` | platform:write |
| `get_fine_tuning_bakeoff` | `GET /v1/fine_tuning/jobs/{id}/bakeoff` | read |
| `start_fine_tuning_bakeoff` | `POST /v1/fine_tuning/jobs/{id}/bakeoff` | platform:write · **spends** |
| `list_grpo_runs` | `GET /v1/grpo/runs` | read |
| `start_grpo_run` | `POST /v1/grpo/runs` | platform:write · **spends** |
| `get_grpo_run` | `GET /v1/grpo/runs/{id}` | read |
| `stop_grpo_run` | `POST /v1/grpo/runs/{id}/stop` | platform:write |
| `get_grpo_run_weights` | `GET /v1/grpo/runs/{id}/weights` | read |
| `list_label_sets` | `GET /v1/label_sets` | read |
| `create_label_set` | `POST /v1/label_sets` | evals:write |
| `attach_label_set` | `POST /v1/label_sets/{id}/attach` | evals:write |
| `freeze_label_set` | `POST /v1/label_sets/{id}/freeze` | evals:write |
| `list_labels` | `GET /v1/labels` | read |
| `create_label` | `POST /v1/labels` | evals:write |
| `list_logs` | `GET /v1/logs` | read |
| `export_logs` | `GET /v1/logs/export` | read |
| `list_model_versions` | `GET /v1/model_versions` | read |
| `get_model_version` | `GET /v1/model_versions/{id}` | read |
| `adopt_model_version` | `POST /v1/model_versions/{id}/adopt` | platform:write |
| `list_raft_rounds` | `GET /v1/raft/rounds` | read |
| `get_judge_settings` | `GET /v1/settings/judge` | read |
| `set_judge_settings` | `PUT /v1/settings/judge` | platform:write |
| `get_setup_status` | `GET /v1/setup/status` | read |
| `get_trace` | `GET /v1/traces/{traceId}` | read |
| `verify_document` | `POST /v1/verify` | read |

Each tool's description carries the full contract: every query and body field, what the response contains, and the gotchas (feature flags, 400 conditions, cursor semantics).

## Programmatic use

```ts
import { createServer, ErrorbarClient } from "@error-bar/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = createServer({ client: new ErrorbarClient({ apiKey: process.env.ERRORBAR_API_KEY! }), readOnly: true });
await server.connect(new StdioServerTransport());
```

## Development

```bash
npm ci && npm run typecheck && npm test && npm run build
```

`src/manifest.ts` is generated from the platform's `app/api/v1` routes; `test/manifest.test.ts` pins the exact route inventory it must cover, so a new platform route fails this suite until the manifest is regenerated.

## Release

Tag `vX.Y.Z` here, then run the `publish-mcp` workflow in [omnia-tracing](https://github.com/omnia-v/errorbar-tracing/actions/workflows/publish-mcp.yml) with that tag (`dir: .` publishes `@error-bar/mcp`; run it again with `dir: legacy` to publish the `@omnia-voice/mcp` forwarding shim) — the npm token lives there.

License: Apache-2.0
