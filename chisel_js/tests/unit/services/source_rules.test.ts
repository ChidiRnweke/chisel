import { describe, expect, it } from "bun:test";
import { SourceRulesService } from "chisel/checker/services/shared/source_rules";
import { SuppressionService } from "chisel/checker/services/shared/suppression";
import { classifyFile } from "chisel/checker/repositories/file_discovery";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { parsedFile } from "../../fakes/parsed_file";

/**
 * Ported case for case from FollowThrough's `scripts/audit-source-rules.spec.ts`,
 * the audit these rules replace. Each case runs the rules and the suppression
 * service together, so an allowance that excuses one rule and leaves another
 * standing is visible here exactly as it was there.
 */
const service = new SourceRulesService({
  icons: "$lib/components/icons",
  toolAdapters: [
    "src/lib/server/infrastructure/agents/sdk-tool.ts",
    "src/lib/server/factories/agent/tools/mcp.ts",
  ],
});
const known = [...service.describeRules(), ...new SuppressionService().describeRules()].map(
  rule => rule.id,
);

interface Finding {
  readonly rule: string;
  readonly line: number;
}

function analyzeSource(path: string, source: string): Finding[] {
  const file = parsedFile({ path, source, layer: classifyFile(path).layer });
  const project = createProjectInfo({ rootPath: "/app", files: [file] });
  return new SuppressionService()
    .check(service.check(project), new Map([[path, source]]), known)
    .map(violation => ({ rule: violation.ruleId, line: violation.line }));
}

const violations = (source: string) => analyzeSource("src/lib/example.ts", source);
/** A path inside one of the layers kept total. */
const strict = (source: string) =>
  analyzeSource("src/lib/server/services/notes/example.ts", source);
const model = (source: string) => analyzeSource("src/lib/models/notes/example.ts", source);

describe("source audit rules", () => {
  it("rejects an asserted object shape", () => {
    expect(violations("const value = ({ id: maybe }) as never")).toHaveLength(1);
  });
  it("rejects moving a whole local shape through never", () => {
    expect(violations("controller.save(input as never)")).toHaveLength(1);
  });
  it("allows a branded leaf property cast", () => {
    expect(violations("controller.get(input.noteId as never)")).toHaveLength(0);
  });
  it("rejects moving a call result through never", () => {
    expect(violations("controller.save(buildInput() as never)")).toHaveLength(1);
  });
  it("allows const assertions", () => {
    expect(violations("const value = { kind: 'ok' } as const")).toHaveLength(0);
  });
  it("rejects a swallowed synchronous failure", () => {
    expect(violations("try { work() } catch { return [] }")).toHaveLength(1);
  });
  it("rejects a swallowed Promise rejection", () => {
    expect(violations("void work().catch(() => undefined)")).toHaveLength(1);
  });
  it("allows propagation", () => {
    expect(violations("try { work() } catch (error) { throw error }")).toHaveLength(0);
  });
  it("allows explicit failure results", () => {
    expect(violations("try { work() } catch (error) { return { ok: false, error } }")).toHaveLength(
      0,
    );
  });
  it("allows a discriminated corrupt result", () => {
    expect(
      violations("try { work() } catch (error) { return { kind: 'corrupt', error } }"),
    ).toHaveLength(0);
  });
  it("rejects a plausible weaker string result", () => {
    expect(violations("try { work() } catch { return '[unserializable]' }")).toHaveLength(1);
  });
  it("rejects a bare false result", () => {
    expect(violations("try { work() } catch { return false }")).toHaveLength(1);
  });
  it("rejects logging as failure handling", () => {
    expect(violations("try { work() } catch (error) { logger.warn(error) }")).toHaveLength(1);
  });
  it("rejects renamed reporting variables and calls", () => {
    expect(
      violations(
        "try { await work() } catch (problem) { state.outcome = 'failed'; reportProblem(problem) }",
      ),
    ).toHaveLength(1);
  });
  it("does not count a nested callback throw as propagation", () => {
    expect(violations("try { work() } catch { queue(() => { throw new Error() }) }")).toHaveLength(
      1,
    );
  });
  it("requires a reason on allowances", () => {
    expect(violations("// chisel-ignore fail-loudly:silent-catch\ntry {} catch {}")).toHaveLength(
      2,
    );
  });
  it("rejects stale allowances", () => {
    expect(
      violations("// chisel-ignore fail-loudly:silent-catch -- terminal reporter\nwork()"),
    ).toHaveLength(1);
  });
  it("rejects an icon library import", () => {
    expect(violations("import Check from '@lucide/svelte/icons/check'")).toHaveLength(1);
  });
  it("allows the in-house icon set", () => {
    expect(violations("import * as Icon from '$lib/components/icons'")).toHaveLength(0);
  });
  it("rejects instanceof in models", () => {
    expect(analyzeSource("src/lib/models/example.ts", "value instanceof Error")).toHaveLength(1);
  });
  it("allows instanceof outside models", () => {
    expect(analyzeSource("src/lib/client/example.ts", "value instanceof Error")).toHaveLength(0);
  });
  it("reports source lines inside a Svelte script block", () => {
    expect(
      analyzeSource(
        "src/lib/components/example.svelte",
        '<div></div>\n<script lang="ts">\nconst value = ({ id }) as never\n</script>\n',
      )[0]?.line,
    ).toBe(3);
  });
  // Two rules, because it is two defects: the result is unparsed *and* the
  // shape it claims is inline. Excusing one must leave the other reported, the
  // way the weak-record-guard and record-unknown pair do below.
  it("rejects a concrete cast on response JSON", () => {
    expect(violations("const body = (await response.json()) as { ok: boolean }")).toHaveLength(2);
  });
  it("leaves the inline shape reported when only the response cast is excused", () => {
    expect(
      violations(
        "// chisel-ignore narrowing:no-response-json-cast -- Framework supplies runtime validation.\nconst body = (await response.json()) as { ok: boolean }",
      ),
    ).toHaveLength(1);
  });
  it("allows an honest unknown response JSON intermediate", () => {
    expect(violations("const body = (await response.json()) as unknown")).toHaveLength(0);
  });
  it("allows a reasoned response JSON framework exception", () => {
    expect(
      violations(
        "// chisel-ignore narrowing:no-response-json-cast -- Framework supplies runtime validation.\nconst body = (await response.json()) as Payload",
      ),
    ).toHaveLength(0);
  });
  it("rejects a Zod unknown schema", () => {
    expect(violations("import { z } from 'zod';\nconst payload = z.unknown()")).toHaveLength(1);
  });
  it("rejects an aliased Zod any schema", () => {
    expect(
      violations("import { z as schema } from 'zod';\nconst payload = schema.any()"),
    ).toHaveLength(1);
  });
  it("rejects a namespace-imported Zod unknown schema", () => {
    expect(
      violations("import * as schema from 'zod';\nconst payload = schema.unknown()"),
    ).toHaveLength(1);
  });
  it("allows a concrete Zod JSON schema", () => {
    expect(violations("import { z } from 'zod';\nconst payload = z.json()")).toHaveLength(0);
  });
  it("allows a reasoned Zod SDK exception", () => {
    expect(
      violations(
        "import { z } from 'zod';\n// chisel-ignore narrowing:no-zod-unknown -- SDK callback owns runtime validation.\nconst payload = z.unknown()",
      ),
    ).toHaveLength(0);
  });
  it("rejects a stale Zod allowance", () => {
    expect(
      violations(
        "import { z } from 'zod';\n// chisel-ignore narrowing:no-zod-unknown -- SDK callback owns runtime validation.\nconst payload = z.string()",
      ),
    ).toHaveLength(1);
  });
  it("rejects a boolean guard that narrows to an open-keyed record", () => {
    expect(
      violations(
        'const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object"',
      ),
    ).toHaveLength(2);
  });
  it("rejects the same guard under a different name", () => {
    expect(
      violations(
        'const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object"',
      ),
    ).toHaveLength(2);
  });
  it("rejects a guard narrowing to an inline index signature", () => {
    expect(
      violations("function isBag(value: unknown): value is { [key: string]: any } { return true }"),
    ).toHaveLength(2);
  });
  it("allows a guard that narrows to a concrete type", () => {
    expect(
      violations(
        "const isAgentPayloadObject = (value: AgentPayload): value is AgentPayloadObject => true",
      ),
    ).toHaveLength(0);
  });
  it("allows a guard narrowing without a weak record in scope", () => {
    expect(violations("const bag: Record<string, string> = {}")).toHaveLength(0);
  });
  it("leaves the target record reported when only the guard is excused", () => {
    expect(
      violations(
        "// chisel-ignore narrowing:no-weak-record-guard -- Tiptap options are typed as any by the library.\nconst isRecord = (value: unknown): value is Record<string, unknown> => true",
      ),
    ).toHaveLength(1);
  });
  it("rejects a stale weak-record-guard allowance", () => {
    expect(
      violations(
        "// chisel-ignore narrowing:no-weak-record-guard -- Tiptap options are typed as any by the library.\nconst isNote = (value: unknown): value is Note => true",
      ),
    ).toHaveLength(1);
  });
  it("rejects an open-keyed record of unknown", () => {
    expect(violations("const bag: Record<string, unknown> = {}")).toHaveLength(1);
  });
  it("rejects the same record wrapped in Readonly", () => {
    expect(violations("const bag: Readonly<Record<string, unknown>> = {}")).toHaveLength(1);
  });
  it("rejects a bare open index signature of unknown", () => {
    expect(violations("const bag: { [key: string]: unknown } = {}")).toHaveLength(1);
  });
  it("rejects a Readonly-wrapped inline index signature", () => {
    expect(violations("const bag: Readonly<{ [key: string]: any }> = {}")).toHaveLength(1);
  });
  it("rejects a weak record as a generic argument", () => {
    expect(violations("const component: Component<Record<string, unknown>> = frame")).toHaveLength(
      1,
    );
  });
  it("allows a concrete-value map", () => {
    expect(violations("const headers: Record<string, string> = {}")).toHaveLength(0);
  });
  it("allows a named open-keyed payload type", () => {
    expect(violations("const args: AgentPayloadObject = {}")).toHaveLength(0);
  });
  it("allows a hardened alias used in place of the raw record", () => {
    expect(
      violations(
        "// chisel-ignore narrowing:no-record-unknown -- Svelte mounts arbitrary components as open prop records by design.\ntype RendererProps = Record<string, unknown>;\nconst frame: RendererProps = {}",
      ),
    ).toHaveLength(0);
  });
  it("rejects a stale record-unknown allowance", () => {
    expect(
      violations(
        "// chisel-ignore narrowing:no-record-unknown -- Svelte mounts arbitrary components as open prop records by design.\nconst headers: Record<string, string> = {}",
      ),
    ).toHaveLength(1);
  });
  it("rejects a concrete cast on a JSON.parse result", () => {
    expect(violations("const record = JSON.parse(raw) as NoteSyncRecord")).toHaveLength(1);
  });
  it("rejects an annotated declaration over a JSON.parse result", () => {
    expect(violations("const journal: MigrationJournal = JSON.parse(raw)")).toHaveLength(1);
  });
  it("rejects an annotated return of a JSON.parse result", () => {
    expect(violations("const read = (raw: string): JSONContent => JSON.parse(raw)")).toHaveLength(
      1,
    );
  });
  it("rejects a JSON.parse result returned from an annotated block body", () => {
    expect(
      violations("function read(raw: string): JSONContent { return JSON.parse(raw) }"),
    ).toHaveLength(1);
  });
  it("allows a JSON.parse result returned from a function declaring unknown", () => {
    expect(
      violations("function read(raw: string): unknown { return JSON.parse(raw) }"),
    ).toHaveLength(0);
  });
  it("allows an honest unknown JSON.parse cast", () => {
    expect(violations("const value = JSON.parse(raw) as unknown")).toHaveLength(0);
  });
  it("allows an honest unknown JSON.parse annotation", () => {
    expect(violations("const parsed: unknown = JSON.parse(raw)")).toHaveLength(0);
  });
  it("allows a JSON.parse result handed straight to a schema", () => {
    expect(violations("const note = noteSchema.parse(JSON.parse(raw))")).toHaveLength(0);
  });
  it("allows a JSON.parse result assigned to a separately declared unknown", () => {
    expect(violations("let parsed: unknown;\nparsed = JSON.parse(raw)")).toHaveLength(0);
  });
  it("allows a reasoned JSON.parse framework exception", () => {
    expect(
      violations(
        "// chisel-ignore narrowing:no-json-parse-cast -- structuredClone throws on the Svelte $state proxy this strips.\nconst record = JSON.parse(JSON.stringify(input)) as NoteSyncRecord",
      ),
    ).toHaveLength(0);
  });
  it("rejects a stale JSON.parse allowance", () => {
    expect(
      violations(
        "// chisel-ignore narrowing:no-json-parse-cast -- structuredClone throws on the Svelte $state proxy this strips.\nconst parsed: unknown = JSON.parse(raw)",
      ),
    ).toHaveLength(1);
  });
  it("rejects a cast onto an inline object type", () => {
    expect(violations("const status = (error as { status?: number }).status")).toHaveLength(1);
  });
  it("rejects an inline object type hidden in a union", () => {
    expect(
      violations("const count = (storage as { words: number } | undefined)?.words"),
    ).toHaveLength(1);
  });
  it("reports a probe of an optional unknown field once", () => {
    expect(violations("const status = (error as { status?: unknown }).status")).toHaveLength(1);
  });
  it("allows a cast onto a mapped type", () => {
    expect(violations("const patch = base as { [P in K]?: V }")).toHaveLength(0);
  });
  it("allows an empty accumulator seeded with an array of object types", () => {
    expect(violations("const found = [] as { pos: number }[]")).toHaveLength(0);
  });
  it("leaves an asserted object literal to shape-cast alone", () => {
    expect(violations("const value = { id } as { id: NoteId }")).toHaveLength(1);
  });
  it("allows a reasoned cast-probe framework exception", () => {
    expect(
      violations(
        "// chisel-ignore narrowing:no-cast-probe -- Tiptap types extension.options as any.\nconst options = extension.options as { onCancel?: () => void }",
      ),
    ).toHaveLength(0);
  });
  it("rejects a stale cast-probe allowance", () => {
    expect(
      violations(
        "// chisel-ignore narrowing:no-cast-probe -- Tiptap types extension.options as any.\nconst options = extension.options as EditorOptions",
      ),
    ).toHaveLength(1);
  });
  it("rejects an unknown parameter in a strict layer", () => {
    expect(strict("export const read = (value: unknown): Note => parse(value)")).toHaveLength(1);
  });
  it("rejects an unknown return type in a strict layer", () => {
    expect(strict("export const load = (id: NoteId): unknown => fetch(id)")).toHaveLength(1);
  });
  it("rejects an unknown field on an interface", () => {
    expect(strict("export interface OcrResponse { readonly detail?: unknown }")).toHaveLength(1);
  });
  it("rejects an unknown type alias", () => {
    expect(strict("type Handle = unknown")).toHaveLength(1);
  });
  it("rejects unknown as a generic argument on a return type", () => {
    expect(strict("const get = (id: NoteId): Promise<unknown> => read(id)")).toHaveLength(1);
  });
  it("rejects a readonly unknown array field", () => {
    expect(strict("interface Node { readonly content?: readonly unknown[] }")).toHaveLength(1);
  });
  it("allows the same signature outside the strict layers", () => {
    expect(
      analyzeSource("src/lib/client/example.ts", "const load = (id: NoteId): unknown => fetch(id)"),
    ).toHaveLength(0);
  });
  it("allows an honest local unknown intermediate in a strict layer", () => {
    expect(strict("const parsed: unknown = JSON.parse(raw)")).toHaveLength(0);
  });
  it("allows an unknown cast target in a strict layer", () => {
    expect(
      strict("const method = descriptor.value as (...args: unknown[]) => unknown"),
    ).toHaveLength(0);
  });
  it("allows a reasoned parser-input exception", () => {
    expect(
      strict(
        "// chisel-ignore narrowing:no-unknown-type -- Model-local parser input; ADR 0037 names this a parse zone.\nexport const read = (value: unknown): Note => parse(value)",
      ),
    ).toHaveLength(0);
  });
  it("rejects a stale unknown-type allowance", () => {
    expect(
      strict(
        "// chisel-ignore narrowing:no-unknown-type -- Model-local parser input; ADR 0037 names this a parse zone.\nexport const read = (value: NoteJson): Note => parse(value)",
      ),
    ).toHaveLength(1);
  });
});

describe("tool lifecycle ownership", () => {
  it.each([
    "import { tool } from '@openai/agents';",
    "import { tool as makeTool } from '@openai/agents';",
    "import * as sdk from '@openai/agents';",
    "export { tool as makeTool } from '@openai/agents';",
    "export * from '@openai/agents';",
    "import { McpServer as Server } from '@modelcontextprotocol/sdk/server/mcp.js';",
    "import { Server } from '@modelcontextprotocol/sdk/server/index.js';",
  ])("rejects a construction bypass: %s", source => {
    expect(
      analyzeSource("src/lib/server/factories/other.ts", source).map(item => item.rule),
    ).toEqual(["agent:tool-boundary"]);
  });
  it("allows SDK construction in its designated adapter", () => {
    expect(
      analyzeSource(
        "src/lib/server/infrastructure/agents/sdk-tool.ts",
        "import { tool } from '@openai/agents';",
      ),
    ).toEqual([]);
  });
  it("allows MCP construction in its designated adapter", () => {
    expect(
      analyzeSource(
        "src/lib/server/factories/agent/tools/mcp.ts",
        "import { Server } from '@modelcontextprotocol/sdk/server/index.js';",
      ),
    ).toEqual([]);
  });
  it("allows SDK type imports elsewhere", () => {
    expect(
      analyzeSource(
        "src/lib/server/factories/other.ts",
        "import type { Tool } from '@openai/agents';",
      ),
    ).toEqual([]);
  });
  it("rejects SDK construction in the diagram service, which builds through sdkTool", () => {
    expect(
      analyzeSource(
        "src/lib/server/services/diagrams/generation.ts",
        "import { tool } from '@openai/agents';",
      ).map(item => item.rule),
    ).toEqual(["agent:tool-boundary"]);
  });
});

describe("data-only models", () => {
  it("allows a value constructor with empty collections and nested data", () => {
    expect(
      model(
        "export const history = (text: string) => ({ past: [], present: { text, references: [] }, future: [] })",
      ),
    ).toEqual([]);
  });

  it.each([
    "export const total = (prices: number[]) => prices.reduce((sum, price) => sum + price, 0)",
    "export function lookup(value: string) { return table.get(value); }",
    "export const parseValue = (value: string) => schema.parse(value)",
    "const query = (value: string) => value.length > 0",
    "export const computed = (id: string) => ({ id: id.trim() })",
    "export const computed = (id: string) => ({ values: [id.trim()] })",
  ])("rejects model procedure: %s", source => {
    expect(model(source).map(item => item.rule)).toEqual(["models:procedure"]);
  });
  it("allows a scalar constructor with a local validity guard", () => {
    expect(
      model(
        "type Version = string & { readonly __brand: 'Version' }; export const version = (value: bigint): Version => { if (value <= 0n) throw new Error('positive required'); return `v-${value}` as Version; }",
      ),
    ).toEqual([]);
  });
  it("rejects a branded constructor that consults mutable external state", () => {
    expect(
      model(
        "type Id = string & { readonly __brand: 'Id' }; const create = (value: string): Id => registry.get(value) as Id",
      ).map(item => item.rule),
    ).toEqual(["models:procedure"]);
  });
  it.each([
    "const id = (value: string = registry.next()): Id => value as Id",
    'const id = (value: string): Id => (value += "suffix") as Id',
    "const id = (value: string): Id => { let saved = value; return saved as Id; }",
  ])("rejects side effects or mutable state in a scalar constructor: %s", source => {
    expect(
      model("type Id = string & { readonly __brand: 'Id' }; " + source).map(item => item.rule),
    ).toEqual(["models:procedure"]);
  });
  it("rejects an unbranded calculation", () => {
    expect(
      model("const total = (value: number): number => value * 2").map(item => item.rule),
    ).toEqual(["models:procedure"]);
  });
  it.each(["let encoder: Encoder;", "export class Workflow {}"])(
    "rejects model runtime state: %s",
    source => {
      expect(model(source).map(item => item.rule)).toEqual(["models:state"]);
    },
  );
  it.each([
    "export const schema = z.string().transform(value => value.trim())",
    "const arraySchema = <T>(item: z.ZodType<T>) => z.array(item)",
    "function schema<T>(item: z.ZodType<T>) { return z.object({ item }); }",
    "const create = (id: string) => ({ kind: 'record', id })",
    "interface Record { readonly id: string }",
  ])("allows schema construction and data: %s", source => {
    expect(model(source)).toEqual([]);
  });
});

describe("shared strict layers", () => {
  it.each(["src/lib/services/notes/edits.ts", "src/lib/controllers/notes/editing.ts"])(
    "rejects unknown inputs in %s",
    file => {
      expect(
        analyzeSource(file, "export interface Editing { edit(input: unknown): void }").map(
          violation => violation.rule,
        ),
      ).toEqual(["narrowing:no-unknown-type"]);
    },
  );
});
