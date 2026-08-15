export default {
  test: {
    // Both globs match real files in this tree, which is what keeps
    // coherence:empty-test-glob quiet. A glob that matches nothing is a suite
    // that silently never runs.
    include: ["src/**/*.spec.ts"],
    exclude: ["src/**/*.svelte.spec.ts"],
  },
};
