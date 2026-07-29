import type { FileInfo } from "chisel/checker/models/file_info";
import type { Layer } from "chisel/checker/models/layer";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { FileParser } from "chisel/checker/repositories/file_parser";
import { Layer as LayerEnum } from "chisel/checker/models/layer";

const parser = new FileParser();

/**
 * Build a `FileInfo` the way `CheckController` does — source read, then parsed
 * once into `ast`. Rules that match nodes need that tree, so a test that
 * constructs `FileInfo` by hand would silently exercise nothing.
 */
export function parsedFile(params: {
  path: string;
  source: string;
  layer?: Layer;
  language?: "ts" | "js" | "svelte";
}): FileInfo {
  const language = params.language
    ?? (params.path.endsWith(".svelte") ? "svelte" : "ts");
  const base = createFileInfo({
    path: params.path,
    layer: params.layer ?? LayerEnum.UNKNOWN,
    language,
    source: params.source,
  });
  return createFileInfo({ ...base, ast: parser.parse(base) });
}

/** A single-file project, parsed. */
export function parsedProject(params: {
  path: string;
  source: string;
  layer?: Layer;
  language?: "ts" | "js" | "svelte";
  rootPath?: string;
}) {
  return createProjectInfo({
    rootPath: params.rootPath ?? "/test",
    files: [parsedFile(params)],
  });
}
