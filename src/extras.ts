import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Resources and prompts — the setup path, identical in every client.
 *
 * The canonical instruction set lives at www.errorbar.ai/agent-setup.md (the
 * hero button, the "From your editor" section and the errorbar-setup skill all
 * point at it). Exposing it as a resource means an MCP client can read the
 * same text without a shell, and the prompts hand the model the same steps
 * the file carries. Fetched at read time so an installed server never rots.
 */

export interface ExtrasOptions {
  siteUrl?: string;
  fetch?: typeof fetch;
}

export const AFTER_TRAFFIC_FLOWS = `Do these in order, each only once the previous one has something to work on.

1. Run get_setup_status. If request logging is OFF, ask the user to turn it on (errorbar → Settings → Workspace → Request logging) — without it only structure is kept and there is nothing to grade. Do not try to change it yourself.
2. Once real traffic has been logged, run screen_my_traffic. Report each candidate's verdict (verified-better / tied-but-cheaper / inconclusive / worse / unmeasured) WITH its win-rate interval, and the recommendation. Never recommend on a point estimate; "keep" is a full answer.
3. Create one judge with create_criterion: ONE binary pass/fail question about the single quality property that matters most in this codebase. Not a rubric, not a score.
4. When about 30 real exchanges are graded (the user's job, in the dashboard — tell them when the queue is ready), run run_criterion_alignment, then is_my_judge_trustworthy. Report catches-failures and passes-clean with their intervals, whether the judge is trustworthy — and if not, exactly how many more grades of which class it needs.
5. Before any model, prompt or tool change ships, run can_i_ship on the run that measured it and report every check's required vs actual (the interval's lower bound).

Do not report any rate without the interval around it.`;

export function registerExtras(server: McpServer, o: ExtrasOptions = {}): void {
  const site = (o.siteUrl ?? "https://www.errorbar.ai").replace(/\/+$/, "");
  const fetchImpl = o.fetch ?? globalThis.fetch;

  async function fetchText(path: string): Promise<string> {
    try {
      const res = await fetchImpl(`${site}${path}`, { headers: { accept: "text/plain, text/markdown" } });
      if (!res.ok) return `Could not fetch ${site}${path}: HTTP ${res.status}. The same text is served there for a person to read.`;
      return await res.text();
    } catch (e) {
      return `Could not fetch ${site}${path}: ${(e as Error).message}.`;
    }
  }

  server.registerResource(
    "agent-setup",
    "errorbar://agent-setup.md",
    {
      title: "errorbar setup instructions for a coding agent",
      description:
        "The canonical instruction set: pick ONE integration path (gateway, your own provider key, OpenTelemetry, tracing SDK), verify with the setup check, then the after-traffic-flows steps. Same file as https://www.errorbar.ai/agent-setup.md.",
      mimeType: "text/markdown",
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: await fetchText("/agent-setup.md") }] }),
  );

  server.registerResource(
    "llms-txt",
    "errorbar://llms.txt",
    {
      title: "What errorbar is, for an assistant",
      description: "The product described for a model: what it does in the order it runs, the doctrine for reporting numbers, how to connect, where the API is. Same as https://www.errorbar.ai/llms.txt.",
      mimeType: "text/plain",
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/plain", text: await fetchText("/llms.txt") }] }),
  );

  server.registerResource(
    "after-traffic-flows",
    "errorbar://after-traffic-flows",
    {
      title: "After traffic flows — the first five steps, with the tools that do them",
      description: "Logging → screening → one judge → calibrate at ~30 grades → gate before shipping. Each step names the MCP tool that performs it.",
      mimeType: "text/markdown",
    },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: AFTER_TRAFFIC_FLOWS }] }),
  );

  server.registerPrompt(
    "set-up-errorbar",
    {
      title: "Set up errorbar in this repository",
      description: "Fetches the canonical setup instructions and follows them: one integration path, verified with a receipt, then the after-traffic-flows steps.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Read the resource errorbar://agent-setup.md (or fetch ${site}/agent-setup.md) and follow it in this working directory, all sections: pick ONE integration path, verify with the setup check, do the "after traffic flows" steps (the errorbar MCP tools get_setup_status, screen_my_traffic, create_criterion, run_criterion_alignment, is_my_judge_trustworthy and can_i_ship perform them), then report. Ask me only for the API key if ERRORBAR_API_KEY is not already in the environment, and never print it.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "after-traffic-flows",
    {
      title: "After traffic flows: screening, first judge, calibration, gate",
      description: "The five steps once traffic is being captured, each with the tool that performs it.",
    },
    () => ({ messages: [{ role: "user", content: { type: "text", text: AFTER_TRAFFIC_FLOWS } }] }),
  );

  server.registerPrompt(
    "release-check",
    {
      title: "Can this change ship?",
      description: "Gate a finished eval run on the interval and report ship/hold with every check.",
      argsSchema: {
        eval_id: z.string().optional().describe("The run to gate; omit for the newest finished run."),
      },
    },
    ({ eval_id }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Run can_i_ship${eval_id ? ` with eval_id "${eval_id}"` : " on the newest finished run"}. Report ship or hold, and for every check: what was required, the actual value (the interval's lower bound), and whether it passed. If it did not pass, say which single change would most likely make it pass (more samples, a calibrated judge, a smaller margin is NOT one of them). Do not report a rate without its interval.`,
          },
        },
      ],
    }),
  );
}
