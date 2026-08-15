# Chisel

Deterministic architecture constraint checkers designed to work alongside agent skills. The skills teach an agent the right pattern — the checker enforces it. Run it as a pre-commit hook to block violations before they land. Run it interactively to steer an agent while it's working.

Two checkers. Each CLI is the source of truth for its own rules — run `rules` or
`explain` to see them:

| Package | Language | Target | CLI |
|---|---|---|---|
| `chisel` | Python | FastAPI backends | `chisel check .` |
| `chisel-js` | TypeScript | SvelteKit frontends | `chisel-js check .` |

## How it fits with skills

The `skills/` directory contains agent skills — structured instructions that teach an LLM the architectural patterns for each layer. The checker verifies those patterns deterministically:

```
skills/
  building-python-backend/SKILL.md          ← teaches service/controller/repository patterns
  building-sveltekit-frontend/SKILL.md      ← teaches $effect, onMount, store patterns
  designing-svelte-ui/SKILL.md              ← teaches shadcn component rules, Tailwind tokens
  qa/SKILL.md                               ← teaches one-assert-per-test, fakes over mocks

chisel check .                              ← enforces every rule from those skills
```

An agent reads `building-python-backend/SKILL.md`, learns that services never import `sqlalchemy`, writes code accordingly. The checker catches it if it doesn't. The agent reads `chisel explain structural:print-banned` to get fix guidance in context. Loop until clean.

## Pre-commit

Block violations before they land on any branch:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: chisel-py
        name: chisel (Python)
        entry: chisel check chisel_py --strict
        language: python
        language_version: python3.12
        additional_dependencies: [grimp>=3.0, radon>=6.0, typer>=0.12, rich>=13.0]
        files: ^chisel_py/src/.*\.py$
        pass_filenames: false

      - id: chisel-js
        name: chisel (TypeScript)
        entry: chisel-js check .
        language: system
        files: ^(chisel_js/src/.*\.ts|chisel_js/.*\.svelte)$
        pass_filenames: false
```

## Quick start

```bash
# Python
pip install chisel
chisel check ./your-backend

# TypeScript
npm install -g chisel-js
chisel-js check ./your-frontend
```

## Documentation

The full docs live at **<https://chidirnweke.github.io/chisel>** — quick start,
guide pages for both CLIs, and a per-rule reference generated from the CLIs
themselves.

The site source is in [`docs/`](docs/) (Astro Starlight, built with bun).
`docs.yml` builds and deploys it to the `gh-pages` branch on every push to
`master` that touches `docs/` or `chisel_js/`.

## Agent-facing commands

These are designed for LLM consumption — an agent queries them to understand what a rule means and how to fix it:

```bash
chisel rules                              # all ~58 rules, grouped by category
chisel rules --json                       # machine-readable for agent consumption
chisel explain structural:isinstance-banned  # rule description + fix guidance
chisel explain structural                 # all rules in a category
chisel check . --json                     # violations with message refs + skill names
chisel setup --target codex               # install repo agent skills to .agents/skills/
chisel update self                        # upgrade the installed Python CLI package
chisel update skills --target codex       # overwrite installed skills with bundled copies
```

`chisel check --json` and `chisel-js check --json` deduplicate repeated messages:
violations carry `message_ref` / `messageRef`, and the top-level `messages`
array contains each full message once with its `skill_name` / `skillName`.

`chisel-js` equivalents: `chisel-js rules`, `chisel-js explain`, `chisel-js check . --json`, `chisel-js update self`, and `chisel-js update skills`. It also has `chisel-js bundle`, which checks emitted client chunks against a size budget and so needs a production build to have run.

## Agent skills

Chisel can install its bundled agent skills into your repo:

```bash
chisel setup --target codex      # .agents/skills/ for Codex and OpenCode compatibility
chisel setup --target claude     # .claude/skills/ for Claude Code
chisel setup --target opencode   # .opencode/skills/ for OpenCode native skills
```

Run `chisel setup` without `--target` in an interactive terminal to choose the destination. Chisel installs one target format per run to avoid duplicate skill discovery in tools like OpenCode.

To refresh installed skills after upgrading Chisel:

```bash
chisel update skills --target codex
chisel-js update skills --target codex
```

Skill updates overwrite local modifications in the selected skill directories, so Chisel asks for confirmation before writing. Use `--yes` in automation and `--dry-run --json` to preview.

## What gets checked

- **Import boundaries** — layers only import what they're allowed to. Services don't import SQLAlchemy. Routes don't import services directly. ORM types stay in repositories.
- **Structural invariants** — `getattr`/`setattr` banned. `isinstance` requires `match/case`. Logger is module-level. Dataclasses use `slots=True`. `try/except` banned in route handlers.
- **Component enforcement** (JS) — raw HTML elements (`<button>`, `<select>`, `<form>`, `<dialog>`, etc.) must use shadcn replacements. 23 rules covering every banned HTML tag.
- **Colour enforcement** (JS) — arbitrary Tailwind values banned. Dynamic class construction flagged. Modifier classes on semantic HTML blocked.
- **$effect / onMount** (JS) — `$effect` without cleanup flagged. Writing `$state` from `data` recommends `$derived`. `onMount` must reference a browser API.
- **Complexity** — controller method ≤30 LoC (Python) / ≤40 (JS). Route handler ≤20 LoC. Page ≤100 LoC.
- **Testing** — one assert per test. Mocking libraries banned. Test names must describe invariants. Test files must live in `tests/unit/` or `tests/integration/`.
- **Project structure** — `pyproject.toml` only (no `setup.py`). `pnpm` only (no `npm`/`yarn`). Env files separate backend from frontend secrets.
- **Concurrency** — `asyncio.gather` banned (Python). `Promise.all` in loaders warned (JS).
- **Error flow** — raw HTTP status codes never leak past error handlers.

Full rule listing:

```bash
chisel rules            # human-readable, grouped by category
chisel rules --json     # machine-readable
chisel explain structural:isinstance-banned  # detailed fix guidance
chisel explain structural                       # all rules in a category
```

## Exceptions

Create a `chisel-exceptions.toml` at your project root to exempt files from rules:

```toml
[[exceptions]]
files = ["src/legacy/*.py", "src/cli/main.py"]
rules = ["structural:print-banned"]
reason = "CLI requires stdout output"
```

`*` matches all rules. A category prefix like `structural` matches all rules in that category. Inline per-line suppression: `# noqa: rule-id — reason` (Python) / `<!-- noqa: rule-id — reason -->` (Svelte).

## Architecture

Both checkers follow the same layered architecture (and enforce it on themselves):

```
models/         Pure data — Violation, Severity, FileInfo, ProjectInfo
services/       One service per rule category. Self-describing via describeRules()
repositories/   File discovery, import graph analysis
controllers/    Orchestrates services, filters exceptions, suppresses via noqa
factory.py      Zero-logic DI — wires all services into the controller
cli/            Thin entry point — argparse/commander → factory → controller → reporter
```

Adding a rule is one new check method in a service + one `describeRules()` entry. The CLI and the agent-facing commands discover it automatically and attach the relevant bundled skill name.

## Development

```bash
# Python
cd chisel_py
pip install -e ".[dev]"
pytest tests/ -q

# TypeScript
cd chisel_js
bun install
bun test
```

Both checkers are self-validating: `chisel check . --strict` and `chisel-js check .` produce zero violations on their own source code.
