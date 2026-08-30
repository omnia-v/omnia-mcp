/**
 * Thin HTTP client for the errorbar platform API. It does not interpret
 * responses — the API's own status and body are what the tool returns, so an
 * agent sees exactly the error a curl would.
 */
export interface ClientOptions {
  apiKey: string;
  /** API root, default https://gateway.errorbar.ai */
  baseUrl?: string;
  fetch?: typeof fetch;
  userAgent?: string;
}

export interface ApiResponse {
  status: number;
  ok: boolean;
  contentType: string;
  /** Parsed JSON when the response is JSON; otherwise undefined. */
  json?: unknown;
  /** Raw text when the response is not JSON (CSV/JSONL exports, HTML errors). */
  text?: string;
}

export const DEFAULT_BASE_URL = "https://gateway.errorbar.ai";

export class OmniaClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly userAgent: string;

  constructor(opts: ClientOptions) {
    if (!opts.apiKey) throw new Error("apiKey is required");
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.userAgent = opts.userAgent ?? "errorbar-mcp";
  }

  /** Builds the absolute URL: path with `{param}` filled, plus a query string. */
  buildUrl(
    path: string,
    pathParams: Record<string, unknown> = {},
    query: Record<string, unknown> = {},
  ): string {
    const filled = path.replace(/\{(\w+)\}/g, (_, k: string) => {
      const v = pathParams[k];
      if (v === undefined || v === null || v === "") throw new Error(`missing path parameter: ${k}`);
      return encodeURIComponent(String(v));
    });
    const url = new URL(this.baseUrl + filled);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) for (const item of v) url.searchParams.append(k, String(item));
      else url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
    return url.toString();
  }

  async request(input: {
    method: string;
    path: string;
    pathParams?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
  }): Promise<ApiResponse> {
    const url = this.buildUrl(input.path, input.pathParams, input.query);
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.apiKey}`,
      // No text/plain: some routes (setup/status) switch to a shell-oriented flat
      // format when they see it; the model wants the JSON the docs describe.
      accept: "application/json, text/csv, application/x-ndjson, */*;q=0.8",
      "user-agent": this.userAgent,
    };
    let body: string | undefined;
    if (input.body !== undefined && input.method !== "GET") {
      headers["content-type"] = "application/json";
      body = JSON.stringify(input.body);
    }
    const res = await this.fetchImpl(url, { method: input.method, headers, body });
    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();
    if (contentType.includes("json") || (text.startsWith("{") || text.startsWith("["))) {
      try {
        return { status: res.status, ok: res.ok, contentType, json: JSON.parse(text) };
      } catch {
        /* fall through to text */
      }
    }
    return { status: res.status, ok: res.ok, contentType, text };
  }
}
