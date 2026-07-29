// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Chisel docs: https://chidirnweke.github.io/chisel
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
				'Deterministic architecture checkers that pair with agent skills. The agent writes, chisel checks, and every violation points to the skill that teaches the pattern.',
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
					label: 'Start here',
					items: [
						{ label: 'Quick start', slug: 'quick-start' },
					],
				},
				{
					label: 'Understand',
					items: [
						{ label: 'How chisel works', slug: 'concepts/how-it-works' },
						{ label: 'Agentic engineering', slug: 'concepts/agentic-engineering' },
						{ label: 'Should you use chisel?', slug: 'concepts/should-you-use-chisel' },
						{ label: 'Architecture', slug: 'concepts/architecture' },
					],
				},
				{
					label: 'Do',
					items: [
						{ label: 'Check a FastAPI backend', slug: 'guides/check-fastapi' },
						{ label: 'Check a SvelteKit frontend', slug: 'guides/check-sveltekit' },
						{ label: 'Give your AI agent the rules', slug: 'guides/install-agent-skills' },
						{ label: 'Understand a violation', slug: 'guides/understand-a-violation' },
						{ label: 'Turn off a rule for a file', slug: 'guides/suppress-a-rule' },
						{ label: 'Block violations before commit', slug: 'guides/block-violations-before-commit' },
						{ label: 'Run chisel in GitHub Actions', slug: 'guides/run-in-github-actions' },
						{ label: 'Upgrade chisel and refresh skills', slug: 'guides/upgrade-chisel' },
					],
				},
				{
					label: 'Look up',
					items: [
						{ label: 'Commands', slug: 'reference/commands' },
						{ label: 'Python rules', slug: 'reference/python-rules' },
						{ label: 'TypeScript rules', slug: 'reference/js-rules' },
					],
				},
			],
		}),
	],
});