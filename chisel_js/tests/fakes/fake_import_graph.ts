import type { IImportGraph } from "chisel/checker/repositories/protocols";
import type { ImportEdge } from "chisel/checker/models/import_edge";
import { createImportEdge } from "chisel/checker/models/import_edge";

/**
 * Hand-fed import graph for service tests, mirroring
 * `chisel_py/tests/fakes/fake_import_graph.py`. Lets a boundary rule be tested
 * on an exact edge set without a project tree on disk.
 */
export class FakeImportGraph implements IImportGraph {
  private _edges: ImportEdge[] = [];
  readonly warnings: readonly string[] = [];

  build(): void {
    // Edges are supplied directly by the test.
  }

  get allImports(): readonly ImportEdge[] {
    return this._edges;
  }

  get unresolved(): readonly ImportEdge[] {
    return this._edges.filter(e => !e.resolved);
  }

  setEdges(edges: ImportEdge[]): void {
    this._edges = edges;
  }
}

/** Build an edge with the fields a test cares about; the rest get sane defaults. */
export function edge(params: {
  importer: string;
  imported: string;
  specifier?: string;
  isInternal?: boolean;
  resolved?: boolean;
  isTypeOnly?: boolean;
  lineNumber?: number;
  lineContents?: string;
}): ImportEdge {
  return createImportEdge({
    importer: params.importer,
    imported: params.imported,
    specifier: params.specifier ?? params.imported,
    isInternal: params.isInternal ?? params.imported.startsWith("src/"),
    resolved: params.resolved ?? true,
    isTypeOnly: params.isTypeOnly ?? false,
    lineNumber: params.lineNumber ?? 1,
    lineContents: params.lineContents ?? `import { x } from "${params.specifier ?? params.imported}";`,
  });
}
