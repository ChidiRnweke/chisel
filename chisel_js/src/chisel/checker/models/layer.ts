export const Layer = {
  MODELS: "models",
  ERRORS: "errors",
  CONFIG: "config",
  SERVICES: "services",
  REPOSITORIES: "repositories",
  CONTROLLERS: "controllers",
  FACTORY: "factory",
  ROUTES: "routes",
  DEPENDENCIES: "dependencies",
  ERROR_HANDLERS: "error_handlers",
  APP_FILE: "app_file",
  UTILS: "utils",
  TESTS: "tests",
  UNKNOWN: "unknown",
} as const;

export type Layer = (typeof Layer)[keyof typeof Layer];

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