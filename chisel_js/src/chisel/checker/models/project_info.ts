import type { FileInfo } from "./file_info";

export interface ProjectInfo {
  readonly rootPath: string;
  readonly files: readonly FileInfo[];
  readonly packageName: string;
}

export function createProjectInfo(params: {
  rootPath: string;
  files?: FileInfo[];
  packageName?: string;
}): ProjectInfo {
  return Object.freeze({
    rootPath: params.rootPath,
    files: Object.freeze(params.files ?? []),
    packageName: params.packageName ?? "",
  });
}
