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
 * A file that fails to parse yields `undefined` rather than throwing: one
 * unparseable component must not cost the whole run. Rules that need an AST
 * skip such a file, exactly as the Python side does.
 */
export class FileParser {
  parse(file: FileInfo): ParsedSource | undefined {
    if (file.source === "") return undefined;
    try {
      return file.path.endsWith(".svelte")
        ? parseSvelte(file.path, file.source)
        : parseScript(file.path, file.source);
    } catch {
      return undefined;
    }
  }
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

function parseSvelte(path: string, source: string): ParsedSource {
  const blocks = extractScripts(source);
  const instanceBlock = blocks.find(b => !b.isModule);
  const moduleBlock = blocks.find(b => b.isModule);

  // The markup AST is a bonus: if svelte/compiler cannot parse the component we
  // still return the scripts, because TypeScript parses them independently and
  // the import graph must not lose a file to a markup syntax error.
  let fragment: unknown;
  let instance: unknown;
  let hasStyleBlock = false;
  try {
    const ast = parse(source, { modern: true, filename: path }) as {
      fragment?: unknown;
      instance?: unknown;
      css?: unknown;
    };
    fragment = ast.fragment;
    instance = ast.instance;
    hasStyleBlock = ast.css !== null && ast.css !== undefined;
  } catch {
    fragment = undefined;
    instance = undefined;
  }

  return Object.freeze({
    script: instanceBlock === undefined
      ? undefined
      : ts.createSourceFile(`${path}.ts`, instanceBlock.text, ts.ScriptTarget.ESNext, true),
    module: moduleBlock === undefined
      ? undefined
      : ts.createSourceFile(`${path}.module.ts`, moduleBlock.text, ts.ScriptTarget.ESNext, true),
    fragment,
    instance,
    hasStyleBlock,
    offsets: Object.freeze({
      script: instanceBlock?.offset ?? 0,
      module: moduleBlock?.offset ?? 0,
    }),
  });
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
