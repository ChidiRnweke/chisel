import { describe, test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { SemanticArchitectureService } from "chisel/checker/services/architecture/semantic";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { parsedFile } from "../../fakes/parsed_file";
import { Layer } from "chisel/checker/models/layer";

describe("architecture — project root", () => {
  test("a relative root resolves rootDirs exactly as an absolute one does", () => {
    const root = mkdtempSync(join(tmpdir(), "chisel-semantic-root-"));
    try {
      const files = {
        "src/routes/notes/+page.ts": "import type { PageLoad } from './$types';\nexport const load: PageLoad = () => ({});\n",
        ".svelte-kit/types/src/routes/notes/$types.d.ts": "export type PageLoad = () => object;\n",
        "tsconfig.json": JSON.stringify({ compilerOptions: { rootDirs: [".", ".svelte-kit/types"] } }),
      };
      for (const [path, source] of Object.entries(files)) {
        mkdirSync(join(root, path, ".."), { recursive: true });
        writeFileSync(join(root, path), source);
      }
      const project = createProjectInfo({
        rootPath: relative(process.cwd(), root),
        files: [parsedFile({ path: "src/routes/notes/+page.ts", source: files["src/routes/notes/+page.ts"], layer: Layer.COMPONENTS })],
      });
      const service = new SemanticArchitectureService({ mode: "sveltekit-standalone", tsconfig: "tsconfig.json", entryPoints: [] });
      expect(service.check(project).map(v => v.ruleId)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
