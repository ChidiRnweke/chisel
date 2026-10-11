import { describe, expect, it } from "bun:test";
import {
	analyzeContrast,
	compositeLuminance,
	contrastRatio,
	oklchToSrgb,
	relativeLuminance
} from "chisel/checker/services/svelte/design_tokens_rules";
import { DesignTokensService } from "chisel/checker/services/svelte/design_tokens";
import { SuppressionService } from "chisel/checker/services/shared/suppression";
import { classifyFile } from "chisel/checker/repositories/file_discovery";
import { createProjectInfo } from "chisel/checker/models/project_info";
import { parsedFile } from "../../fakes/parsed_file";

/**
 * Ported case for case from FollowThrough's `scripts/audit-ui.spec.ts`, with its
 * design-system facts: the vendored editor folder and its type-scale utilities.
 * Each case runs the rules and the suppression service together.
 */
const service = new DesignTokensService({
	tokens: "src/routes/layout.css",
	vendored: ["src/lib/components/edra/"],
	headingUtilities: ["page-title", "section-title", "eyebrow", "provenance-caption"],
	displayUtilities: ["page-title", "section-title"],
});
const known = [...service.describeRules(), ...new SuppressionService().describeRules()].map((rule) => rule.id);

const analyzeFile = (path: string, text: string) => {
	const project = path.endsWith(".css")
		? createProjectInfo({ rootPath: "/app", stylesheets: [{ path, source: text }] })
		: createProjectInfo({
				rootPath: "/app",
				files: [parsedFile({ path, source: text, layer: classifyFile(path).layer })],
			});
	return new SuppressionService().check(service.check(project), new Map([[path, text]]), known);
};

const svelte = (text: string) => analyzeFile("src/lib/components/example/example.svelte", text);
const css = (text: string) => analyzeFile("src/lib/components/example/example.css", text);
const uiSvelte = (text: string) => analyzeFile("src/lib/components/ui/example/example.svelte", text);

describe('no-raw-font-family', () => {
	it('rejects font-serif in markup', () => {
		expect(svelte('<h1 class="font-serif text-4xl">Hi</h1>')).toHaveLength(1);
	});
	it('rejects font-mono inside a markup expression', () => {
		expect(svelte("<div class={cn('p-2', flat && 'font-mono text-xs')}></div>")).toHaveLength(1);
	});
	it('rejects font-sans in a script variant definition', () => {
		expect(svelte("<script>const c = 'font-sans text-sm'</script>")).toHaveLength(1);
	});
	it('ignores prose mentioning the class', () => {
		expect(svelte('<p>Use the page-title utility instead.</p>')).toHaveLength(0);
	});
	it('allows a reasoned HTML-comment allowance', () => {
		expect(
			svelte(
				'<!-- chisel-ignore design-system:no-raw-font-family -- Key caps are chrome, not code. -->\n<kbd class="font-sans"></kbd>'
			)
		).toHaveLength(0);
	});
});

describe('font-weight-bounds', () => {
	it('rejects font-light in markup', () => {
		expect(svelte('<p class="font-light">x</p>')).toHaveLength(1);
	});
	it('rejects a CSS weight below 400', () => {
		expect(css('.a { font-weight: 300 }')).toHaveLength(1);
	});
	it('rejects a CSS weight above 800', () => {
		expect(css('.a { font-weight: 900 }')).toHaveLength(1);
	});
	it('allows 400–800', () => {
		expect(css('.a { font-weight: 600 }')).toHaveLength(0);
	});
	it('ignores custom properties carrying a weight', () => {
		expect(css(':root { --note-h1-font-weight: 800 }')).toHaveLength(0);
	});
});

describe('no-em-font-size', () => {
	it('rejects em font-size in CSS', () => {
		expect(css('.a { font-size: 0.875em }')).toHaveLength(1);
	});
	it('allows rem', () => {
		expect(css('.a { font-size: 0.875rem }')).toHaveLength(0);
	});
	it('allows em for non-font-size properties', () => {
		expect(css('.a { padding: 0 0.3em }')).toHaveLength(0);
	});
});

describe('uppercase-needs-tracking', () => {
	it('rejects uppercase without tracking', () => {
		expect(svelte('<span class="uppercase text-xs">x</span>')).toHaveLength(1);
	});
	it('rejects uppercase with tight tracking', () => {
		expect(svelte('<span class="uppercase tracking-tight">x</span>')).toHaveLength(1);
	});
	it('allows uppercase with wide tracking', () => {
		expect(svelte('<span class="uppercase tracking-wide">x</span>')).toHaveLength(0);
	});
	it('rejects an @apply list with uppercase and no tracking', () => {
		expect(css('.a { @apply uppercase text-xs; }')).toHaveLength(1);
	});
});

describe('no-wide-tracking-on-display', () => {
	it('rejects wide tracking on a display size', () => {
		expect(svelte('<h1 class="text-3xl tracking-wide">x</h1>')).toHaveLength(1);
	});
	it('rejects wide tracking on page-title', () => {
		expect(svelte('<h1 class="page-title tracking-wider">x</h1>')).toHaveLength(1);
	});
	it('allows wide tracking at body size', () => {
		expect(svelte('<span class="text-sm tracking-wide">x</span>')).toHaveLength(0);
	});
});

describe('no-hex-rgb-color', () => {
	it('rejects a hex literal in markup', () => {
		expect(svelte('<meta content="#0f766e" />')).toHaveLength(1);
	});
	it('rejects rgba() in CSS', () => {
		expect(css('.a { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05) }')).toHaveLength(1);
	});
	it('allows oklch tokens', () => {
		expect(css('.a { color: oklch(0.5 0.1 200) }')).toHaveLength(0);
	});
	it('skips the vendored syntax theme', () => {
		expect(
			analyzeFile('src/lib/components/edra/onedark.css', '.a { color: #383a42 }')
		).toHaveLength(0);
	});
	it('ignores HTML entities', () => {
		expect(svelte('<p>Tom &#38; Jerry</p>')).toHaveLength(0);
	});
});

describe('no-runtime-color-derivation', () => {
	it('rejects color-mix of two colors', () => {
		expect(
			css('.a { color: color-mix(in oklch, var(--primary) 25%, var(--muted-foreground)) }')
		).toHaveLength(1);
	});
	it('allows a token washed toward transparent', () => {
		expect(
			css('.a { background: color-mix(in oklab, var(--color-brand) 10%, transparent) }')
		).toHaveLength(0);
	});
	it('rejects lighten', () => {
		expect(css('.a { color: lighten(red, 10%) }')).toHaveLength(1);
	});
	it('rejects oklch relative syntax', () => {
		expect(css('.a { color: oklch(from var(--x) l c h) }')).toHaveLength(1);
	});
});

describe('no-pure-black', () => {
	it('rejects bg-black with an alpha step', () => {
		expect(svelte('<div class="bg-black/80"></div>')).toHaveLength(1);
	});
	it('rejects #000 in CSS under both color rules', () => {
		expect(css('.a { color: #000 }')).toHaveLength(2);
	});
	it('rejects the black keyword as a color value', () => {
		expect(css('.a { border: 1px solid black }')).toHaveLength(1);
	});
	it('rejects oklch(0 0 0)', () => {
		expect(css('.a { color: oklch(0 0 0) }')).toHaveLength(1);
	});
	it('allows near-black tokens', () => {
		expect(css('.a { color: oklch(0.153 0.006 107.1) }')).toHaveLength(0);
	});
});

describe('token-contrast-aa color math', () => {
	it('computes 21:1 for white on black', () => {
		expect(
			contrastRatio(
				relativeLuminance({ l: 1, c: 0, h: 0 }),
				relativeLuminance({ l: 0, c: 0, h: 0 })
			)
		).toBeCloseTo(21, 0);
	});
	it('converts the brand teal to the expected sRGB channels', () => {
		expect(oklchToSrgb(0.511, 0.096, 186.391)).toEqual([0, 120, 111]);
	});
	it('composites an alpha wash over its surface', () => {
		expect(compositeLuminance({ l: 1, c: 0, h: 0 }, { l: 0, c: 0, h: 0 }, 0.5)).toBeCloseTo(0.5, 5);
	});
});

const PALETTE = (mutedForeground: string, extraDark = '') => `:root {
	--background: oklch(0.992 0.004 106.5);
	--foreground: oklch(0.153 0.006 107.1);
	--card: oklch(0.992 0.004 106.5);
	--muted: oklch(0.966 0.005 106.5);
	--muted-foreground: ${mutedForeground};
	--primary: oklch(0.511 0.096 186.391);
	--primary-foreground: oklch(0.984 0.014 180.72);
	--destructive: oklch(0.577 0.245 27.325);
	--destructive-foreground: oklch(0.985 0 0);
	--sidebar: oklch(0.978 0.005 106.5);
	--sidebar-foreground: oklch(0.153 0.006 107.1);
	--brand: oklch(0.511 0.096 186.391);
	--brand-muted-foreground: oklch(0.43 0.055 186.391);
	--destructive-muted-foreground: oklch(0.48 0.075 27.325);
}
.dark {
	--background: oklch(0.153 0.006 107.1);
	--foreground: oklch(0.988 0.003 106.5);
	--card: oklch(0.228 0.013 107.4);
	--muted: oklch(0.286 0.016 107.4);
	--muted-foreground: oklch(0.737 0.021 106.9);
	--primary: oklch(0.437 0.078 188.216);
	--primary-foreground: oklch(0.984 0.014 180.72);
	--destructive: oklch(0.704 0.191 22.216);
	--destructive-foreground: oklch(0.153 0.006 107.1);
	--sidebar: oklch(0.228 0.013 107.4);
	--sidebar-foreground: oklch(0.988 0.003 106.5);
	--brand-muted-foreground: oklch(0.88 0.065 182.503);
	--destructive-muted-foreground: oklch(0.8 0.065 22.216);
	${extraDark}
}`;

describe('token-contrast-aa', () => {
	it('passes a conforming palette', () => {
		expect(
			analyzeContrast(PALETTE('oklch(0.54 0.031 107.3)', '--brand: oklch(0.85 0.14 182.503);'))
		).toHaveLength(0);
	});
	it('rejects a sub-AA muted-foreground', () => {
		expect(
			analyzeContrast(PALETTE('oklch(0.9 0.031 107.3)', '--brand: oklch(0.85 0.14 182.503);'))
				.length
		).toBeGreaterThan(0);
	});
	it('reports a missing token instead of skipping the pair', () => {
		expect(analyzeContrast(':root { --foreground: oklch(0.1 0 0) }').length).toBeGreaterThan(0);
	});
	it('flags a brand that washes out on its own wash', () => {
		expect(
			analyzeContrast(
				PALETTE('oklch(0.54 0.031 107.3)', '--brand: oklch(0.704 0.14 182.503);')
			).some((v) => v.message.includes('wash'))
		).toBe(true);
	});
});

describe('heading-needs-utility', () => {
	it('rejects a bare heading', () => {
		expect(svelte('<h2>Title</h2>')).toHaveLength(1);
	});
	it('rejects a heading with only layout classes', () => {
		expect(svelte('<h3 class="mt-4 flex">Title</h3>')).toHaveLength(1);
	});
	it('allows a named type utility', () => {
		expect(svelte('<h1 class="page-title">Title</h1>')).toHaveLength(0);
	});
	it('allows an explicit text size', () => {
		expect(svelte('<h2 class="text-xl font-semibold">Title</h2>')).toHaveLength(0);
	});
	it('allows sr-only headings', () => {
		expect(svelte('<h2 class="sr-only">Title</h2>')).toHaveLength(0);
	});
});

describe('justify-needs-hyphens', () => {
	it('rejects text-justify without hyphens-auto', () => {
		expect(svelte('<p class="text-justify">x</p>')).toHaveLength(1);
	});
	it('allows text-justify with hyphens-auto', () => {
		expect(svelte('<p class="text-justify hyphens-auto">x</p>')).toHaveLength(0);
	});
	it('rejects text-align: justify without hyphens in the same rule', () => {
		expect(css('.a { text-align: justify }')).toHaveLength(1);
	});
	it('allows text-align: justify with hyphens: auto', () => {
		expect(css('.a { text-align: justify; hyphens: auto }')).toHaveLength(0);
	});
});

describe('text-shadow-glow-only', () => {
	it('rejects an offset text-shadow', () => {
		expect(css('.a { text-shadow: 1px 1px 2px oklch(0.5 0 0) }')).toHaveLength(1);
	});
	it('rejects a tight blur', () => {
		expect(css('.a { text-shadow: 0 0 4px oklch(0.5 0 0) }')).toHaveLength(1);
	});
	it('allows a soft glow', () => {
		expect(css('.a { text-shadow: 0 0 12px oklch(0.5 0 0) }')).toHaveLength(0);
	});
});

describe('no-accent-bars', () => {
	it('rejects a thick colored side border in markup', () => {
		expect(svelte('<div class="border-l-4 border-brand pl-3">x</div>')).toHaveLength(1);
	});
	it('allows a neutral side border', () => {
		expect(svelte('<blockquote class="border-l-2 border-border pl-3">x</blockquote>')).toHaveLength(
			0
		);
	});
	it('rejects a hand-written colored side border in CSS', () => {
		expect(css('.a { border-left: 3px solid var(--color-success) }')).toHaveLength(1);
	});
	it('rejects a colored edge bar drawn by a pseudo-element', () => {
		expect(
			css(
				".a[data-active='true']::before { content: ''; position: absolute; inset-inline-start: 0; width: 2px; background-color: var(--color-brand); }"
			)
		).toHaveLength(1);
	});
	it('allows a neutral pseudo-element edge', () => {
		expect(
			css(
				".a::before { content: ''; position: absolute; left: 0; width: 2px; background-color: var(--color-border); }"
			)
		).toHaveLength(0);
	});
	it('allows a 1px colored pseudo-element divider', () => {
		expect(
			css(
				".a::after { content: ''; position: absolute; left: 0; width: 1px; background-color: var(--color-brand); }"
			)
		).toHaveLength(0);
	});
	it('allows a wide colored pseudo-element', () => {
		expect(
			css(
				".a::after { content: ''; position: absolute; left: 0; width: 16px; background-color: var(--color-brand); }"
			)
		).toHaveLength(0);
	});
});

describe('no-ad-hoc-shadow', () => {
	it('rejects a shadow class in app code', () => {
		expect(svelte('<div class="shadow-md">x</div>')).toHaveLength(1);
	});
	it('allows shadows in the vendored ui primitives', () => {
		expect(uiSvelte('<div class="shadow-md">x</div>')).toHaveLength(0);
	});
	it('allows shadow-none', () => {
		expect(svelte('<div class="shadow-none">x</div>')).toHaveLength(0);
	});
	it('rejects a bespoke box-shadow in a component style block', () => {
		expect(
			svelte('<div>x</div><style>.a { box-shadow: 0 1px 2px var(--color-border) }</style>')
		).toHaveLength(1);
	});
	it('allows box-shadow removal', () => {
		expect(svelte('<div>x</div><style>.a { box-shadow: none }</style>')).toHaveLength(0);
	});
});

describe('alpha-fixed-steps', () => {
	it('rejects an off-ladder alpha step', () => {
		expect(svelte('<div class="bg-brand/12">x</div>')).toHaveLength(1);
	});
	it('allows a sanctioned step', () => {
		expect(svelte('<div class="bg-brand/10 dark:bg-brand/15">x</div>')).toHaveLength(0);
	});
	it('ignores fractions that are not color alpha', () => {
		expect(svelte('<div class="w-1/2">x</div>')).toHaveLength(0);
	});
	it('checks alpha steps inside @apply', () => {
		expect(css('.a { @apply bg-brand/12; }')).toHaveLength(1);
	});
});

describe('suppressions', () => {
	it('flags a stale allowance', () => {
		expect(
			svelte('<!-- chisel-ignore design-system:no-pure-black -- scrim. -->\n<div class="p-2"></div>')
		).toHaveLength(1);
	});
	it('does not suppress a different rule, and the unused allowance goes stale', () => {
		expect(
			svelte(
				'<!-- chisel-ignore design-system:no-raw-font-family -- display face. -->\n<div class="bg-black"></div>'
			)
		).toHaveLength(2);
	});
	it('honors stacked allowances for two rules on one line', () => {
		expect(
			svelte(
				'<!-- chisel-ignore design-system:no-pure-black -- scrim. -->\n<!-- chisel-ignore design-system:alpha-fixed-steps -- scrim step. -->\n<div class="bg-black/42"></div>'
			)
		).toHaveLength(0);
	});
	it('honors the CSS comment form', () => {
		expect(
			css(
				'/* chisel-ignore design-system:no-hex-rgb-color -- Mask luminance channel. */\n/* chisel-ignore design-system:no-pure-black -- Mask luminance channel. */\n.a { color: #000 }'
			)
		).toHaveLength(0);
	});
	it('honors the line-comment form in script', () => {
		expect(
			svelte(
				"<script>\n// chisel-ignore design-system:no-raw-font-family -- Code surface.\nconst c = 'font-mono';\n</script>"
			)
		).toHaveLength(0);
	});
});
