# chisel-js

Opinionated architecture constraint checker for SvelteKit projects. Designed to catch the patterns agents get wrong — use it as a pre-commit hook to block violations, or run it interactively to steer an agent while it's working.

It pairs with [agent skills](https://github.com/ChidiRnweke/chisel/tree/master/skills): the skill teaches the agent the right pattern, the checker enforces it deterministically. Run `chisel-js explain <rule-id>` to get fix guidance the agent can consume directly.

## Installation

```bash
npm install -g @chidirnweke/chisel-js
# or
bun add -g @chidirnweke/chisel-js
```

## Quick start

```bash
chisel-js check .                  # check the current project
chisel-js rules                    # list all ~70 rules grouped by category
chisel-js explain structural:console-log-banned  # detailed fix guidance
chisel-js check . --json           # violations with message refs + skill names
chisel-js update self              # upgrade the installed CLI package
chisel-js update skills --target codex # overwrite installed skills with bundled copies
```

Non-zero exit code when ERROR-level violations are found.

Agent-facing JSON output deduplicates repeated violation messages: each
violation carries `messageRef`, and the top-level `messages` array contains
each full message once with its `skillName`.

## Commands

| Command | Description |
|---|---|
| `chisel-js check [path]` | Scan a project for architectural violations |
| `chisel-js check . --json` | Output violations as structured JSON with deduplicated messages |
| `chisel-js bundle [path]` | Check emitted client chunks against the bundle budget (needs a production build) |
| `chisel-js rules` | List all rules, grouped by category |
| `chisel-js rules --json` | Machine-readable rule listing |
| `chisel-js explain <rule-id>` | Detailed description + fix guidance for a rule |
| `chisel-js explain <category>` | All rules in a category (e.g. `structural`) |
| `chisel-js update self` | Upgrade the installed Chisel JS package |
| `chisel-js update skills [path]` | Refresh installed Chisel skills after confirmation |

## Agent skills

Refresh installed Chisel skills in a project:

```bash
chisel-js update skills --target codex      # writes .agents/skills/
chisel-js update skills --target claude     # writes .claude/skills/
chisel-js update skills --target opencode   # writes .opencode/skills/
```

This overwrites local modifications in the selected skill directories, so Chisel JS asks for confirmation before writing. Use `--yes` in automation and `--dry-run --json` to preview.

## What gets checked

| Category | Count | What it enforces |
|---|---|---|
| **Structural** | 16 rules | No `console.log`, no `setTimeout`, no `inline style=`, no `<style>` blocks, no `$app/stores` (use `$app/state`), no `writable()` (use `$state`), `$effect` must have cleanup, `onMount` must reference a browser API |
| **Component Enforcement** | 23 rules | Raw HTML elements (`<button>`, `<select>`, `<form>`, `<dialog>`, `<table>`…) banned outside `components/ui/` — must use shadcn replacements |
| **Colour** | 3 rules | No arbitrary Tailwind values (`bg-[#123]`…), no dynamic class construction, no modifier classes on semantic elements |
| **Import Boundaries** | 9 rules | Layer-based import restrictions — services can't import other services, controllers can't import `@sveltejs/kit`, pages can't import services directly |
| **Complexity** | 4 rules | Page ≤100 LoC, controller method ≤40 LoC, loader/action ≤20 LoC |
| **API Endpoints** | 2 rules | `RequestHandler` exports only in `src/routes/api/`; API route count must stay reasonable |
| **Concurrency** | 1 rule | `Promise.all` in loaders flagged (should be in controllers) |
| **Error Flow** | 1 rule | Raw HTTP status codes must not leak past error handlers |
| **Responsiveness** | 5 rules | No fixed pixel widths on page roots, no absolute positioning without breakpoints, `whitespace-nowrap` needs responsive variant, every page needs a layout wrapper |
| **Project Structure** | 3 rules | pnpm only (no npm/yarn), no backend env vars in frontend `.env`, service files need corresponding tests |
| **Test Structure** | 8 rules | Tests colocated as `*.spec.ts` or under `tests/unit\|integration\|e2e/`; one `expect()` per test; no mocking libraries; test names describe invariants; `test.skip` needs a reason; fakes declare the interface they stand in for; no `as unknown as` casts; no `toHaveBeenCalled` assertions |
| **Topology** | 7 rules | No layer-wide barrel imports; no reaching past a feature's `index.ts`; no `misc/`-style catch-all directories; the composition root imports no concretes, constructs only factories, and parks no placeholders; a `*-factory.ts` exports exactly one value |
| **Coherence** | 2 rules | Every vitest `include` glob must match a file (the "ran zero tests and passed" bug); paths quoted in maintained markdown must exist |
| **Bundle** | 1 rule | Client chunks over 500 kB containing application code. Run separately via `chisel-js bundle` after a production build |

## Severity tiers

| Tier | Behaviour |
|---|---|
| **ERROR** | Blocks commit, no override. Import boundaries, banned HTML, `$effect` without cleanup, arbitrary colour values. |
| **WARNING** | Blocks commit, suppressible with a reason comment. Page/controller LoC thresholds, `Promise.all` in loaders, API route ratio. |
| **INFO** | Logged, non-blocking. |

## How it works

```
models/         Pure data — Violation, Severity, FileInfo, ProjectInfo
services/       One service per rule category, self-describing via describeRules()
repositories/   File discovery via fast-glob
controllers/    Orchestrates all services, aggregates violations
factory.ts      Zero-logic DI — wires the services into the controller
cli/main.ts     Commander-based CLI — check, bundle, rules, explain
reporter.ts     Coloured terminal output via chalk
```

Adding a rule requires one new check method in a service + one `describeRules()` entry. The CLI discovers it automatically.

## Development

```bash
bun install
bun test
bun run build
```

The checker is self-validating: `chisel-js check .` produces zero violations on its own source.
