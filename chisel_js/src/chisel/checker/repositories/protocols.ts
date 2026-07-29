import type { ImportEdge } from "chisel/checker/models/import_edge";
import type { ProjectInfo } from "chisel/checker/models/project_info";

/**
 * The import graph as the boundary rules see it. Mirrors
 * `chisel_py/.../repositories/protocols.py::IImportGraph`, so services can be
 * tested against a fake rather than a real project tree.
 */
export interface IImportGraph {
  build(project: ProjectInfo): void;
  readonly allImports: readonly ImportEdge[];
  readonly unresolved: readonly ImportEdge[];
  readonly warnings: readonly string[];
}
