import type { FileInfo, ParsedSource } from "chisel/checker/models/file_info";
import { parse } from "svelte/compiler";
import ts from "typescript";

/**
 * Parses each discovered file exactly once.
 *
 * Mirrors `chisel_py`, where `CheckController` calls `ast.parse(source)` and
 * stores the tree on `FileInfo.ast_tree` for every rule to consume. Before this
 * existed, `structural.ts`, `component_enforcement.ts` and `import_graph.ts`
 * each parsed the same `.svelte` file independently, and most other rules gave
 * up and matched raw text.
 *
 * A file that fails to parse yields a failure rather than throwing: one
 * unparseable component must not cost the whole run. The controller reports
 * each failure as `checker:unparseable-file`, because a rule that silently skips
 * a file is a rule that silently passes it. A `.svelte` file whose markup does
 * not compile still yields its scripts — the import graph must not lose the
 * file's imports to a markup typo — and is reported as `partial`.
 */
export type ParseOutcome =
  | { readonly kind: "parsed"; readonly ast: ParsedSource }
  | { readonly kind: "partial"; readonly ast: ParsedSource; readonly reason: string }
  | { readonly kind: "failure"; readonly reason: string };

export class FileParser {
  parse(file: FileInfo): ParseOutcome {
    try {
      return file.path.endsWith(".svelte")
        ? parseSvelte(file.path, file.source)
        : { kind: "parsed", ast: parseScript(file.path, file.source) };
    } catch (exc) {
      return { kind: "failure", reason: String(exc) };
    }
  }
}

/** The tree an outcome carries, when it carries one. */
export function astOf(outcome: ParseOutcome): ParsedSource | undefined {
  return outcome.kind === "failure" ? undefined : outcome.ast;
}

function parseScript(path: string, source: string): ParsedSource {
  return Object.freeze({
    script: ts.createSourceFile(path, source, ts.ScriptTarget.ESNext, true),
    module: undefined,
    fragment: undefined,
    instance: undefined,
    hasStyleBlock: false,
    offsets: Object.freeze({ script: 0, module: 0 }),
  });
}

function parseSvelte(path: string, source: string): ParseOutcome {
  const blocks = extractScripts(source);
  const instanceBlock = blocks.find(b => !b.isModule);
  const moduleBlock = blocks.find(b => b.isModule);

  // The markup AST is a bonus: if svelte/compiler cannot parse the component we
  // still return the scripts, because TypeScript parses them independently and
  // the import graph must not lose a file to a markup syntax error.
  const markup = parseMarkup(path, source);
  const ast: ParsedSource = Object.freeze({
    script: instanceBlock === undefined
      ? undefined
      : ts.createSourceFile(`${path}.ts`, instanceBlock.text, ts.ScriptTarget.ESNext, true),
    module: moduleBlock === undefined
      ? undefined
      : ts.createSourceFile(`${path}.module.ts`, moduleBlock.text, ts.ScriptTarget.ESNext, true),
    fragment: markup.kind === "parsed" ? markup.root.fragment : undefined,
    instance: markup.kind === "parsed" ? markup.root.instance : undefined,
    hasStyleBlock: markup.kind === "parsed" && markup.root.css !== null,
    offsets: Object.freeze({
      script: instanceBlock?.offset ?? 0,
      module: moduleBlock?.offset ?? 0,
    }),
  });
  return markup.kind === "parsed"
    ? { kind: "parsed", ast }
    : { kind: "partial", ast, reason: markup.reason };
}

type MarkupOutcome =
  | { readonly kind: "parsed"; readonly root: ReturnType<typeof parse> }
  | { readonly kind: "failure"; readonly reason: string };

function parseMarkup(path: string, source: string): MarkupOutcome {
  try {
    return { kind: "parsed", root: parse(source, { modern: true, filename: path }) };
  } catch (exc) {
    return { kind: "failure", reason: String(exc) };
  }
}

interface ScriptBlock {
  text: string;
  offset: number;
  isModule: boolean;
}

/**
 * Locate `<script>` blocks by regex rather than through `svelte/compiler`.
 *
 * The parser would be more precise, but it throws on any malformed component,
 * and losing a file's imports to a markup typo is worse than the rare chance of
 * matching a `<script>` written inside a string. The contents are handed to
 * TypeScript, which parses `lang="ts"` correctly.
 */
export function extractScripts(source: string): ScriptBlock[] {
  const blocks: ScriptBlock[] = [];
  const re = /<script([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match: RegExpExecArray | null;

  while ((match = re.exec(source)) !== null) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    blocks.push({
      text: body,
      offset: match.index + match[0].indexOf(body),
      // `<script module>` in Svelte 5; `context="module"` in the Svelte 4 form.
      isModule: /\bmodule\b/.test(attrs) || /context\s*=\s*["']module["']/.test(attrs),
    });
  }

  return blocks;
}

/** Every parsed script in a file, with the offset needed to map back to it. */
export function scriptsOf(ast: ParsedSource | undefined): { sf: ts.SourceFile; offset: number }[] {
  if (ast === undefined) return [];
  const out: { sf: ts.SourceFile; offset: number }[] = [];
  if (ast.script !== undefined) out.push({ sf: ast.script, offset: ast.offsets.script });
  if (ast.module !== undefined) out.push({ sf: ast.module, offset: ast.offsets.module });
  return out;
}

/**
 * Visit every node in a Svelte template.
 *
 * Walks the object graph generically rather than following named child
 * properties. The modern AST reaches children through a different key for
 * almost every construct — `fragment.nodes` on an element, `body` on an each
 * block, `consequent`/`alternate` on an if block — and enumerating them means
 * silently missing elements nested inside whichever construct was overlooked.
 */
export function walkMarkup(root: any, fn: (node: any) => void): void {
  const seen = new Set<any>();

  const visit = (value: any): void => {
    if (value === null || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }

    if (typeof value.type === "string") fn(value);
    for (const key of Object.keys(value)) {
      if (key === "parent") continue;
      visit(value[key]);
    }
  };

  visit(root);
}
