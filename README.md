# @omnia-voice/mcp

The errorbar platform as MCP tools — every public API operation (evals, judges/criteria, gates, logs, datasets, aliases, label sets, audit/proving, dedicated endpoints, training) callable from Claude Code, Claude Desktop, Cursor, or any MCP client.

One tool per API operation, 76 tools, generated from the platform's route contracts. Inputs are validated with the same field names and casing the REST API accepts; responses come back exactly as the API returned them (JSON pretty-printed, exports as text), including the API's own error status and message.

## Install

```bash
npx -y @omnia-voice/mcp        # or: npm i -g @omnia-voice/mcp && omnia-mcp
```

Needs `OMNIA_API_KEY` (a workspace API key, `sk_…`, from **Settings → API keys**). Give the key only the scopes the agent should have — `read` for a monitoring agent, `read` + `evals:write` for one that runs evals — the platform enforces them and each tool's description says which scope it needs.

### Claude Code

```bash
claude mcp add errorbar -e OMNIA_API_KEY=sk_… -- npx -y @omnia-voice/mcp
```

### Claude Desktop / Cursor / any `mcpServers` config

```json
{
  "mcpServers": {
    "errorbar": {
      "command": "npx",
      "args": ["-y", "@omnia-voice/mcp"],
      "env": { "OMNIA_API_KEY": "sk_…" }
    }
  }
}
```

## Flags

| Flag | Effect |
| --- | --- |
| `--read-only` (or `OMNIA_MCP_READ_ONLY=1`) | expose only `GET` tools |
| `--no-spend` (or `OMNIA_MCP_NO_SPEND=1`) | hide tools that start billable work (eval runs, training, dedicated capacity, judge assists) |
| `--only list_evals,get_eval` | expose just these tools |
| `--base-url URL` (or `OMNIA_BASE_URL`) | API root, default `https://platform.omnia-voice.com/api` |

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
import { createServer, OmniaClient } from "@omnia-voice/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = createServer({ client: new OmniaClient({ apiKey: process.env.OMNIA_API_KEY! }), readOnly: true });
await server.connect(new StdioServerTransport());
```

## Development

```bash
npm ci && npm run typecheck && npm test && npm run build
```

`src/manifest.ts` is generated from the platform's `app/api/v1` routes; `test/manifest.test.ts` pins the exact route inventory it must cover, so a new platform route fails this suite until the manifest is regenerated.

## Release

Push a tag `vX.Y.Z` — the publish workflow builds, tests, and publishes to npm with provenance.

License: Apache-2.0
