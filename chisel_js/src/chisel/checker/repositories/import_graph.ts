import type { FileInfo, ParsedSource } from "chisel/checker/models/file_info";
import type { ImportEdge } from "chisel/checker/models/import_edge";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import { createImportEdge } from "chisel/checker/models/import_edge";
import { ImportGraphError } from "chisel/checker/errors";
import { FileParser, scriptsOf } from "chisel/checker/repositories/file_parser";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";

/**
 * SvelteKit virtual modules. They resolve to nothing on disk, are always
 * external, and several of them carry their own placement rules (`$app/server`
 * and the private `$env/*` entry points are server-only), so they must survive
 * into the edge list rather than being dropped as unresolved.
 */
const VIRTUAL_PREFIXES = ["$app/", "$env/", "$service-worker"];

/**
 * SvelteKit's generated per-route types, imported as `./$types`. They look
 * relative but are generated into `.svelte-kit/types/`, so probing the route
 * directory for them always fails.
 */
const GENERATED_TYPES_RE = /(^|\/)\$types(\.js)?$/;

/**
 * Fallback alias table used when the project's `paths` could not be read.
 *
 * SvelteKit writes `$lib` into the *generated* `.svelte-kit/tsconfig.json`,
 * which the app's own tsconfig extends. On a fresh clone — or in CI before
 * `svelte-kit sync` has run — that file does not exist, `extends` resolution
 * fails, and every `$lib` import would otherwise be reported as unresolved.
 */
const FALLBACK_PATHS: Record<string, string[]> = {
  "$lib": ["src/lib"],
  "$lib/*": ["src/lib/*"],
};

/** Probe order for a specifier that names no extension. */
const EXTENSIONS = [".ts", ".js", ".svelte", ".svelte.ts", ".svelte.js", ".d.ts"];
const INDEX_FILES = ["index.ts", "index.js"];

/**
 * TypeScript's ESM convention: source written as `./foo.js` compiles from
 * `./foo.ts`. Projects using `rewriteRelativeImportExtensions` (or NodeNext)
 * write every relative import this way, so a resolver that only tries the
 * literal extension reports every one of them as unresolved.
 */
const OUTPUT_TO_SOURCE_EXT: ReadonlyArray<readonly [RegExp, readonly string[]]> = [
  // `.svelte.js` -> `.svelte.ts` falls out of this: only the final extension is
  // replaced, so the `.svelte` part of the stem is preserved.
  [/\.js$/, [".ts", ".tsx"]],
  [/\.jsx$/, [".tsx"]],
  [/\.mjs$/, [".mts"]],
  [/\.cjs$/, [".cts"]],
];

export class ImportGraph {
  private readonly parser = new FileParser();
  private _edges: ImportEdge[] = [];
  private _built = false;
  private _warnings: string[] = [];

  /**
   * Parse every discovered file and resolve its imports.
   *
   * Deliberately does **not** create a `ts.Program`: we need no type
   * information, and a Program over an app of any size loads `lib.d.ts` plus
   * every `@types` package in `node_modules` to answer a question we are not
   * asking. `ts.createSourceFile` per file is the whole requirement.
   */
  build(project: ProjectInfo): void {
    try {
      // No warning when the fallback alias table is used: a project with no
      // `$lib` in its tsconfig is usually just a project that does not use
      // `$lib`, and warning on every such run is noise. A `$lib` import that
      // genuinely fails to resolve is reported precisely, per import, as
      // `import-boundary:unresolved-import` — which carries the same hint.
      const aliases = loadAliases(project.rootPath);
      const known = new Set(project.files.map(f => f.path));
      const edges: ImportEdge[] = [];

      for (const file of project.files) {
        if (file.source === "") continue;
        // Parsed once by the controller; the graph reads that tree rather than
        // parsing the file a second time.
        const parsed = file.ast ?? this.parser.parse(file);
        for (const edge of this._edgesForFile(file, parsed, project.rootPath, aliases.paths, known)) {
          edges.push(edge);
        }
      }

      this._edges = edges;
      this._built = true;
    } catch (exc) {
      throw new ImportGraphError(
        `Failed to build import graph for '${project.rootPath}': ${String(exc)}`,
      );
    }
  }

  get allImports(): readonly ImportEdge[] {
    return this._built ? this._edges : [];
  }

  get warnings(): readonly string[] {
    return this._warnings;
  }

  /** Edges whose specifier looked project-local but resolved to nothing. */
  get unresolved(): readonly ImportEdge[] {
    return this.allImports.filter(e => !e.resolved);
  }

  private _edgesForFile(
    file: FileInfo,
    parsed: ParsedSource | undefined,
    rootPath: string,
    paths: Record<string, string[]>,
    known: ReadonlySet<string>,
  ): ImportEdge[] {
    const lineStarts = computeLineStarts(file.source);
    const sourceLines = file.source.split("\n");
    const edges: ImportEdge[] = [];

    for (const { sf, offset } of scriptsOf(parsed)) {
      for (const found of collectSpecifiers(sf)) {
        const lineNumber = lineAt(lineStarts, offset + found.position);
        const target = resolveSpecifier(found.specifier, file.path, rootPath, paths, known);

        edges.push(createImportEdge({
          importer: file.path,
          imported: target.imported,
          specifier: found.specifier,
          isInternal: target.isInternal,
          resolved: target.resolved,
          isTypeOnly: found.isTypeOnly,
          lineNumber,
          lineContents: (sourceLines[lineNumber - 1] ?? "").trim(),
        }));
      }
    }

    return edges;
  }
}

interface FoundSpecifier {
  specifier: string;
  position: number;
  isTypeOnly: boolean;
}

function collectSpecifiers(sf: ts.SourceFile): FoundSpecifier[] {
  const found: FoundSpecifier[] = [];

  const record = (node: ts.Expression | undefined, isTypeOnly: boolean): void => {
    if (node !== undefined && ts.isStringLiteral(node)) {
      found.push({ specifier: node.text, position: node.getStart(sf), isTypeOnly });
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) {
      record(node.moduleSpecifier, isImportTypeOnly(node));
    } else if (ts.isExportDeclaration(node)) {
      record(node.moduleSpecifier, node.isTypeOnly);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      record(node.moduleReference.expression, false);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
      if (isDynamicImport || isRequire) record(node.arguments[0], false);
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sf, visit);
  return found;
}

/**
 * True when nothing the statement imports survives to runtime — either
 * `import type { ... }`, or a clause in which every named binding is
 * individually marked `type`. A bare side-effect import is never type-only.
 */
function isImportTypeOnly(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (clause === undefined) return false;
  if (clause.isTypeOnly) return true;

  const bindings = clause.namedBindings;
  if (bindings !== undefined && ts.isNamedImports(bindings)) {
    return bindings.elements.length > 0 && bindings.elements.every(e => e.isTypeOnly);
  }
  return false;
}

interface ResolvedTarget {
  imported: string;
  isInternal: boolean;
  resolved: boolean;
}

function resolveSpecifier(
  specifier: string,
  importer: string,
  rootPath: string,
  paths: Record<string, string[]>,
  known: ReadonlySet<string>,
): ResolvedTarget {
  // SvelteKit virtual modules: external by definition, and legitimately so.
  if (VIRTUAL_PREFIXES.some(p => specifier === p || specifier.startsWith(p))) {
    return { imported: specifier, isInternal: false, resolved: true };
  }
  if (GENERATED_TYPES_RE.test(specifier)) {
    return { imported: specifier, isInternal: false, resolved: true };
  }

  const candidates = candidatePaths(specifier, importer, paths);

  // A bare package specifier. Whether it is installed is npm's problem, not an
  // architectural one — the boundary rules care only about which package it is.
  if (candidates.length === 0) {
    return { imported: specifier, isInternal: false, resolved: true };
  }

  for (const candidate of candidates) {
    const hit = probe(candidate, rootPath, known);
    if (hit !== undefined) return { imported: hit, isInternal: true, resolved: true };
  }

  // Looked project-local but points at nothing on disk.
  return { imported: specifier, isInternal: true, resolved: false };
}

/** Repo-relative, extensionless candidate targets for a project-local specifier. */
function candidatePaths(
  specifier: string,
  importer: string,
  paths: Record<string, string[]>,
): string[] {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return [normalise(join(dirname(importer), specifier))];
  }

  const out: string[] = [];
  for (const [pattern, targets] of Object.entries(paths)) {
    const star = pattern.indexOf("*");
    if (star === -1) {
      if (specifier === pattern) out.push(...targets.map(normalise));
      continue;
    }
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (specifier.startsWith(prefix) && specifier.endsWith(suffix)) {
      const middle = specifier.slice(prefix.length, specifier.length - suffix.length);
      out.push(...targets.map(t => normalise(t.replace("*", middle))));
    }
  }
  return out;
}

/** Try a candidate as-is, with each known extension, and as a directory index. */
function probe(candidate: string, rootPath: string, known: ReadonlySet<string>): string | undefined {
  const attempts = [
    candidate,
    ...sourceEquivalents(candidate),
    ...EXTENSIONS.map(ext => candidate + ext),
    ...INDEX_FILES.map(index => `${candidate}/${index}`),
  ];

  for (const attempt of attempts) {
    if (known.has(attempt)) return attempt;
  }
  // A target outside the discovered set (an asset, a .json, a file in an
  // ignored directory) still counts as resolved — it exists, it is just not
  // something the layer rules have an opinion about.
  for (const attempt of attempts) {
    if (existsSync(resolve(rootPath, attempt))) return attempt;
  }
  return undefined;
}

/**
 * Rewrite an output-extension specifier to the source files it could compile
 * from: `./foo.js` -> `./foo.ts`, `./ctx.svelte.js` -> `./ctx.svelte.ts`.
 */
function sourceEquivalents(candidate: string): string[] {
  for (const [pattern, replacements] of OUTPUT_TO_SOURCE_EXT) {
    if (!pattern.test(candidate)) continue;
    const stem = candidate.replace(pattern, "");
    return replacements.map(ext => stem + ext);
  }
  return [];
}

function loadAliases(rootPath: string): { paths: Record<string, string[]>; usedFallback: boolean } {
  const configPath = ts.findConfigFile(rootPath, ts.sys.fileExists, "tsconfig.json");
  if (configPath === undefined) return { paths: FALLBACK_PATHS, usedFallback: true };

  const read = ts.readConfigFile(configPath, p => {
    try {
      return readFileSync(p, "utf-8");
    } catch {
      return undefined;
    }
  });
  if (read.error !== undefined || read.config === undefined) {
    return { paths: FALLBACK_PATHS, usedFallback: true };
  }

  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath));
  const options = parsed.options;
  const declared = options.paths;
  if (declared === undefined || Object.keys(declared).length === 0) {
    return { paths: FALLBACK_PATHS, usedFallback: true };
  }

  // `paths` are relative to `baseUrl`; re-express them relative to the project
  // root so candidates can be compared against discovered file paths directly.
  const base = options.baseUrl ?? dirname(configPath);
  const rebased: Record<string, string[]> = {};
  for (const [pattern, targets] of Object.entries(declared)) {
    rebased[pattern] = targets.map(t => normalise(relative(rootPath, resolve(base, t))));
  }

  // SvelteKit projects that never ran `svelte-kit sync` parse fine but carry no
  // $lib mapping; fill it in rather than reporting every $lib import unresolved.
  const hasLib = Object.keys(rebased).some(p => p === "$lib" || p.startsWith("$lib/"));
  if (!hasLib) return { paths: { ...FALLBACK_PATHS, ...rebased }, usedFallback: true };

  return { paths: rebased, usedFallback: false };
}

function normalise(path: string): string {
  let p = path.replace(/\\/g, "/");
  while (p.startsWith("./")) p = p.slice(2);
  while (p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

function computeLineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

/** 1-indexed line containing `offset`, by binary search over line starts. */
function lineAt(lineStarts: readonly number[], offset: number): number {
  let low = 0;
  let high = lineStarts.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (lineStarts[mid]! <= offset) low = mid;
    else high = mid - 1;
  }
  return low + 1;
}
