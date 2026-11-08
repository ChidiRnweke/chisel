# Call graph data schema

The data block is JSON: `<script type="application/json" id="call-graph-data">`. Keys marked `?`
are optional. `assets/example-data.json` shows every field in use.

## Shared shapes

```ts
type Param = { name: string; type: string }; // type: a type expression, e.g. "NodeId | null"
type Method = {
	name: string;
	params: Param[];
	returns: string; // a type expression; "void" when nothing returns
	what?: string; // required on controller operations and service methods: effect and rule
	status?: 'planned' | 'interface' | 'built'; // a method planned inside a built service
};
type Glyph = string; // an icon of the template: a bare name ("cart") is g-cart; "i-…" is a kind icon
```

Glyphs in the template: `branch document clip bookmark search pulse folder terminal refresh clock
function monitor braces robot pin cloud cart card user mail lock`, and the kind icons `i-entry
i-controller i-service i-repository i-provider i-store i-model i-tx i-caller i-factory`.

## Top level

```ts
{
  project: {
    name: string;                       // the page title is "<name> Call Graph"
    eyebrow?: string;                   // the line above the title: scope and date checked
    intro?: string[];                   // paragraphs; trusted HTML
    facts?: { glyph?: Glyph; html: string }[];
    rule?: string;                      // overrides the banner text; trusted HTML
  };
  layers?: Layer[];                     // the "how to read it" cards
  entries: Entry[];
  controllers: Controller[];
  contracts: { [contract: string]: string[] };   // the operation names each contract declares
  services: { [key: string]: Service };          // the key is the name used in steps
  repos: Repo[];                                 // repositories and providers
  stores: Store[];
  models: Model[];
  externals?: { name: string; what?: string }[]; // language and SDK types
  pure?: { name: string; what: string; lives?: string }[]; // functions without I/O used as steps
}
```

## Parts

```ts
type Layer = {
	glyph?: Glyph;
	title: string;
	what: string;
	may: string;
	never: string;
	where?: string;
	see?: string;
};

type Entry = {
	id: string;
	name: string;
	sub?: string;
	glyph?: Glyph;
	where: string[]; // files
	what: string;
	calls: string[]; // controller keys
};

type Controller = {
	key: string;
	name: string;
	contract: string;
	plan: string;
	status: Status;
	glyph?: Glyph;
	what: string; // one sentence
	why: string[]; // 2–4 sentences in one or more paragraphs
	proposal?: true; // not decided yet; listed under Proposals
	reachedFrom?: { [door: string]: string[] }; // e.g. { "REST": ["POST /orders"], "MCP": [] }
	lives?: string;
	ops: (Method & { steps: Step[] })[];
};

type Step = {
	s: string; // a service key, or "pure" for a pure rule
	m: string; // the call as shown, e.g. "get(id)"; every name( must exist
	pass: string; // the label on the arrow: the model handed over, e.g. "Node → NodeId[]"
	tx?: number; // steps with the same number share one transaction
	cond?: true; // runs only on one branch (dashed box)
	note?: string;
	reuse?: 'reused' | 'new'; // proposals only
	alt?: { s: string; m: string; note?: string }[]; // one of several services runs (by item kind)
};

type Service = {
	cls: string;
	plan: string;
	status: Status;
	glyph?: Glyph;
	color?: string; // color: a CSS colour; default from the palette
	what: string;
	owns: string[]; // repo ids
	lives?: string;
	caps: { [capability: string]: Method[] }; // every method needs what
};

type Repo = {
	id: string;
	name: string;
	kind: 'repository' | 'provider';
	store: string;
	note?: string;
	lives?: string;
	methods: Method[];
};

type Store = { id: string; name: string; sub?: string; glyph?: Glyph; row?: number; what: string };
// row: vertical position in map rows; default: the middle of the repos that reach it

type Model = {
	id: string;
	domain: string;
	title: string;
	names: string[]; // every type name this model covers
	what: string;
	def: string; // def: the type source, shown as is with names linked
	lives?: string;
};

type Status = 'planned' | 'interface' | 'built';
```

## Deep links

`#model-<id>`, `#controller-<key>`, `#service-<key>`, `#part-<repo id>`, `#store-<id>` and
`#entry-<id>` open that item when the page loads.
