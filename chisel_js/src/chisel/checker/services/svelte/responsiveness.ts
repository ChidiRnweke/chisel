import type { ProjectInfo } from "chisel/checker/models/project_info";
import type { Violation } from "chisel/checker/models/violation";
import { Severity } from "chisel/checker/models/severity";
import { createViolation } from "chisel/checker/models/violation";
import { isLayoutLevelComponentPath, isLeafComponentPath } from "chisel/checker/models/layer";

const BREAKPOINT_RE = /(?:sm|md|lg|xl|2xl):/;

export class ResponsivenessService {
  readonly ruleIdPrefix = "responsiveness";

  check(project: ProjectInfo): Violation[] {
    const violations: Violation[] = [];
    for (const file of project.files) {
      if (!file.path.endsWith(".svelte")) continue;
      if (!file.source) continue;
      if (file.path.includes("components/ui/")) continue;
      violations.push(...this._checkFixedWidth(file));
      violations.push(...this._checkAbsoluteWithoutBreakpoint(file));
      violations.push(...this._checkWhitespaceNowrap(file));
      violations.push(...this._checkLayoutWrapper(file));
      violations.push(...this._checkBreakpointPresence(file));
    }
    return violations;
  }

  private _checkFixedWidth(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.endsWith("+page.svelte")) return violations;
    const lines = file.source.split("\n");
    const rootLines = rootClassLines(file.source);
    for (const i of rootLines) {
      if (/\bw-\[\d+px\]/.test(lines[i]) || /\bw-\d{2,3}(?!\/)/.test(lines[i])) {
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.ERROR,
          ruleId: "responsiveness:fixed-width-banned",
          message: "Fixed pixel width classes (w-[400px], w-96) banned on root elements of page components. Use responsive or fluid widths.",
        }));
      }
    }
    return violations;
  }

  private _checkAbsoluteWithoutBreakpoint(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!isLayoutLevelComponentPath(file.path)) return violations;
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const classes = lines[i].match(/class="([^"]+)"/)?.[1] ?? "";
      if (classes.includes("absolute") && !/(?:sm|md|lg|xl):absolute/.test(classes)) {
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.ERROR,
          ruleId: "responsiveness:absolute-no-breakpoint",
          message: "Absolute positioning without a responsive breakpoint variant (md:, lg:) banned on layout-level elements.",
        }));
      }
    }
    return violations;
  }

  private _checkWhitespaceNowrap(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!isLayoutLevelComponentPath(file.path)) return violations;
    const lines = file.source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const classes = lines[i].match(/class="([^"]+)"/)?.[1] ?? "";
      if (classes.includes("whitespace-nowrap") && !/(?:sm|md|lg|xl):whitespace-nowrap/.test(classes)) {
        violations.push(createViolation({
          file: file.path, line: i + 1, severity: Severity.ERROR,
          ruleId: "responsiveness:nowrap-no-breakpoint",
          message: "whitespace-nowrap without a responsive variant banned on layout-level elements.",
        }));
      }
    }
    return violations;
  }

  private _checkLayoutWrapper(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (!file.path.endsWith("+page.svelte")) return violations;
    const wrappers = ["PageShell", "Container", "AppLayout"];
    const hasWrapper = wrappers.some(w => file.source.includes(`<${w}`));
    if (!hasWrapper) {
      violations.push(createViolation({
        file: file.path, line: 1, severity: Severity.WARNING,
        ruleId: "responsiveness:missing-page-wrapper",
        message: "Every +page.svelte must have an approved layout wrapper (<PageShell>, <Container>, <AppLayout>) as its root child.",
      }));
    }
    return violations;
  }

  private _checkBreakpointPresence(file: { path: string; source: string }) {
    const violations: Violation[] = [];
    if (isLeafComponentPath(file.path)) return violations;
    if (!isLayoutLevelComponentPath(file.path)
      && !file.path.endsWith("+page.svelte")
      && !file.path.endsWith("+layout.svelte")) return violations;
    if (BREAKPOINT_RE.test(file.source)) return violations;
    violations.push(createViolation({
      file: file.path, line: 1, severity: Severity.WARNING,
      ruleId: "responsiveness:no-breakpoint-classes",
      message: "This layout/page file has no responsive breakpoint classes (sm:, md:, lg:). Add responsive variants for layout-affecting utilities.",
    }));
    return violations;
  }

  describeRules() {
    return [
      { id: "responsiveness:fixed-width-banned", category: "responsiveness", description: "Fixed pixel width on page root", fixGuidance: "Use responsive or fluid widths instead of fixed pixel values." },
      { id: "responsiveness:absolute-no-breakpoint", category: "responsiveness", description: "Absolute positioning without breakpoint on layout-level element", fixGuidance: "Add a responsive breakpoint variant (md:, lg:) to absolute positioning on layout elements." },
      { id: "responsiveness:nowrap-no-breakpoint", category: "responsiveness", description: "whitespace-nowrap without responsive variant on layout-level element", fixGuidance: "Add a responsive breakpoint variant to whitespace-nowrap on layout elements." },
      { id: "responsiveness:missing-page-wrapper", category: "responsiveness", description: "+page.svelte missing layout wrapper", fixGuidance: "Wrap the page content in <PageShell>, <Container>, or <AppLayout> as the direct root child." },
      { id: "responsiveness:no-breakpoint-classes", category: "responsiveness", description: "Layout/page .svelte file has no responsive breakpoint classes", fixGuidance: "Add responsive breakpoint variants (sm:, md:, lg:) for layout-affecting utilities. Leaf/icon components are exempt." },
    ];
  }
}

function rootClassLines(source: string): number[] {
  const lines = source.split("\n");
  const out: number[] = [];
  let inTemplate = false;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i];
    if (/class=/.test(t)) out.push(i);
    if (t.includes("`")) inTemplate = !inTemplate;
  }
  return out.slice(0, 3);
}