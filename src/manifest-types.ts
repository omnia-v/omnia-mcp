/** One parameter of an operation — path, query, or body field. */
export interface Param {
  name: string;
  type: "string" | "integer" | "number" | "boolean" | "object" | "array";
  required?: boolean;
  description: string;
  enum?: readonly string[];
  default?: unknown;
  /** For arrays: the element type (objects allowed, described in `description`). */
  items?: "string" | "integer" | "number" | "boolean" | "object";
}

export type Scope = "read" | "evals:write" | "aliases:write" | "platform:write";

/** One public API operation, exposed as one MCP tool. */
export interface Operation {
  /** MCP tool name: snake_case verb_noun, unique. */
  name: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path relative to the API root, `{param}` placeholders for path params. */
  path: string;
  summary: string;
  /** API-key scope the platform requires for this call. */
  scope: Scope;
  pathParams?: Param[];
  query?: Param[];
  body?: Param[];
  responseSummary: string;
  notes?: string;
  /** True when the call spends wallet credit or starts billable compute. */
  spends?: boolean;
  /** True when the endpoint may return a non-JSON body (CSV/JSONL export). */
  raw?: boolean;
}
