export const SVELTEKIT_FRONTEND_SKILL = "building-sveltekit-frontend";
export const SVELTE_UI_SKILL = "designing-svelte-ui";
export const QA_SKILL = "qa";

export interface RuleInfo {
  readonly id: string;
  readonly category: string;
  readonly description: string;
  readonly fixGuidance: string;
  readonly skillName?: string;
}

export function skillNameForCategory(category: string): string {
  if (category === "test-structure") return QA_SKILL;
  if (category === "structural" || category === "import-boundary" || category === "complexity" || category === "concurrency" || category === "error-flow" || category === "api-endpoints" || category === "project-structure") {
    return SVELTEKIT_FRONTEND_SKILL;
  }
  if (["component-enforcement", "colour", "colour-enforcement", "typography", "spacing", "responsiveness", "modifier"].includes(category)) {
    return SVELTE_UI_SKILL;
  }
  return SVELTEKIT_FRONTEND_SKILL;
}

export function skillNameForRule(ruleId: string): string {
  return skillNameForCategory(ruleId.split(":", 1)[0] ?? ruleId);
}

export function withSkillName(rule: RuleInfo): RuleInfo & { readonly skillName: string } {
  return {
    ...rule,
    skillName: rule.skillName ?? skillNameForCategory(rule.category),
  };
}
