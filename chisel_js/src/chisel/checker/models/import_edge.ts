/**
 * One import statement, resolved.
 *
 * Unlike the Python sibling — whose `ImportEdge` carries dotted module names
 * and whose boundary service reconstructs a file path from them, dropping the
 * `src/` prefix and making its own violations unmatchable by both the
 * suppression service and the exceptions registry — `importer` and `imported`
 * are real repo-relative paths. Violations built from an edge are therefore
 * addressable by exactly the same string the rest of the checker uses.
 */
export interface ImportEdge {
  /** Repo-relative path of the file containing the import statement. */
  readonly importer: string;
  /**
   * Repo-relative path when the specifier resolves inside the project;
   * otherwise the bare specifier as written (`"drizzle-orm"`, `"$app/server"`).
   */
  readonly imported: string;
  /** The specifier exactly as written: `"$lib/server/db"`, `"./utils"`. */
  readonly specifier: string;
  /** True when `imported` is a path inside the project. */
  readonly isInternal: boolean;
  /**
   * False when a project-local specifier (relative, or `$lib`-aliased) pointed
   * at nothing on disk. Surfaced as `import-graph:unresolved-import`.
   */
  readonly resolved: boolean;
  /**
   * True for `import type` / `export type` and for named specifiers marked
   * `type`. Such an import is erased at build time, so it cannot leak server
   * code into a client bundle — but it is still layer coupling. The boundary
   * matrix counts it; `server-layer-leak` does not.
   */
  readonly isTypeOnly: boolean;
  /** 1-indexed line of the import statement in `importer`. */
  readonly lineNumber: number;
  /** The trimmed source line, for the violation message. */
  readonly lineContents: string;
}

export function createImportEdge(params: {
  importer: string;
  imported: string;
  specifier: string;
  isInternal: boolean;
  resolved: boolean;
  isTypeOnly: boolean;
  lineNumber: number;
  lineContents: string;
}): ImportEdge {
  return Object.freeze({ ...params });
}
