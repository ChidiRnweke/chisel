import { describe, test, expect } from "bun:test";
import { ExceptionRegistry } from "chisel/checker/repositories/exception_registry";
import { createViolation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";

async function registryFromConfig(config: unknown): Promise<ExceptionRegistry> {
  const fs = await import("node:fs/promises");
  const dir = await fs.mkdtemp(import.meta.dir + "/__exceptions_");
  try {
    await fs.writeFile(dir + "/chisel-exceptions.json", JSON.stringify(config));
    const registry = new ExceptionRegistry();
    registry.load(dir);
    return registry;
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function violation(file: string, ruleId: string, severity: Severity = Severity.ERROR) {
  return createViolation({ file, line: 1, severity, ruleId, message: "msg" });
}

const SINGLE_RULE = {
  exceptions: [
    {
      files: ["src/legacy/*.ts"],
      rules: ["structural:console-banned"],
      reason: "legacy code, scheduled for removal",
    },
  ],
};

describe("ExceptionRegistry", () => {
  describe("parsing", () => {
    test("exempts a violation matching the loaded config", async () => {
      const registry = await registryFromConfig(SINGLE_RULE);
      expect(registry.isExempted("src/legacy/old.ts", "structural:console-banned")).toBe(true);
    });

    test("entries without files or rules exempt nothing", async () => {
      const registry = await registryFromConfig({ exceptions: [{ reason: "no patterns" }] });
      expect(registry.isExempted("src/app.ts", "structural:console-banned")).toBe(false);
    });
  });

  describe("wildcard rule matching", () => {
    test("star matches every rule", async () => {
      const registry = await registryFromConfig({ exceptions: [{ files: ["src/generated/*"], rules: ["*"], reason: "generated" }] });
      expect(registry.isExempted("src/generated/api.ts", "complexity:page-too-long")).toBe(true);
    });
  });

  describe("exact rule matching", () => {
    test("a different rule id is not exempted", async () => {
      const registry = await registryFromConfig(SINGLE_RULE);
      expect(registry.isExempted("src/legacy/old.ts", "structural:raw-fetch")).toBe(false);
    });
  });

  describe("prefix rule matching", () => {
    test("a category prefix matches every rule in the category", async () => {
      const registry = await registryFromConfig({ exceptions: [{ files: ["src/legacy/*.ts"], rules: ["structural"], reason: "legacy" }] });
      expect(registry.isExempted("src/legacy/old.ts", "structural:console-banned")).toBe(true);
    });

    test("a partial prefix does not match", async () => {
      const registry = await registryFromConfig({ exceptions: [{ files: ["src/legacy/*.ts"], rules: ["struct"], reason: "legacy" }] });
      expect(registry.isExempted("src/legacy/old.ts", "structural:console-banned")).toBe(false);
    });
  });

  describe("glob file matching", () => {
    test("a non-matching file is not exempted", async () => {
      const registry = await registryFromConfig(SINGLE_RULE);
      expect(registry.isExempted("src/lib/new.ts", "structural:console-banned")).toBe(false);
    });

    test("star crosses directory separators, matching the Python checker", async () => {
      const registry = await registryFromConfig({ exceptions: [{ files: ["src/*.ts"], rules: ["*"], reason: "fnmatch parity" }] });
      expect(registry.isExempted("src/deeply/nested/file.ts", "structural:console-banned")).toBe(true);
    });

    test("question mark matches a single character", async () => {
      const registry = await registryFromConfig({ exceptions: [{ files: ["src/v?.ts"], rules: ["*"], reason: "versioned" }] });
      expect(registry.isExempted("src/v1.ts", "structural:console-banned")).toBe(true);
    });
  });

  describe("filter", () => {
    test("removes exempted violations and keeps the rest", async () => {
      const registry = await registryFromConfig(SINGLE_RULE);
      const kept = violation("src/lib/new.ts", "structural:console-banned");
      const filtered = registry.filter([
        violation("src/legacy/old.ts", "structural:console-banned"),
        kept,
      ]);
      expect(filtered).toEqual([kept]);
    });

    test("filters ERROR severity violations too, matching the Python checker", async () => {
      const registry = await registryFromConfig(SINGLE_RULE);
      const filtered = registry.filter([
        violation("src/legacy/old.ts", "structural:console-banned", Severity.ERROR),
      ]);
      expect(filtered).toEqual([]);
    });
  });

  describe("no exceptions file", () => {
    test("loading a directory without the file exempts nothing", async () => {
      const fs = await import("node:fs/promises");
      const dir = await fs.mkdtemp(import.meta.dir + "/__no_exceptions_");
      try {
        const registry = new ExceptionRegistry();
        registry.load(dir);
        expect(registry.isExempted("src/app.ts", "structural:console-banned")).toBe(false);
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    });
  });
});
