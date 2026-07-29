/**
 * A file's parsed form, produced once by `FileParser` and shared by every rule.
 *
 * The analogue of `FileInfo.ast_tree` in `chisel_py`, which the Python
 * controller fills in with `ast.parse(source)` before any rule runs.
 */
export interface ParsedSource {
  /** `.ts`/`.js`: the module. `.svelte`: the instance `<script>`. */
  readonly script?: import("typescript").SourceFile;
  /** `.svelte` only: the `<script module>` block. */
  readonly module?: import("typescript").SourceFile;
  /** `.svelte` only: the markup AST (`ast.fragment` from svelte/compiler). */
  readonly fragment?: unknown;
  /**
   * `.svelte` only: svelte's own `ast.instance` Script node. Its `content` is
   * an ESTree tree, which the `$effect`/`$derived` rules walk with
   * estree-walker — a different shape from the TypeScript `script` above, and
   * kept because those rules already work against it.
   */
  readonly instance?: unknown;
  /** `.svelte` only: whether the component carries a `<style>` block. */
  readonly hasStyleBlock: boolean;
  /** Where each script starts in the original file, for mapping lines back. */
  readonly offsets: { readonly script: number; readonly module: number };
}

export interface FileInfo {
  readonly path: string;
  readonly layer: import("./layer").Layer;
  readonly language: "ts" | "js" | "svelte";
  readonly source: string;
  /**
   * False when the file matched no canonical layer location and was assigned
   * one conservatively. Drives `structure:unclassified-module`.
   */
  readonly classified: boolean;
  /** Undefined when the file could not be parsed; AST rules then skip it. */
  readonly ast?: ParsedSource;
}

export function createFileInfo(params: {
  path: string;
  layer: import("./layer").Layer;
  language: "ts" | "js" | "svelte";
  source?: string;
  classified?: boolean;
  ast?: ParsedSource;
}): FileInfo {
  return Object.freeze({
    ...params,
    source: params.source ?? "",
    classified: params.classified ?? true,
  });
}
