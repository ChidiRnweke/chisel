PYTHON_BACKEND_SKILL = "building-python-backend"
SVELTEKIT_FRONTEND_SKILL = "building-sveltekit-frontend"
SVELTE_UI_SKILL = "designing-svelte-ui"
QA_SKILL = "qa"


def skill_name_for_category(category: str) -> str:
    if category == "test-structure":
        return QA_SKILL
    if category in {"component-enforcement", "colour", "responsiveness"}:
        return SVELTE_UI_SKILL
    if category in {"api", "api-endpoints"}:
        return SVELTEKIT_FRONTEND_SKILL
    return PYTHON_BACKEND_SKILL


def skill_name_for_rule(rule_id: str) -> str:
    category = rule_id.split(":", maxsplit=1)[0]
    return skill_name_for_category(category)
