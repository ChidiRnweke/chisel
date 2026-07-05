import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoSkills = join(packageRoot, "..", "skills");
const bundledSkills = join(packageRoot, "bundled_skills");

if (!existsSync(repoSkills)) {
  throw new Error(`Skills source not found: ${repoSkills}`);
}

rmSync(bundledSkills, { recursive: true, force: true });
cpSync(repoSkills, bundledSkills, {
  recursive: true,
  filter: path => !path.endsWith("__pycache__") && !path.endsWith(".pyc"),
});
