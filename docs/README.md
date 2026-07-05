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

The `prebuild` step regenerates two reference pages from sources at the repo
root so the docs never drift:

- `reference/constraints.md` ← `../constraints.md` (the canonical spec)
- `reference/python-rules.md` and `reference/js-rules.md` ←
  `scripts/data/{py,js}-rules.json` (snapshots of `chisel rules --json`
  and `chisel-js rules --json`)

## Keeping the rule pages in sync

After a chisel or chisel-js release, refresh the rule snapshots and rebuild:

```bash
# capture fresh JSON (run from this directory)
chisel    rules --json > scripts/data/py-rules.json
chisel-js rules --json > scripts/data/js-rules.json
bun run sync-rules          # regenerates the two rules pages
bun run build               # verify the site builds cleanly
```

`reference/constraints.md` refreshes automatically on every build from
`../constraints.md`, so you only need to edit that file at the repo root.

## Deploy

GitHub Actions workflow at `../.github/workflows/docs.yml` builds the site
and pushes it to the `gh-pages` branch on every push to `master` that
touches `docs/` or `constraints.md`. GitHub Pages serves the `gh-pages`
branch. Pull requests also get a build-only check (no deploy).