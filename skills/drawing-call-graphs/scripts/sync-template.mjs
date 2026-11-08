#!/usr/bin/env node
// Build or refresh a call-graph page from the skill template.
//   node sync-template.mjs <page.html>          refresh the renderer, keep the page's data block
//   node sync-template.mjs <page.html> --new    create the page from the example data
// The data block (<script type="application/json" id="call-graph-data">) is the only part a person edits.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const assets = path.join(here, '..', 'assets');
const [page, flag] = process.argv.slice(2);
if (!page) {
	console.error('usage: sync-template.mjs <page.html> [--new]');
	process.exit(2);
}

const DATA_RE = /(<script type="application\/json" id="call-graph-data">)([\s\S]*?)(<\/script>)/;
const VALIDATE_RE = /(<script id="call-graph-validate">)([\s\S]*?)(<\/script>)/;
const template = fs.readFileSync(path.join(assets, 'call-graph.template.html'), 'utf8');
const validate = fs.readFileSync(path.join(assets, 'validate.js'), 'utf8');

let json;
if (flag === '--new') {
	if (fs.existsSync(page)) {
		console.error(`${page} exists; drop --new to refresh it`);
		process.exit(2);
	}
	json = fs.readFileSync(path.join(assets, 'example-data.json'), 'utf8');
} else {
	const m = fs.readFileSync(page, 'utf8').match(DATA_RE);
	if (!m) {
		console.error(`${page} has no call-graph-data block`);
		process.exit(2);
	}
	json = m[2];
}
const data = JSON.parse(json); // fail early on invalid JSON
const name = (data.project && data.project.name) || 'Project';
const escHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const out = template
	.replace(/<title>[^<]*<\/title>/, `<title>${escHtml(name)} Call Graph</title>`)
	.replace(
		DATA_RE,
		(_, a, __, c) => `${a}\n${JSON.stringify(data, null, 1).replace(/<\//g, '<\\/')}\n${c}`
	)
	.replace(VALIDATE_RE, (_, a, __, c) => `${a}\n${validate}${c}`);
fs.writeFileSync(page, out);
console.log(`${flag === '--new' ? 'Created' : 'Refreshed'} ${page}`);
