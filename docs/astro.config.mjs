// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Chisel docs — https://chidirnweke.github.io/chisel
const REPO = 'https://github.com/ChidiRnweke/chisel';

export default defineConfig({
	site: 'https://chidirnweke.github.io',
	base: '/chisel',
	integrations: [
		starlight({
			title: 'Chisel',
			logo: {
				src: './src/assets/logo.svg',
				replacesTitle: false,
			},
			description:
				'Deterministic architecture constraint checkers that pair with agent skills. The skills teach the pattern — the checker enforces it.',
			social: [
				{ icon: 'github', label: 'GitHub', href: REPO },
			],
			editLink: {
				enable: true,
				label: 'Edit this page on GitHub',
				url: `${REPO}/edit/master/docs/`,
			},
			pagination: true,
			customCss: ['./src/styles/custom.css'],
			sidebar: [
				{
					label: 'Start',
					items: [
						{ label: 'Chisel', slug: 'index' },
						{ label: 'Quick start', slug: 'quick-start' },
					],
				},
				{
					label: 'Concepts',
					items: [
						{ label: 'How chisel works', slug: 'concepts/how-it-works' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Check a FastAPI backend', slug: 'guides/check-fastapi' },
						{ label: 'Check a SvelteKit frontend', slug: 'guides/check-sveltekit' },
						{ label: 'Understand a violation', slug: 'guides/understand-a-violation' },
						{ label: 'Turn off a rule for a file', slug: 'guides/suppress-a-rule' },
						{ label: 'Block violations before commit', slug: 'guides/block-violations-before-commit' },
						{ label: 'Run chisel in GitHub Actions', slug: 'guides/run-in-github-actions' },
						{ label: 'Give your AI agent the rules', slug: 'guides/install-agent-skills' },
						{ label: 'Upgrade chisel and refresh skills', slug: 'guides/upgrade-chisel' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Commands', slug: 'reference/commands' },
						{ label: 'Constraints spec', slug: 'reference/constraints' },
						{ label: 'Python rules', slug: 'reference/python-rules' },
						{ label: 'TypeScript rules', slug: 'reference/js-rules' },
					],
				},
			],
		}),
	],
});