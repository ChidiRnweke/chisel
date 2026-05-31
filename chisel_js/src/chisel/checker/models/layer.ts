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
