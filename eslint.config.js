import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * One flat ruleset for the whole monorepo. Type-aware linting is on (projectService)
 * so `no-floating-promises` — the rule that actually matters for Fastify/WS/async —
 * has the type info it needs. We intentionally do NOT enable the full
 * recommendedTypeChecked set (would be a large, separate cleanup); we layer the few
 * high-value typed rules on top of the cheap syntactic ones.
 */
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/dist-tsc/**",
      "**/node_modules/**",
      "**/coverage/**",
      "server/drizzle/**",
      "e2e/**", // Playwright suite — its own runner/types, linted by the playwright run
      "**/playwright-report/**",
      "**/test-results/**",
      "**/*.config.js",
      "**/*.config.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // critical for an async server: a forgotten await on a DB/WS/reply call is a bug
      "@typescript-eslint/no-floating-promises": "error",
      // keep genuine misuse, but allow idiomatic React `onClick={async …}` handlers
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      // `_`-prefixed names are intentional discards (e.g. destructure-to-drop)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // The registry generics and web fetch wrappers use `any` deliberately; a typed
      // pass is its own task (not part of "turn on real lint"). Deferred, not ignored.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Test files are excluded from the build tsconfigs, so type-aware parsing can't
    // place them in a project. Lint them syntactically (no type-info rules).
    files: ["**/*.test.ts", "server/test/**/*.ts"],
    languageOptions: { parserOptions: { projectService: false, project: false } },
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
      "@typescript-eslint/no-misused-promises": "off",
    },
  },
);
