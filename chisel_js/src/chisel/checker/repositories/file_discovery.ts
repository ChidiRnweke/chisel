import type { FileInfo } from "chisel/checker/models/file_info";
import type { Layer } from "chisel/checker/models/layer";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import { Layer as LayerEnum } from "chisel/checker/models/layer";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import fastGlob from "fast-glob";

const PATTERNS = ["**/*.ts", "**/*.svelte", "**/*.js"];

const IGNORED_DIRS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.svelte-kit/**",
  "**/build/**",
  "**/coverage/**",
  "**/.vercel/**",
  "**/.netlify/**",
  "**/.output/**",
  "**/.git/**",
  "**/.cache/**",
  "**/.turbo/**",
  "**/.parcel-cache/**",
  "**/__pycache__/**",
];

const IGNORED_PREFIX_PARTS = new Set([".", "node_modules", "dist", "build", "coverage", ".svelte-kit"]);

const FACTORY_FILENAME_RE = /(^|[\\/])(?:[A-Z]\w*)?Factory\.(?:ts|js)$/;
const FACTORY_DIR_RE = /[\\/]factories[\\/]/;

export class FileDiscovery {
  async discover(rootPath: string): Promise<ProjectInfo> {
    const files: FileInfo[] = [];
    const seen = new Set<string>();
    const entries = await fastGlob(PATTERNS, {
      cwd: rootPath,
      ignore: IGNORED_DIRS,
      onlyFiles: true,
      dot: false,
    });

    for (const rawEntry of entries) {
      const path = normalisePath(rawEntry);
      if (path === "") continue;
      if (seen.has(path)) continue;
      if (isIgnoredPath(path)) continue;

      const lang = path.endsWith(".svelte")
        ? "svelte" as const
        : path.endsWith(".ts")
          ? "ts" as const
          : "js" as const;

      files.push(createFileInfo({
        path,
        layer: classifyFile(path),
        language: lang,
      }));
      seen.add(path);
    }

    files.sort(comparePaths);

    return createProjectInfo({
      rootPath,
      files,
      packageName: derivePackageName(rootPath),
    });
  }
}

function normalisePath(raw: string): string {
  let p = raw.replace(/\\/g, "/");
  while (p.startsWith("./")) p = p.slice(2);
  while (p.startsWith("/")) p = p.slice(1);
  while (p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

function isIgnoredPath(path: string): boolean {
  const parts = path.split("/");
  for (const part of parts) {
    if (part === "") continue;
    if (IGNORED_PREFIX_PARTS.has(part)) return true;
    if (part.startsWith(".venv") || part === "venv" || part === "__pycache__") return true;
  }
  return false;
}

function classifyFile(path: string): Layer {
  const parts = path.split("/").filter(p => p.length > 0);
  const filename = parts[parts.length - 1] ?? "";

  if (filename === "") return LayerEnum.UNKNOWN;

  if (parts[0] === "tests" || path.startsWith("tests/")) return LayerEnum.TESTS;

  if (FACTORY_FILENAME_RE.test(path) || FACTORY_DIR_RE.test(path)) {
    return LayerEnum.FACTORY;
  }

  const filenameLayerMap: Record<string, Layer> = {
    "errors.ts": LayerEnum.ERRORS,
    "errors.js": LayerEnum.ERRORS,
    "config.ts": LayerEnum.CONFIG,
    "config.js": LayerEnum.CONFIG,
    "factory.ts": LayerEnum.FACTORY,
    "factory.js": LayerEnum.FACTORY,
    "app.ts": LayerEnum.APP_FILE,
    "app.js": LayerEnum.APP_FILE,
  };
  const byFilename = filenameLayerMap[filename];
  if (byFilename !== undefined) return byFilename;

  const dirLayerMap: Record<string, Layer> = {
    models: LayerEnum.MODELS,
    services: LayerEnum.SERVICES,
    repositories: LayerEnum.REPOSITORIES,
    controllers: LayerEnum.CONTROLLERS,
    routes: LayerEnum.ROUTES,
    stores: LayerEnum.ROUTES,
    dependencies: LayerEnum.DEPENDENCIES,
    error_handlers: LayerEnum.ERROR_HANDLERS,
    utils: LayerEnum.UTILS,
  };

  for (const part of parts.slice(0, -1)) {
    const layer = dirLayerMap[part];
    if (layer !== undefined) return layer;
  }

  if (filename.startsWith("hooks.server.")) return LayerEnum.DEPENDENCIES;

  return LayerEnum.UNKNOWN;
}

function derivePackageName(rootPath: string): string {
  const parts = rootPath.replace(/\\/g, "/").split("/").filter(p => p.length > 0);
  return parts[parts.length - 1] ?? "";
}

function comparePaths(a: FileInfo, b: FileInfo): number {
  if (a.path < b.path) return -1;
  if (a.path > b.path) return 1;
  return 0;
}