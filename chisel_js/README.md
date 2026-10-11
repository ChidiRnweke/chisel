# chisel-js

Opinionated architecture constraint checker for SvelteKit projects. Designed to catch the patterns agents get wrong — use it as a pre-commit hook to block violations, or run it interactively to steer an agent while it's working.

It pairs with [agent skills](https://github.com/ChidiRnweke/chisel/tree/master/skills): the skill teaches the agent the right pattern, the checker enforces it deterministically. Run `chisel-js explain <rule-id>` to get fix guidance the agent can consume directly.

Full documentation: **<https://chidirnweke.github.io/chisel>** — quick start, guide pages, and a per-rule reference generated from the CLI itself.

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

112 rules across 23 categories. The counts below are checked against the real
rule set in CI, so they cannot drift from what `chisel-js rules` prints.

| Category | Count | What it enforces |
|---|---|---|
| `component-enforcement` | 24 rules | Raw HTML elements (`<button>`, `<select>`, `<form>`, `<dialog>`, `<table>`…) banned outside `components/ui/` and `components/primitives/` — use the design system's replacements |
| `design-system` | 16 rules | Bounded design choices: AA contrast between token pairs, colour only from tokens (no hex, rgb, pure black or run-time derivation), fixed alpha steps, weights 400–800, sized headings, tracking rules, flat surfaces, no accent bars, icons from one set |
| `architecture` | 12 rules | Type-checked layering: no service reached indirectly, no public service helpers, no concrete dependency types, no controller chains or controller-to-repository calls, no collaborators in controller results, no state kept by services, no workflows in stores, factories or agent tools |
| `narrowing` | 8 rules | Parse at the boundary: no casts onto object literals or inline shapes, no unchecked `JSON.parse` or `response.json()`, no open records of `unknown`, no `z.unknown()`, no `unknown` on the types of models, services and controllers |
| `test-structure` | 8 rules | Tests colocated beside their subject or under `tests/unit\|integration\|e2e/`; every test asserts something (no ceiling: one behaviour may assert all its outcomes); no mocking libraries; test names describe invariants; `test.skip` needs a reason; fakes declare the interface they stand in for; no literal shapes cast through `unknown`; no `toHaveBeenCalled` assertions |
| `import-boundary` | 7 rules | Layer-based import restrictions — a service never imports another service, the ORM stays in repositories, `@sveltejs/kit` stays out of controllers, private env stays server-side, and every import must resolve |
| `topology` | 6 rules | No layer-wide barrel imports; no reaching past a feature's `index.ts`; no `misc/`-style catch-all directories; the composition root imports no concretes, constructs only factories, and parks no placeholders |
| `structural` | 4 rules | No inline styles (attributes or `style:` directives), no `<style>` blocks, public services `implements` interfaces declared beside them, `hooks.server.ts` keeps `locals` small |
| `colour-enforcement` | 4 rules | No arbitrary Tailwind values (`bg-[#123]`…), no palette classes (`text-red-500`), no dynamic class construction, no modifier classes on semantic elements |
| `structure` | 3 rules | Every folder under `$lib/server/` names a layer; repositories never sit at a universal path; every module under `$lib/` classifies as something |
| `project-structure` | 3 rules | pnpm only (no npm/yarn), no backend env vars in frontend `.env`, every service has a test |
| `coherence` | 2 rules | Every vitest `include` glob must match a file (the "ran zero tests and passed" bug); paths quoted in maintained markdown must exist |
| `server-layer-leak` | 1 rule | No server module reachable from a client bundle |
| `route-style` | 1 rule | An API route serving your own UI should be a remote function (standalone mode only) |
| `error-flow` | 1 rule | Raw HTTP status codes must not leak past error handlers |
| `typography` | 1 rule | No arbitrary type sizes |
| `spacing` | 1 rule | No arbitrary spacing values |
| `suppression` | 3 rules | Every `chisel-ignore` states a reason, suppresses something, and names a real rule |
| `models` | 3 rules | Models hold data: no procedures, classes, mutable state or `instanceof` |
| `fail-loudly` | 1 rule | A `catch` rethrows or returns a failure result the caller must read |
| `agent` | 1 rule | Agent tools and protocol servers are built only in the declared adapters |
| `checker` | 1 rule | A file that does not parse is reported, not silently skipped |
| `bundle` | 1 rule | Client chunks over 500 kB containing application code. Run separately via `chisel-js bundle` after a production build |

One further category, `api-endpoints` (1 rule: `RequestHandler` exports only in
`src/routes/api/`), is active only in `sveltekit-bff` mode and so does not
appear in the standalone listing above.

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
