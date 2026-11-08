// Call graph rules. Pure: no DOM. The page runs it for its check line; the check script runs it in node:vm.
(function (root) {
	const BUILTINS = new Set([
		'string',
		'number',
		'boolean',
		'void',
		'null',
		'undefined',
		'unknown',
		'never',
		'any',
		'bigint',
		'object',
		'true',
		'false'
	]);
	const STATUSES = ['planned', 'interface', 'built'];
	// Identifiers of a type expression. String literals, field paths (.id) and object keys (id:) are not types.
	const stripType = (t) =>
		String(t)
			.replace(/'[^']*'|"[^"]*"/g, ' ')
			.replace(/\.[A-Za-z_]\w*/g, ' ')
			.replace(/\b[A-Za-z_]\w*\??\s*:/g, ' ');
	const typeIdents = (t) => stripType(t).match(/[A-Za-z_]\w*/g) || [];
	// Capitalised identifiers of free text (the label on a step arrow).
	const capIdents = (t) =>
		String(t)
			.replace(/'[^']*'/g, ' ')
			.replace(/\.[A-Za-z_]\w*/g, ' ')
			.match(/\b[A-Z]\w*/g) || [];
	const methodNames = (m) => [...String(m).matchAll(/([A-Za-z_]\w*)\s*\(/g)].map((x) => x[1]);
	const itemsOf = (st) => st.alt || [st];
	const sentences = (ps) =>
		(ps || [])
			.join(' ')
			.split(/[.!?](?:\s|$)/)
			.filter((x) => x.trim()).length;
	const signature = (m) =>
		`${m.name}(${(m.params || []).map((p) => `${p.name}: ${p.type}`).join(', ')}): ${m.returns}`;

	function index(d) {
		const typeNames = new Map();
		(d.models || []).forEach((m) =>
			m.names.forEach((n) => typeNames.set(n, { kind: 'model', model: m }))
		);
		(d.externals || []).forEach((x) => typeNames.set(x.name, { kind: 'external', external: x }));
		const serviceMethods = {};
		Object.entries(d.services || {}).forEach(([k, s]) => {
			serviceMethods[k] = new Map();
			Object.entries(s.caps || {}).forEach(([cap, ms]) =>
				ms.forEach((m) => serviceMethods[k].set(m.name, { cap, method: m }))
			);
		});
		const pure = new Map((d.pure || []).map((p) => [p.name, p]));
		return { typeNames, serviceMethods, pure };
	}

	function validateGraph(d) {
		const problems = [];
		const ix = index(d);
		const unique = (label, ids) => {
			const seen = new Set();
			ids.forEach((id) => {
				if (seen.has(id)) problems.push(`Duplicate ${label} "${id}"`);
				seen.add(id);
			});
		};
		unique(
			'entry id',
			(d.entries || []).map((e) => e.id)
		);
		unique(
			'controller key',
			(d.controllers || []).map((c) => c.key)
		);
		unique(
			'repository or provider id',
			(d.repos || []).map((r) => r.id)
		);
		unique(
			'store id',
			(d.stores || []).map((s) => s.id)
		);
		unique(
			'model id',
			(d.models || []).map((m) => m.id)
		);
		unique('type name', [
			...(d.models || []).flatMap((m) => m.names),
			...(d.externals || []).map((x) => x.name)
		]);

		const checkType = (where, t) => {
			if (t === undefined || t === null || t === '') {
				problems.push(`${where} has no type`);
				return;
			}
			typeIdents(t).forEach((id) => {
				if (!BUILTINS.has(id) && !ix.typeNames.has(id))
					problems.push(`${where}: unknown type "${id}" (add a model or an external)`);
			});
		};
		const checkMethod = (where, m, needWhat) => {
			(m.params || []).forEach((p) => checkType(`${where} parameter ${p.name}`, p.type));
			checkType(`${where} result`, m.returns);
			if (needWhat && !(m.what || '').trim()) problems.push(`${where} has no explanation ("what")`);
			if (m.status && !STATUSES.includes(m.status))
				problems.push(`${where} has unknown status "${m.status}"`);
		};

		const controllerKeys = new Set((d.controllers || []).map((c) => c.key));
		(d.entries || []).forEach((e) =>
			e.calls.forEach((c) => {
				if (!controllerKeys.has(c))
					problems.push(`Entry ${e.name} calls unknown controller "${c}"`);
			})
		);

		(d.controllers || []).forEach((c) => {
			if (!STATUSES.includes(c.status)) problems.push(`${c.name} has unknown status "${c.status}"`);
			if (sentences(c.why) < 2)
				problems.push(
					`${c.name} needs a "why" of at least two sentences: the need it serves and how it fits`
				);
			const want = (d.contracts || {})[c.contract];
			const have = c.ops.map((o) => o.name);
			if (!want) problems.push(`${c.name} implements unknown contract "${c.contract}"`);
			else {
				want.forEach((m) => {
					if (!have.includes(m))
						problems.push(`${c.name}.${m} is in ${c.contract} but has no diagram`);
				});
				have.forEach((m) => {
					if (!want.includes(m))
						problems.push(`${c.name}.${m} has a diagram but is not in ${c.contract}`);
				});
			}
			c.ops.forEach((o) => {
				checkMethod(`${c.name}.${o.name}`, o, true);
				o.steps.forEach((st, i) => {
					capIdents(st.pass).forEach((id) => {
						if (!ix.typeNames.has(id))
							problems.push(`${c.name}.${o.name} step ${i + 1}: unknown type "${id}" on the arrow`);
					});
					itemsOf(st).forEach((it) => {
						if (it.s === 'pure') {
							methodNames(it.m).forEach((n) => {
								if (!ix.pure.has(n))
									problems.push(`${c.name}.${o.name} step ${i + 1}: unknown pure rule "${n}"`);
							});
						} else if (!ix.serviceMethods[it.s]) {
							problems.push(`${c.name}.${o.name} step ${i + 1}: unknown service "${it.s}"`);
						} else {
							const names = methodNames(it.m);
							if (!names.length)
								problems.push(`${c.name}.${o.name} step ${i + 1}: "${it.m}" names no method`);
							names.forEach((n) => {
								if (!ix.serviceMethods[it.s].has(n))
									problems.push(`${c.name}.${o.name} step ${i + 1}: ${it.s} has no method "${n}"`);
							});
						}
					});
				});
			});
		});

		const repoIds = new Set((d.repos || []).map((r) => r.id));
		const owners = {};
		Object.entries(d.services || {}).forEach(([k, s]) => {
			if (!STATUSES.includes(s.status)) problems.push(`${s.cls} has unknown status "${s.status}"`);
			if (!(s.what || '').trim()) problems.push(`${s.cls} has no explanation ("what")`);
			(s.owns || []).forEach((r) => {
				if (!repoIds.has(r)) problems.push(`${s.cls} owns unknown repository or provider "${r}"`);
				(owners[r] ||= []).push(k);
			});
			Object.entries(s.caps || {}).forEach(([cap, ms]) =>
				ms.forEach((m) => checkMethod(`${s.cls}.${m.name} (${cap})`, m, true))
			);
		});
		const storeIds = new Set((d.stores || []).map((s) => s.id));
		(d.repos || []).forEach((r) => {
			if (!storeIds.has(r.store)) problems.push(`${r.name} reaches unknown store "${r.store}"`);
			if (!owners[r.id]) problems.push(`${r.name} is owned by no service`);
			if (r.kind === 'provider' && (owners[r.id] || []).length > 1)
				problems.push(
					`Provider ${r.name} is owned by ${owners[r.id].length} services; a provider belongs to exactly one`
				);
			(r.methods || []).forEach((m) => checkMethod(`${r.name}.${m.name}`, m, false));
		});
		(d.pure || []).forEach((p) => {
			if (!(p.what || '').trim()) problems.push(`Pure rule ${p.name} has no explanation ("what")`);
		});
		(d.models || []).forEach((m) => {
			if (!(m.what || '').trim()) problems.push(`Model ${m.title} has no explanation ("what")`);
		});
		return problems;
	}

	root.CallGraph = {
		BUILTINS,
		STATUSES,
		typeIdents,
		capIdents,
		methodNames,
		itemsOf,
		signature,
		index,
		validateGraph
	};
})(globalThis);
