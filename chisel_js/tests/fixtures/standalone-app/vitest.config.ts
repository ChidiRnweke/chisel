export default {
  test: {
    // ANTI-PATTERN: this glob matches nothing, so those tests silently do not run.
    include: ["tests/unit/**/*.spec.ts"],
  },
};
