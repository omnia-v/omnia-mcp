import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z, type ZodTypeAny } from "zod";
import type { Operation, Param } from "./manifest-types.js";
import { OPERATIONS } from "./manifest.js";
import { OmniaClient } from "./client.js";

export interface ServerOptions {
  client: OmniaClient;
  /** Expose only GET operations. */
  readOnly?: boolean;
  /** Hide operations that spend money (eval runs, training, dedicated capacity). */
  noSpend?: boolean;
  /** Restrict to these tool names (after the filters above). */
  only?: string[];
  /** Max characters of a response body returned to the model (default 60k). */
  maxChars?: number;
  version?: string;
}

function zodFor(p: Param): ZodTypeAny {
  let t: ZodTypeAny;
  switch (p.type) {
    case "string":
      t = p.enum ? z.enum(p.enum as [string, ...string[]]) : z.string();
      break;
    case "integer":
      t = z.number().int();
      break;
    case "number":
      t = z.number();
      break;
    case "boolean":
      t = z.boolean();
      break;
    case "object":
      t = z.record(z.string(), z.unknown());
      break;
    case "array": {
      const item =
        p.items === "integer" ? z.number().int()
        : p.items === "number" ? z.number()
        : p.items === "boolean" ? z.boolean()
        : p.items === "object" ? z.record(z.string(), z.unknown())
        : z.string();
      t = z.array(item);
      break;
    }
  }
  t = t.describe(p.description + (p.default !== undefined ? ` Default: ${JSON.stringify(p.default)}.` : ""));
  return p.required ? t : t.optional();
}

/** The MCP input schema for one operation: path + query + body fields, flat. */
export function inputShapeFor(op: Operation): Record<string, ZodTypeAny> {
  const shape: Record<string, ZodTypeAny> = {};
  const add = (p: Param, kind: string) => {
    if (shape[p.name]) throw new Error(`${op.name}: duplicate parameter name ${p.name} (${kind})`);
    shape[p.name] = zodFor(p);
  };
  for (const p of op.pathParams ?? []) add({ ...p, required: true }, "path");
  for (const p of op.query ?? []) add(p, "query");
  for (const p of op.body ?? []) add(p, "body");
  return shape;
}

export function descriptionFor(op: Operation): string {
  const parts = [op.summary];
  parts.push(`${op.method} ${op.path} (API-key scope: ${op.scope}).`);
  if (op.spends) parts.push("SPENDS MONEY: this starts billable work on the workspace wallet.");
  parts.push(`Returns: ${op.responseSummary}`);
  if (op.notes) parts.push(`Notes: ${op.notes}`);
  return parts.join(" ");
}

export function selectOperations(opts: Pick<ServerOptions, "readOnly" | "noSpend" | "only">): readonly Operation[] {
  let ops: readonly Operation[] = OPERATIONS;
  if (opts.readOnly) ops = ops.filter((o) => o.method === "GET");
  if (opts.noSpend) ops = ops.filter((o) => !o.spends);
  if (opts.only?.length) {
    const want = new Set(opts.only);
    ops = ops.filter((o) => want.has(o.name));
  }
  return ops;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max) + `\n… [truncated ${s.length - max} characters; narrow the query or use a cursor]`;
}

export function createServer(opts: ServerOptions): McpServer {
  const server = new McpServer({ name: "errorbar", version: opts.version ?? "0.0.0" });
  const maxChars = opts.maxChars ?? 60_000;
  for (const op of selectOperations(opts)) {
    const pathNames = new Set((op.pathParams ?? []).map((p) => p.name));
    const queryNames = new Set((op.query ?? []).map((p) => p.name));
    const bodyNames = new Set((op.body ?? []).map((p) => p.name));
    server.registerTool(
      op.name,
      {
        title: op.name.replace(/_/g, " "),
        description: descriptionFor(op),
        inputSchema: inputShapeFor(op),
        annotations: {
          readOnlyHint: op.method === "GET",
          destructiveHint: op.method === "DELETE",
          idempotentHint: op.method === "GET" || op.method === "PUT" || op.method === "DELETE",
          openWorldHint: true,
        },
      },
      async (args: Record<string, unknown>) => {
        const pathParams: Record<string, unknown> = {};
        const query: Record<string, unknown> = {};
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(args ?? {})) {
          if (v === undefined) continue;
          if (pathNames.has(k)) pathParams[k] = v;
          else if (queryNames.has(k)) query[k] = v;
          else if (bodyNames.has(k)) body[k] = v;
        }
        let res;
        try {
          res = await opts.client.request({
            method: op.method,
            path: op.path,
            pathParams,
            query,
            body: bodyNames.size > 0 ? body : undefined,
          });
        } catch (e) {
          return { isError: true, content: [{ type: "text" as const, text: `request failed: ${(e as Error).message}` }] };
        }
        let text = res.json !== undefined ? JSON.stringify(res.json, null, 2) : (res.text ?? "");
        if (res.json === undefined && res.contentType.includes("text/html")) {
          // An HTML body is never an API answer — it is the platform's 404/500 page
          // (route not deployed, wrong base URL). Say that instead of dumping markup.
          const title = /<title>([^<]*)<\/title>/i.exec(text)?.[1]?.trim();
          text = `HTML page instead of an API response${title ? ` ("${title}")` : ""} — the route is not available at this base URL (check ERRORBAR_BASE_URL or whether this API version is deployed).`;
        }
        const headline = res.ok ? "" : `HTTP ${res.status} from ${op.method} ${op.path}\n`;
        return {
          isError: !res.ok,
          content: [{ type: "text" as const, text: headline + truncate(text, maxChars) }],
        };
      },
    );
  }
  return server;
}
