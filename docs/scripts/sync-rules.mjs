#!/usr/bin/env bun
/**
 * sync-rules.mjs
 *
 * Regenerate the rule reference pages into src/content/docs/reference/.
 *
 * The JS rules are read from the chisel_js source in this repo when it is
 * present, so the published page cannot drift from the code that defines it.
 * The committed snapshot in `scripts/data/` is the fallback for a docs-only
 * checkout, and CI fails when the two disagree.
 *
 * The Python rules still come from their snapshot: the docs build has bun but
 * no Python toolchain. Refresh it after a release with
 *
 *   PYENV_VERSION=3.12 chisel rules --json > scripts/data/py-rules.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dataDir = join(here, 'data');
const outDir = join(root, 'src', 'content', 'docs', 'reference');
mkdirSync(outDir, { recursive: true });
// Remove stale .mdx copies from older builds.
import { rmSync, existsSync } from 'node:fs';
for (const f of ['python-rules.mdx', 'js-rules.mdx']) {
	const p = join(outDir, f);
	if (existsSync(p)) rmSync(p);
}

const slugify = (s) =>
	s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const humanCategory = (cat) =>
	cat
		.split('-')
		.map((w) => w[0].toUpperCase() + w.slice(1))
		.join(' ');

function groupByCategory(rules) {
	const groups = {};
	for (const r of rules) (groups[r.category] ??= []).push(r);
	return groups;
}

function renderRulesPage({ title, description, cli, snapshot, rules }) {
	const groups = groupByCategory(rules);
	const total = rules.length;
	const cats = Object.keys(groups).sort();

	const head = `---
title: ${title}
description: ${description}
sidebar:
  # Pin order so the reference sidebar stays stable across releases.
  order: ${cli === 'chisel' ? 3 : 4}
tableOfContents:
  minHeadingLevel: 2
  maxHeadingLevel: 3
---

:::note[Snapshot]
This page mirrors \`${snapshot}\` captured at release time. Run \`${cli} rules --json\` to see the live list for your installed version.
:::

${total} rules across ${cats.length} categories, enforced by \`${cli}\`.

`;
	const body = cats
		.map((cat) => {
			const items = groups[cat];
			const heading = `## ${humanCategory(cat)}\n\n\`${cat}\` · ${items.length} rule${items.length === 1 ? '' : 's'}\n\n`;
			const list = items
				.map((r) => {
					const id = r.id;
					const desc = (r.description || '').replace(/\s+/g, ' ').trim();
					const fix = (r.fix_guidance || r.fixGuidance || '')
						.replace(/\s+/g, ' ')
						.trim();
					const skill = r.skill_name || r.skillName;
					const skillLine = skill
						? `\n\n:::tip[Skill]\nTaught by \`${skill}\`. Run \`${cli} setup --target <target>\` to install it.\n:::`
						: '';
					return `### \`${id}\`\n\n${desc}\n\n**Fix.** ${fix}${skillLine}`;
				})
				.join('\n\n');
			return heading + list;
		})
		.join('\n\n');

	return head + body + '\n';
}

/**
 * Ask the chisel-js CLI in this repo for its rules, refreshing the committed
 * snapshot as a side effect. Falls back to the snapshot when the package is
 * not checked out alongside the docs.
 */
function loadJsRules() {
	const snapshot = join(dataDir, 'js-rules.json');
	const cliDir = join(root, '..', 'chisel_js');
	const entry = join(cliDir, 'src', 'chisel', 'cli', 'main.ts');

	if (!existsSync(entry)) {
		console.log('chisel_js not found; using the committed js-rules.json snapshot.');
		return JSON.parse(readFileSync(snapshot, 'utf8'));
	}

	const json = execFileSync('bun', ['run', entry, 'rules', '--json'], {
		cwd: cliDir,
		encoding: 'utf8',
		maxBuffer: 32 * 1024 * 1024,
	});
	writeFileSync(snapshot, json);
	console.log('Refreshed js-rules.json from the chisel-js CLI.');
	return JSON.parse(json);
}

const pyRules = JSON.parse(readFileSync(join(dataDir, 'py-rules.json'), 'utf8'));
const jsRules = loadJsRules();

writeFileSync(
	join(outDir, 'python-rules.md'),
	renderRulesPage({
		title: 'Python rules',
		description:
			'Every rule enforced by `chisel`, grouped by category, with fix guidance.',
		cli: 'chisel',
		snapshot: 'scripts/data/py-rules.json',
		rules: pyRules,
	}),
);

writeFileSync(
	join(outDir, 'js-rules.md'),
	renderRulesPage({
		title: 'TypeScript rules',
		description:
			'Every rule enforced by `chisel-js`, grouped by category, with fix guidance.',
		cli: 'chisel-js',
		snapshot: 'scripts/data/js-rules.json',
		rules: jsRules,
	}),
);

console.log(
	`Wrote python-rules.md (${pyRules.length} rules) and js-rules.md (${jsRules.length} rules).`,
);