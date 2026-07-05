import { describe, expect, test } from "bun:test";
import { SelfUpdater } from "chisel/checker/services/self_update";

describe("SelfUpdater", () => {
  test("npm command upgrades global package", () => {
    expect(new SelfUpdater().commandFor("npm")).toEqual([
      "npm",
      "install",
      "-g",
      "@chidirnweke/chisel-js",
    ]);
  });

  test("bun command upgrades global package", () => {
    expect(new SelfUpdater().commandFor("bun")).toEqual([
      "bun",
      "add",
      "-g",
      "@chidirnweke/chisel-js",
    ]);
  });

  test("dry run does not execute subprocess", () => {
    const result = new SelfUpdater().update("npm", true);
    expect(result).toEqual({
      returnCode: 0,
      command: ["npm", "install", "-g", "@chidirnweke/chisel-js"],
    });
  });
});
