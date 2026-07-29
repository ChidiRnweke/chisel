import { describe, test, expect } from "bun:test";
import { RouteStyleService } from "chisel/checker/services/svelte/route_style";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { Layer } from "chisel/checker/models/layer";

function flagged(path: string, source = "export const GET = () => json({ ok: true });"): boolean {
  const file = createFileInfo({ path, layer: Layer.ROUTES, language: "ts", source });
  const violations = new RouteStyleService()
    .check(createProjectInfo({ rootPath: "/app", files: [file] }));
  return violations.some(v => v.ruleId === "route-style:prefer-remote-function");
}

describe("route-style: prefer remote functions", () => {
  test("a JSON endpoint serving the app's own UI is flagged", () => {
    expect(flagged("src/routes/api/notes/+server.ts")).toBe(true);
  });

  test("the message points at $lib/remote and offers the suppression", () => {
    const file = createFileInfo({
      path: "src/routes/api/notes/+server.ts",
      layer: Layer.ROUTES,
      language: "ts",
      source: "export const GET = () => json({ ok: true });",
    });
    const message = new RouteStyleService()
      .check(createProjectInfo({ rootPath: "/app", files: [file] }))[0]!.message;
    expect({
      suggestsRemote: message.includes("$lib/remote"),
      offersSuppression: message.includes("chisel-ignore route-style:prefer-remote-function"),
    }).toEqual({ suggestsRemote: true, offersSuppression: true });
  });

  test("it is a warning, not a build-blocking error", () => {
    // The heuristics are good, not conclusive. Blocking a build on a guess is
    // worse than asking a question.
    const file = createFileInfo({
      path: "src/routes/api/notes/+server.ts",
      layer: Layer.ROUTES,
      language: "ts",
      source: "export const GET = () => json({});",
    });
    expect(new RouteStyleService()
      .check(createProjectInfo({ rootPath: "/app", files: [file] }))[0]!.severity)
      .toBe("warning");
  });
});

describe("route-style: genuine HTTP surfaces are exempt", () => {
  test("OAuth callbacks — the identity provider chose the URL", () => {
    expect({
      callback: flagged("src/routes/auth/callback/+server.ts"),
      login: flagged("src/routes/auth/login/+server.ts"),
      logout: flagged("src/routes/auth/logout/+server.ts"),
    }).toEqual({ callback: false, login: false, logout: false });
  });

  test("a protocol endpoint", () => {
    expect(flagged("src/routes/mcp/+server.ts")).toBe(false);
  });

  test("webhooks and well-known paths", () => {
    expect({
      webhook: flagged("src/routes/webhooks/stripe/+server.ts"),
      wellKnown: flagged("src/routes/.well-known/ai-plugin/+server.ts"),
    }).toEqual({ webhook: false, wellKnown: false });
  });

  test("an SSE stream — a remote function cannot stream", () => {
    expect(flagged(
      "src/routes/api/agent/runs/[id]/events/+server.ts",
      'export const GET = () => new Response(stream, { headers: { "content-type": "text/event-stream" } });',
    )).toBe(false);
  });

  test("a file download — a remote function cannot return a body", () => {
    expect(flagged(
      "src/routes/api/attachments/[id]/content/+server.ts",
      'export const GET = () => new Response(bytes, { headers: { "Content-Disposition": "attachment" } });',
    )).toBe(false);
  });

  test("a redirect", () => {
    expect(flagged(
      "src/routes/api/short/[code]/+server.ts",
      "export const GET = () => redirect(302, target);",
    )).toBe(false);
  });
});

describe("route-style: scope", () => {
  test("page loaders and remote functions are not API routes", () => {
    expect({
      loader: flagged("src/routes/notes/+page.server.ts"),
      remote: flagged("src/lib/remote/notes.remote.ts"),
      page: flagged("src/routes/notes/+page.svelte"),
    }).toEqual({ loader: false, remote: false, page: false });
  });
});
