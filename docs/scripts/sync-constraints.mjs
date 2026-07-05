#!/usr/bin/env bun
/**
 * sync-constraints.mjs
 *
 * Copy ../../constraints.md (the canonical rule spec at the repo root) into
 * the Starlight docs as reference/constraints.mdx, prepending Starlight
 * frontmatter. Run automatically as a `prebuild` step so the docs site
 * never drifts from the source of truth.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const source = join(root, '..', 'constraints.md');
const outDir = join(root, 'src', 'content', 'docs', 'reference');
const out = join(outDir, 'constraints.md');
// Remove any stale .mdx copy from older builds.
import { rmSync, existsSync } from 'node:fs';
const staleMdx = join(outDir, 'constraints.mdx');
if (existsSync(staleMdx)) rmSync(staleMdx);

const body = readFileSync(source, 'utf8');

const frontmatter = `---
title: Constraints spec
description: The canonical architectural rules both checkers implement. Mirrors constraints.md at the repo root.
sidebar:
  order: 2
tableOfContents:
  minHeadingLevel: 2
  maxHeadingLevel: 3
---

:::note[Source of truth]
This page is a rendered copy of [\`constraints.md\`](https://github.com/ChidiRnweke/chisel/blob/master/constraints.md) at the repo root. Edit it there — the docs site refreshes automatically on build.
:::

`;

writeFileSync(out, frontmatter + body + '\n');
console.log(`Wrote ${out} (${body.length} bytes from ${source}).`);