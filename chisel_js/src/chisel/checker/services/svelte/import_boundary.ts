import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";

export class ImportBoundaryService {
  readonly ruleIdPrefix = "import-boundary";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.source) continue;
      violations.push(...this._checkFile(file));
    }
    return violations;
  }

  private _checkFile(file: { path: string; source: string; layer: string }) {
    const violations: Violation[] = [];
    const imports = this._extractImports(file.source);
    const inSvelte = file.path.endsWith(".svelte");
    const isPageServer = file.path.endsWith("+page.server.ts");
    const isHookServer = file.path.endsWith("hooks.server.ts");
    const inStores = file.path.includes("stores/");
    const inServices = file.path.includes("services/") && !file.path.includes("tests/");
    const inControllers = file.path.includes("controllers/") && !file.path.includes("tests/");

    for (const imp of imports) {
      // Services can't import other services, $app/stores, or stores/
      if (inServices && !file.path.includes("protocols")) {
        if (imp.includes("services/") || imp.includes("@sveltejs/kit") || imp.includes("stores/")) {
          violations.push(this._v(file, imp, "service-banned-import"));
        }
      }
      // Controllers can't import @sveltejs/kit, other controllers, or call raw fetch globally
      if (inControllers) {
        if (imp.includes("@sveltejs/kit") || imp.includes("controllers/")) {
          violations.push(this._v(file, imp, "controller-banned-import"));
        }
      }
      // Stores can't import services, controllers, @sveltejs/kit/server, fetch
      if (inStores) {
        if (imp.includes("services/") || imp.includes("controllers/") || imp.includes("@sveltejs/kit")) {
          violations.push(this._v(file, imp, "stores-banned-import"));
        }
      }
      // +page.svelte can't import services, controllers, fetch
      if (inSvelte) {
        if (imp.includes("services/") || imp.includes("controllers/") || imp.includes("fetch")) {
          violations.push(this._v(file, imp, "page-banned-import"));
        }
      }
      // +page.server.ts can't import business logic, global fetch
      if (isPageServer) {
        if (/^fetch$/.test(imp)) {
          violations.push(this._v(file, imp, "loader-banned-import"));
        }
      }
      // hooks.server.ts can only use AppFactory + auth
      if (isHookServer) {
        if (imp.includes("services/") || (imp.includes("controllers/") && !imp.includes("auth"))) {
          violations.push(this._v(file, imp, "hooks-banned-import"));
        }
      }
    }
    violations.push(...this._checkCreateApiClient(file));
    violations.push(...this._checkConcreteServiceImport(file));
    violations.push(...this._checkAppFactoryImport(file));
    return violations;
  }

  private _checkCreateApiClient(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (file.path.includes("factories/") || file.path.includes("factory.ts")) return violations;
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/createApiClient\s*\(/.test(lines[i])) {
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.ERROR,
          ruleId: "import-boundary:create-api-client-location",
          message: "createApiClient" + "() must only be called in factories/. Import from the factory everywhere else.",
        }));
      }
    }
    return violations;
  }

  private _checkConcreteServiceImport(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (file.path.includes("controllers/") || file.path.includes("factories/") || file.path.includes("factory.ts") || file.path.includes("tests/")) return violations;
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const matches = lines[i].matchAll(/import\s+\{([^}]+)\}\s+from\s+["'][^"']*services[^"']*["']/g);
      for (const m of matches) {
        const names = m[1].split(",").map(n => n.trim().split(" as ")[0].trim());
        for (const name of names) {
          if (name[0] === name[0]?.toUpperCase() && !name.startsWith("I") && !name.endsWith("Error") && !name.endsWith("Protocol")) {
            violations.push(createViolation({
              file: file.path, line: i + 1, severity: Severity.ERROR,
              ruleId: "import-boundary:concrete-service-import",
              message: `Concrete service "${name}" imported outside controllers/ or factories/. Controllers and factories assemble concrete implementations. Import the Protocol interface instead.`,
            }));
          }
        }
      }
    }
    return violations;
  }

  private _checkAppFactoryImport(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (file.path.includes("routes/") || file.path.includes("factories/") || file.path.includes("factory.ts") || file.path.includes("cli/") || file.path.includes("tests/")) return violations;
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (/import\s+.*AppFactory/.test(lines[i]) || /from\s+["'][^"']*factory[^"']*["']/.test(lines[i])) {
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.ERROR,
          ruleId: "import-boundary:factory-import-location",
          message: "AppFactory must only be imported in src/routes/. Import the service interface everywhere else.",
        }));
      }
    }
    return violations;
  }

  private _extractImports(source: string): string[] {
    const imports: string[] = [];
    const re = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*\s*from\s+["']([^"']+)["']/g;
    let match;
    while ((match = re.exec(source)) !== null) {
      imports.push(match[1]);
    }
    // Also catch side-effect imports: import "module"
    const sideRe = /import\s+["']([^"']+)["']/g;
    while ((match = sideRe.exec(source)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  private _v(file: { path: string }, imp: string, ruleSuffix: string): Violation {
    return createViolation({
      file: file.path, line: 1, severity: Severity.ERROR,
      ruleId: `import-boundary:${ruleSuffix}`,
      message: `Banned import "${imp}" in this layer. ${this._fixMsg(ruleSuffix)}`,
    });
  }

  private _fixMsg(suffix: string): string {
    const msgs: Record<string, string> = {
      "service-banned-import": "Services never import other services or stores. Use a controller to orchestrate multiple services.",
      "controller-banned-import": "Controllers have no framework knowledge. Move @sveltejs/kit imports to the loader or page.",
      "stores-banned-import": "Stores hold reactive state only. Move service/controller calls to the loader.",
      "page-banned-import": "+page.svelte should not import services or controllers directly. Data comes from the loader via $props.",
      "loader-banned-import": "Use the typed openapi-fetch client instead of raw fetch. Instantiate via AppFactory.",
      "hooks-banned-import": "hooks.server.ts sets only locals.user. Move service calls to the loader or page.server.",
    };
    return msgs[suffix] ?? "";
  }

  describeRules() {
    return [
      { id: "import-boundary:service-banned-import", category: "import-boundary",
        description: "Service importing another service, store, or framework module",
        fixGuidance: "Services never import other services or stores. Use a controller to orchestrate multiple services." },
      { id: "import-boundary:controller-banned-import", category: "import-boundary",
        description: "Controller importing @sveltejs/kit or another controller",
        fixGuidance: "Controllers have no framework knowledge. Move @sveltejs/kit imports to the loader." },
      { id: "import-boundary:stores-banned-import", category: "import-boundary",
        description: "Store importing services, controllers, or @sveltejs/kit",
        fixGuidance: "Stores hold reactive state only. Move service/controller calls to the loader." },
      { id: "import-boundary:page-banned-import", category: "import-boundary",
        description: "+page.svelte importing services or controllers",
        fixGuidance: "Data comes from the loader via $props. Don't call services directly from the page." },
      { id: "import-boundary:loader-banned-import", category: "import-boundary",
        description: "Loader/action importing raw fetch",
        fixGuidance: "Use the typed openapi-fetch client via AppFactory." },
      { id: "import-boundary:hooks-banned-import", category: "import-boundary",
        description: "hooks.server.ts importing unauthorized modules",
        fixGuidance: "hooks.server.ts sets only locals.user. Move service calls to the loader." },
      { id: "import-boundary:create-api-client-location", category: "import-boundary",
        description: "createApiClient" + "() called outside factories/",
        fixGuidance: "createApiClient" + "() must only be called in factories/." },
      { id: "import-boundary:concrete-service-import", category: "import-boundary",
        description: "Concrete service imported outside controllers/ or factories/",
        fixGuidance: "Controllers and factories assemble concrete implementations. Import the Protocol interface everywhere else." },
      { id: "import-boundary:factory-import-location", category: "import-boundary",
        description: "AppFactory imported outside src/routes/",
        fixGuidance: "AppFactory must only be imported in src/routes/. Import the service interface everywhere else." },
    ];
  }
}
