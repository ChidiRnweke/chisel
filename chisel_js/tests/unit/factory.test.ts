import { describe, expect, test } from "bun:test";
import { CheckerFactory } from "chisel/checker/factory";

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
});
