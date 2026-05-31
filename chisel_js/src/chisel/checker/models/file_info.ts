export interface FileInfo {
  readonly path: string;
  readonly layer: import("./layer").Layer;
  readonly language: "ts" | "js" | "svelte";
  readonly source: string;
}

export function createFileInfo(params: {
  path: string;
  layer: import("./layer").Layer;
  language: "ts" | "js" | "svelte";
  source?: string;
}): FileInfo {
  return Object.freeze({ ...params, source: params.source ?? "" });
}
