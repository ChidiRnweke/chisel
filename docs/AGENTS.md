# AGENTS.md — chisel/docs

Starlight (Astro 7) docs site. Source lives under `src/content/docs/`.

## Working on this site

- Package manager: **bun**.
- Start dev server in background mode: `bun run dev`. Don't run a foreground dev server.
- Don't hand-edit generated reference pages:
  - `reference/constraints.md` is regenerated from `../constraints.md` by `scripts/sync-constraints.mjs`.
  - `reference/python-rules.md` and `reference/js-rules.md` are regenerated from `scripts/data/*.json` by `scripts/sync-rules.mjs`.
- To refresh rule page snapshots: `chisel rules --json > scripts/data/py-rules.json` (and the `chisel-js` equivalent), then `bun run sync-rules`.

## Layout

```
docs/
├── astro.config.mjs              # Starlight config: site, base=/chisel, sidebar
├── src/content/docs/
│   ├── index.mdx                  # Landing (splash hero)
│   ├── quick-start.mdx
│   ├── concepts/                  # the "why" — conceptual pages
│   │   └── how-it-works.mdx
│   ├── guides/                    # the "how" — one task-oriented how-to per file
│   │   ├── check-fastapi.mdx
│   │   ├── check-sveltekit.mdx
│   │   ├── understand-a-violation.mdx
│   │   ├── suppress-a-rule.mdx
│   │   ├── block-violations-before-commit.mdx
│   │   ├── run-in-github-actions.mdx
│   │   ├── install-agent-skills.mdx
│   │   └── upgrade-chisel.mdx
│   └── reference/                 # lookup — constraints.md + python-rules/js-rules are generated
├── scripts/
│   ├── sync-constraints.mjs       # copies ../constraints.md → reference/constraints.md
│   ├── sync-rules.mjs             # renders scripts/data/*.json → rules MDX
│   └── data/{py,js}-rules.json    # snapshots of `* rules --json`
└── public/favicon.svg
```

## Astro/Starlight references

- Routing: <https://docs.astro.build/en/guides/routing/>
- Content collections: <https://docs.astro.build/en/guides/content-collections/>
- Starlight components (Tabs, Steps, Badge, Card…): <https://starlight.astro.build/components/>