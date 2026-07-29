export const Layer = {
  MODELS: "models",
  ERRORS: "errors",
  CONFIG: "config",
  SERVICES: "services",
  REPOSITORIES: "repositories",
  CONTROLLERS: "controllers",
  FACTORY: "factory",
  ROUTES: "routes",
  REMOTE: "remote",
  HOOKS: "hooks",
  STORES: "stores",
  CLIENT: "client",
  COMPONENTS: "components",
  UTILS: "utils",
  TESTS: "tests",
  UNKNOWN: "unknown",
} as const;

export type Layer = (typeof Layer)[keyof typeof Layer];

/**
 * Layers that carry no architectural intent of their own, and so are exempt
 * from every import rule.
 *
 * Test doubles must be free to implement a repository interface, and a
 * migration script under `scripts/` must be free to open a database. Both
 * would otherwise be reported for doing their job.
 */
export const UNRESTRICTED_LAYERS: ReadonlySet<Layer> = new Set<Layer>([
  Layer.TESTS,
  Layer.UNKNOWN,
]);

/**
 * Whether importing this module would pull server code into a client bundle.
 *
 * The *target* side of `server-layer-leak`. Note what is absent: `*.remote.ts`.
 * A remote function's body runs on the server, but SvelteKit generates a fetch
 * stub for it, so importing one from a component is the sanctioned pattern
 * rather than a leak. Use `isServerContext` for the importer side.
 */
export function isServerOnlyModule(path: string): boolean {
  const normalised = path.replace(/\\/g, "/");
  if (normalised.includes("src/lib/server/")) return true;
  const filename = normalised.split("/").pop() ?? "";
  // `+page.server.ts` / `+layout.server.ts` carry the dotted marker;
  // `+server.ts` — a SvelteKit API endpoint — does not, and is equally
  // server-only.
  return /\.server\.(ts|js)$/.test(filename) || /^\+server\.(ts|js)$/.test(filename);
}

/**
 * Whether this module runs only on the server, and may therefore import
 * server-only code.
 *
 * The *importer* side of `server-layer-leak`. Broader than
 * `isServerOnlyModule` by exactly one case: a `*.remote.ts` may reach into
 * `$lib/server` even though other modules may reach into it.
 *
 * A universal `+page.ts` fails this test even when a `+page.server.ts` sits
 * beside it — which is the distinction the rule exists to catch.
 */
export function isServerContext(path: string): boolean {
  if (isServerOnlyModule(path)) return true;
  const filename = path.replace(/\\/g, "/").split("/").pop() ?? "";
  return /\.remote\.(ts|js)$/.test(filename);
}

export function isPageSveltePath(path: string): boolean {
  return path.endsWith("+page.svelte");
}

export function isLayoutSveltePath(path: string): boolean {
  return path.endsWith("+layout.svelte");
}

export function isPageFile(path: string): boolean {
  return path.endsWith("+page.svelte") || path.endsWith("+page.server.ts");
}

export function isApiRoutePath(path: string): boolean {
  const normalised = path.replace(/\\/g, "/");
  return /[\\/]routes[\\/].*[\\/]api[\\/].*[\\/]server\.ts$/.test(path)
    || normalised.includes("/routes/api/");
}

export function isRouteWithStatus(path: string): boolean {
  const normalised = path.replace(/\\/g, "/");
  return normalised.includes("/routes/") && normalised.endsWith("+server.ts");
}

export function isLayoutLevelComponentPath(path: string): boolean {
  const normalised = path.replace(/\\/g, "/");
  return normalised.includes("/components/layout/")
    || /\+layout\.svelte$/.test(normalised)
    || /\+page\.svelte$/.test(normalised);
}

export function isLeafComponentPath(path: string): boolean {
  const normalised = path.replace(/\\/g, "/");
  if (!normalised.includes("/components/")) return false;
  if (normalised.includes("/components/layout/")) return false;
  const filename = normalised.split("/").pop() ?? "";
  return /icon|icon$|badge|chip|avatar|skeleton|spinner|dot|tooltip|pill/i.test(filename);
}