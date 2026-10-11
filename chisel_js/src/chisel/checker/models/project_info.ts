import type { FileInfo } from "./file_info";

/** A stylesheet under `src/`, read for the design-system rules. */
export interface Stylesheet {
  readonly path: string;
  readonly source: string;
}

export interface ProjectInfo {
  readonly rootPath: string;
  readonly files: readonly FileInfo[];
  /**
   * Stylesheets are not modules: no layer, no import rules. They are kept apart
   * from `files` so that only the rules written for CSS ever read them.
   */
  readonly stylesheets: readonly Stylesheet[];
  readonly packageName: string;
}

export function createProjectInfo(params: {
  rootPath: string;
  files?: FileInfo[];
  stylesheets?: readonly Stylesheet[];
  packageName?: string;
}): ProjectInfo {
  return Object.freeze({
    rootPath: params.rootPath,
    files: Object.freeze(params.files ?? []),
    stylesheets: Object.freeze([...(params.stylesheets ?? [])]),
    packageName: params.packageName ?? "",
  });
}
