import { describe, expect, test } from "bun:test";
import { SelfUpdater } from "chisel/checker/services/self_update";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

  test("version notice returns message for newer version", async () => {
    const cache = mkdtempSync(join(tmpdir(), "chisel-version-"));
    const notice = await new SelfUpdater(
      "@chidirnweke/chisel-js",
      "Chisel JS",
      "registry",
      86_400_000,
      cache,
      async () => "0.1.1",
      "0.1.0",
    ).versionNotice();
    expect(notice?.message).toBe("Chisel JS 0.1.1 is available. Update with: chisel-js update self");
  });

  test("version notice skips equal version", async () => {
    const cache = mkdtempSync(join(tmpdir(), "chisel-version-"));
    const notice = await new SelfUpdater(
      "@chidirnweke/chisel-js",
      "Chisel JS",
      "registry",
      86_400_000,
      cache,
      async () => "0.1.0",
      "0.1.0",
    ).versionNotice();
    expect(notice).toBeUndefined();
  });

  test("version notice uses cached latest version", async () => {
    const cache = mkdtempSync(join(tmpdir(), "chisel-version-"));
    writeFileSync(join(cache, "version.json"), JSON.stringify({
      checkedAt: 9999999999999,
      latestVersion: "0.1.2",
    }), "utf-8");
    const notice = await new SelfUpdater(
      "@chidirnweke/chisel-js",
      "Chisel JS",
      "registry",
      86_400_000,
      cache,
      async () => "0.1.1",
      "0.1.0",
    ).versionNotice();
    expect(notice?.latestVersion).toBe("0.1.2");
  });

  test("version notice silently skips registry failure", async () => {
    const cache = mkdtempSync(join(tmpdir(), "chisel-version-"));
    const notice = await new SelfUpdater(
      "@chidirnweke/chisel-js",
      "Chisel JS",
      "registry",
      86_400_000,
      cache,
      async () => { throw new Error("offline"); },
      "0.1.0",
    ).versionNotice();
    expect(notice).toBeUndefined();
  });
});
