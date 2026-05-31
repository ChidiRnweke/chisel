import type { FileInfo } from "chisel/checker/models/file_info";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import { Layer } from "chisel/checker/models/layer";
import { createFileInfo } from "chisel/checker/models/file_info";
import { createProjectInfo } from "chisel/checker/models/project_info";
import fastGlob from "fast-glob";

export class FileDiscovery {
  async discover(rootPath: string): Promise<ProjectInfo> {
    const patterns = ["**/*.ts", "**/*.svelte", "**/*.js"];
    const ignore = ["**/node_modules/**", "**/dist/**", "**/.svelte-kit/**"];
    
    const files: FileInfo[] = [];
    for (const pattern of patterns) {
      const entries = await fastGlob(pattern, { cwd: rootPath, ignore });
      for (const entry of entries) {
        const lang = entry.endsWith(".svelte") ? "svelte" as const
                    : entry.endsWith(".ts") ? "ts" as const
                    : "js" as const;
        files.push(createFileInfo({
          path: entry,
          layer: this._classifyFile(entry),
          language: lang,
        }));
      }
    }
    
    return createProjectInfo({
      rootPath,
      files,
      packageName: rootPath.split("/").pop() ?? "",
    });
  }

  private _classifyFile(path: string): Layer {
    if (path.startsWith("tests/")) return Layer.TESTS;
    if (path.includes("/models/")) return Layer.MODELS;
    if (path.endsWith("/errors.ts") || path.endsWith("/errors.js")) return Layer.ERRORS;
    if (path.endsWith("/config.ts") || path.endsWith("/config.js")) return Layer.CONFIG;
    if (path.includes("/services/")) return Layer.SERVICES;
    if (path.includes("/repositories/")) return Layer.REPOSITORIES;
    if (path.includes("/controllers/")) return Layer.CONTROLLERS;
    if (path.endsWith("/factory.ts") || path.endsWith("/factory.js")) return Layer.FACTORY;
    if (path.includes("/routes/")) return Layer.ROUTES;
    if (path.includes("/stores/")) return Layer.ROUTES; // same layer treatment
    if (path.includes("/hooks.")) return Layer.DEPENDENCIES;
    if (path.includes("/error_handlers")) return Layer.ERROR_HANDLERS;
    if (path.endsWith("/app.ts") || path.endsWith("/app.js")) return Layer.APP_FILE;
    return Layer.UNKNOWN;
  }
}
