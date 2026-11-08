#!/usr/bin/env node
// Check a call-graph page against the rules in assets/validate.js. No dependencies, no browser.
//   node check-call-graph.mjs <page.html>
// Exit code 0: no problems. 1: problems found (listed). 2: the page cannot be read.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const page = process.argv[2];
if (!page) {
	console.error('usage: check-call-graph.mjs <page.html>');
	process.exit(2);
}
const html = fs.readFileSync(page, 'utf8');
const data = html.match(
	/<script type="application\/json" id="call-graph-data">([\s\S]*?)<\/script>/
);
const rules = html.match(/<script id="call-graph-validate">([\s\S]*?)<\/script>/);
if (!data || !rules) {
	console.error(`${page} is not a call-graph page (data or rules block missing)`);
	process.exit(2);
}

let d;
try {
	d = JSON.parse(data[1]);
} catch (e) {
	console.error(`The data block is not valid JSON: ${e.message}`);
	process.exit(2);
}
const ctx = vm.createContext({});
vm.runInContext(rules[1], ctx);
const problems = ctx.CallGraph.validateGraph(d);

const current = fs.readFileSync(path.join(here, '..', 'assets', 'validate.js'), 'utf8');
if (rules[1].trim() !== current.trim())
	problems.push('The page uses an older renderer; run scripts/sync-template.mjs on it');

const ops = (d.controllers || []).reduce((n, c) => n + c.ops.length, 0);
const methods = Object.values(d.services || {}).reduce(
	(n, s) => n + Object.values(s.caps || {}).flat().length,
	0
);
if (problems.length) {
	console.log(`✗ ${problems.length} problem${problems.length > 1 ? 's' : ''} in ${page}:`);
	problems.forEach((p) => console.log(`  - ${p}`));
	process.exit(1);
}
console.log(
	`✓ ${page}: ${(d.controllers || []).length} controllers, ${ops} operations, ${Object.keys(d.services || {}).length} services, ${methods} service methods, ${(d.models || []).length} models. No problems.`
);
