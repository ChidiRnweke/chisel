import type { CheckerMode } from "chisel/checker/models/mode";
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

/** Static and generated files carry no architectural intent. */
const SKIPPED_RE = [
  /^src\/lib\/assets\//,
  /\.d\.ts$/,
];

/**
 * Ordered layer matchers — **first match wins, so order is the specification**.
 *
 * Two orderings are load-bearing and must not be reshuffled:
 *  - `src/hooks.server.ts` is matched before any folder rule, so a
 *    `src/lib/hooks/` folder of reusable Svelte hooks cannot be mistaken for
 *    the framework `hooks` layer.
 *  - `*.remote.ts` is matched before folder rules, because `remote` is defined
 *    by a filename marker rather than by its directory.
 *
 * Substring matching is deliberately avoided throughout: the previous
 * implementation scanned path segments for a `dirLayerMap` key, which made
 * `lib/client/note-sync/indexeddb-note-sync-repository.ts` a `repositories`
 * module and `src/lib/stores/**` part of `routes`.
 */
const LAYER_MATCHERS: ReadonlyArray<readonly [RegExp, Layer]> = [
  [/^tests\//, LayerEnum.TESTS],
  [/\.spec\.(ts|js)$/, LayerEnum.TESTS],
  [/\.test\.(ts|js)$/, LayerEnum.TESTS],
  [/^src\/evals\//, LayerEnum.TESTS],
  // Fakes and fixtures shipped inside src/ so app code can import them in tests.
  [/^src\/lib\/testing\//, LayerEnum.TESTS],

  [/^src\/hooks\.(server\.)?(ts|js)$/, LayerEnum.HOOKS],
  [/\.remote\.(ts|js)$/, LayerEnum.REMOTE],

  [/^src\/routes\/.*\+.*\.server\.(ts|js)$/, LayerEnum.ROUTES],
  [/^src\/routes\/.*\+server\.(ts|js)$/, LayerEnum.ROUTES],
  [/^src\/routes\//, LayerEnum.COMPONENTS],

  // `$lib/server/<name>/` IS layer `<name>`. Nothing here is server-only by
  // convention — only by location, which SvelteKit itself enforces by refusing
  // to bundle this subtree for the client.
  //
  // There is deliberately no catch-all for `src/lib/server/**`. A folder that
  // is not a layer name gets no layer and is reported as
  // `structure:unknown-server-folder`; the previous catch-all silently
  // relabelled `server/domain/` (which holds services) as repositories.
  [/^src\/lib\/server\/(repositories|db)\//, LayerEnum.REPOSITORIES],
  [/^src\/lib\/server\/services\//, LayerEnum.SERVICES],
  [/^src\/lib\/server\/controllers\//, LayerEnum.CONTROLLERS],
  [/^src\/lib\/server\/config\.(ts|js)$/, LayerEnum.CONFIG],
  // Composition roots directly under $lib/server, in either naming convention:
  // app-factory.ts, production-factory.ts, factory.ts, ServerFactory.ts.
  [/^src\/lib\/server\/[^/]*[Ff]actory\.(ts|js)$/, LayerEnum.FACTORY],
  [/^src\/lib\/server\/application\.(ts|js)$/, LayerEnum.FACTORY],

  // The same layers at a universal path. They still classify to their layer so
  // the direction rules keep working, but `structure:layer-outside-server`
  // reports the placement: at these paths SvelteKit cannot stop a component
  // from importing them.
  [/^src\/lib\/repositories\//, LayerEnum.REPOSITORIES],
  [/^src\/lib\/services\//, LayerEnum.SERVICES],
  [/^src\/lib\/controllers\//, LayerEnum.CONTROLLERS],
  [/^src\/lib\/(factories|factory)\//, LayerEnum.FACTORY],
  [/^src\/lib\/config\.(ts|js)$/, LayerEnum.CONFIG],
  [/^src\/lib\/errors\.(ts|js)$/, LayerEnum.ERRORS],
  [/^src\/lib\/models\//, LayerEnum.MODELS],
  [/^src\/env\.(ts|js)$/, LayerEnum.CONFIG],
  [/^src\/lib\/stores\//, LayerEnum.STORES],
  [/^src\/lib\/components\//, LayerEnum.COMPONENTS],
  [/^src\/lib\/(client|hooks|commands)\//, LayerEnum.CLIENT],
  [/^src\/lib\/utils\.(ts|js)$/, LayerEnum.UTILS],
  [/^src\/lib\/utils\//, LayerEnum.UTILS],
  [/^src\/service-worker\.(ts|js)$/, LayerEnum.CLIENT],
];

/** BFF-only: the generated API client is configuration, not a service. */
const BFF_LAYER_MATCHERS: ReadonlyArray<readonly [RegExp, Layer]> = [
  [/^src\/lib\/api\//, LayerEnum.CONFIG],
];

export class FileDiscovery {
  async discover(
    rootPath: string,
    options: { mode?: CheckerMode; ignore?: readonly string[] } = {},
  ): Promise<ProjectInfo> {
    const mode = options.mode ?? "sveltekit-standalone";
    const files: FileInfo[] = [];
    const seen = new Set<string>();
    const entries = await fastGlob(PATTERNS, {
      cwd: rootPath,
      ignore: [...IGNORED_DIRS, ...(options.ignore ?? [])],
      onlyFiles: true,
      dot: false,
    });

    for (const rawEntry of entries) {
      const path = normalisePath(rawEntry);
      if (path === "") continue;
      if (seen.has(path)) continue;
      if (isIgnoredPath(path)) continue;
      if (SKIPPED_RE.some(re => re.test(path))) continue;

      const lang = path.endsWith(".svelte")
        ? "svelte" as const
        : path.endsWith(".ts")
          ? "ts" as const
          : "js" as const;

      const { layer, classified } = classifyFile(path, mode);
      files.push(createFileInfo({ path, layer, language: lang, classified }));
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

/**
 * Classify a repo-relative path into exactly one layer.
 *
 * `classified: false` marks a first-party `src/lib/**` module that matched no
 * canonical location. Such a file is *not* left in an `unknown` bucket exempt
 * from every boundary rule — it is classified conservatively (client-reachable
 * unless it sits under `$lib/server`) and reported as
 * `structure:unclassified-module`, so ad-hoc folders surface instead of
 * silently opting out of enforcement.
 */
export function classifyFile(
  path: string,
  mode: CheckerMode = "sveltekit-standalone",
): { layer: Layer; classified: boolean } {
  if (path === "") return { layer: LayerEnum.UNKNOWN, classified: true };

  const matchers = mode === "sveltekit-bff"
    ? [...BFF_LAYER_MATCHERS, ...LAYER_MATCHERS]
    : LAYER_MATCHERS;

  for (const [pattern, layer] of matchers) {
    if (pattern.test(path)) return { layer, classified: true };
  }

  // An unrecognised folder under $lib/server gets *no* layer. Guessing one is
  // what previously relabelled `server/domain/` (services) as repositories and
  // turned 28 service-to-service findings into nonsense about repositories.
  // `structure:unknown-server-folder` reports the placement instead; once the
  // code moves to a real layer its direction violations surface on their own.
  if (path.startsWith("src/lib/server/")) {
    return { layer: LayerEnum.UNKNOWN, classified: false };
  }

  // Elsewhere under src/lib/ the conservative reading is client-reachable.
  if (path.startsWith("src/lib/")) {
    return { layer: LayerEnum.CLIENT, classified: false };
  }

  return { layer: LayerEnum.UNKNOWN, classified: true };
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