import { describe, expect, test } from "bun:test";
import type { CheckController } from "chisel/checker/controllers/check_controller";
import { CheckerFactory } from "chisel/checker/factory";
import { defaultConfig } from "chisel/checker/config";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("CheckerFactory", () => {
  test("exposes only checker construction", () => {
    expect({
      createController: "createController" in CheckerFactory,
      createSkillSetupController: "createSkillSetupController" in CheckerFactory,
      createSelfUpdater: "createSelfUpdater" in CheckerFactory,
    }).toEqual({
      createController: true,
      createSkillSetupController: false,
      createSelfUpdater: false,
    });
  });

  test("the configured tsconfig is the one the resolver reads", async () => {
    // `tsconfig` was accepted by the config parser long before anything used
    // it; this is the assertion that it reaches the import graph.
    const root = mkdtempSync(join(tmpdir(), "chisel-factory-"));
    try {
      const files: Record<string, string> = {
        "tsconfig.json": "{}",
        "tsconfig.app.json":
          '{"compilerOptions":{"baseUrl":".","paths":{"$lib/*":["src/features/*"]}}}',
        "src/features/utils.ts": "export const helper = 1;\n",
        "src/lib/client/consumer.ts": 'import { helper } from "$lib/utils";\nexport const y = helper;\n',
      };
      for (const [path, content] of Object.entries(files)) {
        mkdirSync(join(root, path, ".."), { recursive: true });
        writeFileSync(join(root, path), content);
      }

      const withApp = CheckerFactory.createController({
        config: { ...defaultConfig(), tsconfig: "tsconfig.app.json" },
      });
      const withDefault = CheckerFactory.createController({ config: defaultConfig() });

      const unresolved = async (controller: CheckController): Promise<string[]> =>
        (await controller.check(root)).violations
          .filter(v => v.ruleId === "import-boundary:unresolved-import")
          .map(v => v.file);

      expect({
        configured: await unresolved(withApp),
        // `tsconfig.json` declares no paths, so `$lib` falls back to `src/lib`,
        // where this project keeps no such file.
        default: await unresolved(withDefault),
      }).toEqual({ configured: [], default: ["src/lib/client/consumer.ts"] });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
