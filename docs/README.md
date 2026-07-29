# Chisel docs

The documentation site for **Chisel**, built with [Astro Starlight](https://starlight.astro.build/).
Published to <https://chidirnweke.github.io/chisel>.

## Run locally

```bash
bun install
bun run dev      # http://localhost:4321/chisel/
```

## Build

```bash
bun run build    # outputs dist/
bun run preview  # serve the built site locally
```

The `prebuild` step regenerates the rule reference pages so the docs never
drift from the checkers:

- `reference/js-rules.md` ← the `chisel-js` CLI in `../chisel_js`, invoked
  directly at build time. The snapshot in `scripts/data/js-rules.json` is
  refreshed as a side effect and is only a fallback for a docs-only checkout.
- `reference/python-rules.md` ← `scripts/data/py-rules.json`, still a snapshot
  because the docs build has bun but no Python toolchain.

## Keeping the rule pages in sync

The TypeScript rules need no manual step — they come from the CLI on every
build, and `ci-js.yml` fails if the committed snapshot has fallen behind.

After a **Python** release, refresh its snapshot:

```bash
chisel rules --json > scripts/data/py-rules.json
bun run sync-rules          # regenerates the two rules pages
bun run build               # verify the site builds cleanly
```

## Deploy

GitHub Actions workflow at `../.github/workflows/docs.yml` builds the site
and pushes it to the `gh-pages` branch on every push to `master` that
touches `docs/` or `chisel_js/`. GitHub Pages serves the `gh-pages`
branch. Pull requests also get a build-only check (no deploy).