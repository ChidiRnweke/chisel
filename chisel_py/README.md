# chisel

Opinionated architecture constraint checker for FastAPI backends. Designed to catch the patterns agents get wrong — use it as a pre-commit hook to block violations, or run it interactively to steer an agent while it's working.

It pairs with [agent skills](https://github.com/ChidiRnweke/chisel/tree/master/skills): the skill teaches the agent the right pattern, the checker enforces it deterministically. Run `chisel explain <rule-id>` to get fix guidance the agent can consume directly.

## Installation

```bash
pip install chisel
```

## Quick start

```bash
chisel check ./backend              # check a project
chisel rules                        # list all ~55 rules grouped by category
chisel explain structural:print-banned  # detailed fix guidance
chisel check . --json               # violations with message refs + skill names
chisel check . --no-strict          # skip src-layout enforcement
```

## Commands

| Command | Description |
|---|---|
| `chisel check [path]` | Scan a project for architectural violations |
| `chisel check . --json` | Output violations as structured JSON with deduplicated messages |
| `chisel check . --strict/--no-strict` | Toggle src-layout and build-config enforcement |
| `chisel rules` | List all rules, grouped by category |
| `chisel rules --json` | Machine-readable rule listing |
| `chisel explain <rule-id>` | Detailed description + fix guidance for a rule |
| `chisel explain <category>` | All rules in a category (e.g. `structural`) |
| `chisel setup [path]` | Install Chisel agent skills into a repo for Codex, Claude Code, or OpenCode |

## Agent skills

Install Chisel's bundled skills into a project so coding agents can load the same architecture guidance that the checker enforces:

```bash
chisel setup --target codex      # writes .agents/skills/
chisel setup --target claude     # writes .claude/skills/
chisel setup --target opencode   # writes .opencode/skills/
```

Without `--target`, `chisel setup` asks which agent to configure when running interactively. Use `--skill qa` to install one skill, `--dry-run --json` to preview, and `--overwrite` to replace existing skill directories.

Agent-facing JSON output deduplicates repeated violation messages: each
violation carries `message_ref`, and the top-level `messages` array contains
each full message once with its `skill_name`.

## What gets checked

| Category | What it enforces |
|---|---|
| **Import Boundaries** | Layer-based import restrictions — services can't import SQLAlchemy, routes can't import services, `HTTPException` only in `error_handlers.py`, concrete services only in `factory.py` |
| **Structural Invariants** | No `getattr`/`setattr`, no `%` string formatting, no f-strings in logger calls, no `print()` in `src/`, `@dataclass` uses `slots=True`, `AppFactory` has zero logic, `match/case` only in error handlers |
| **Complexity** | Controller method ≤30 LoC, route handler ≤20 LoC, factory cyclomatic complexity = 1, `app.py` ≤50 LoC |
| **Concurrency** | `asyncio.gather` banned unconditionally — use `asyncio.TaskGroup` |
| **Error Flow** | `AppError` subclasses never contain HTTP status codes; status codes decided only in `error_handlers.py` |
| **Project Structure** | `pyproject.toml` only (no `setup.py`), env vars read at startup only via `AppConfig`, no `.py` files at project root |
| **Test Structure** | Test files only under `tests/unit/`, `tests/integration/`, `tests/e2e/`; one `assert` per test; no mocking libraries; test names describe invariants; `pytest.mark.skip` needs a reason; no `TestClient` outside e2e |

## Exceptions

Create a `chisel-exceptions.toml` at your project root:

```toml
[[exceptions]]
files = ["src/legacy/*.py", "src/cli/main.py"]
rules = ["structural:print-banned"]
reason = "CLI requires stdout output"
```

`*` matches all rules. A category prefix like `structural` matches all rules in that category.

Inline suppression per line: `# noqa: rule-id — reason`.

## Severity tiers

| Tier | Behaviour |
|---|---|
| **ERROR** | Blocks commit, no override. Import boundary violations, `asyncio.gather`, `getattr`/`setattr`, f-string in logger, `print()` in `src/`. |
| **WARNING** | Blocks commit, suppressible with a reason comment. Controller/route LoC thresholds, test coverage gaps. |
| **INFO** | Logged, non-blocking. |

## How it works

```
models/         Pure data — Violation, Severity, FileInfo, ProjectInfo
services/       One service per rule category, self-describing via describe_rules()
repositories/   File discovery, import graph analysis (grimp)
controllers/    Orchestrates all services, filters exceptions, suppresses via noqa
factory.py      Zero-logic DI — wires all services into the controller
cli/main.py     Typer-based CLI — check, rules, explain
reporter.py     Coloured terminal output via rich
```

Adding a rule requires one new check method in a service + one `describe_rules()` entry. The CLI discovers it automatically.

## Development

```bash
pip install -e ".[dev]"
pytest tests/ -q
```

The checker is self-validating: `chisel check . --strict` produces zero violations on its own source.
