import { describe, test, expect, beforeAll } from "bun:test";
import type { CheckResult } from "chisel/checker/models/result";
import type { ProjectInfo } from "chisel/checker/models/project_info";
import { CheckerFactory } from "chisel/checker/factory";
import { FileDiscovery } from "chisel/checker/repositories/file_discovery";
import { defaultConfig } from "chisel/checker/config";
import { CheckerMode } from "chisel/checker/models/mode";
import { Layer } from "chisel/checker/models/layer";
import { join } from "node:path";

const FIXTURE = join(import.meta.dir, "../../fixtures/conformant-app");

let result: CheckResult;
let project: ProjectInfo;

beforeAll(async () => {
  const controller = CheckerFactory.createController({
    config: defaultConfig(CheckerMode.STANDALONE),
  });
  result = await controller.check(FIXTURE);
  project = await new FileDiscovery().discover(FIXTURE);
});

/**
 * The other direction from the standalone specimen.
 *
 * `standalone-app/` is anti-patterns end to end, so it proves a rule still
 * fires — but a rule that starts firing on *correct* code cannot be caught
 * there, because there is no correct code in the tree. Two false positives have
 * shipped that way already: `one-assert-per-test` miscounting any test
 * containing a block, and `test-naming` reading `source.split('\n')` as a badly
 * named test.
 *
 * So this tree is a working SvelteKit app that happens to obey every rule, and
 * the assertion is the whole violation list. Any rule that grows a false
 * positive fails here, named and located, without anyone having to predict it.
 */
describe("acceptance: a conformant repo", () => {
  test("produces no violations at all", () => {
    // Whole list, not a count: a failure should print what fired and where.
    expect(result.violations).toEqual([]);
  });
});

/**
 * The guard on the guard. The test above passes trivially against an empty
 * directory, so these pin that the tree is still big enough and varied enough
 * to be worth running — deleting the file that provokes a rule must break the
 * suite, not quietly satisfy it.
 */
describe("acceptance: the conformant fixture stays substantial", () => {
  test("every layer that carries architectural intent is represented", () => {
    const present = new Set(project.files.map(file => file.layer));
    const missing = Object.values(Layer)
      .filter(layer => layer !== Layer.UNKNOWN)
      .filter(layer => !present.has(layer))
      .sort();

    expect(missing).toEqual([]);
  });

  test("the tree is a whole app, not a token file or two", () => {
    expect({
      atLeastThirtyFiles: result.filesChecked >= 30,
      hasColocatedSpecs: project.files.some(f => f.path.endsWith(".spec.ts")),
      hasSvelteComponents: project.files.some(f => f.path.endsWith(".svelte")),
    }).toEqual({
      atLeastThirtyFiles: true,
      hasColocatedSpecs: true,
      hasSvelteComponents: true,
    });
  });
});
