import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["vendor/**", "node_modules/**", "captures/**", "coverage/**"] },
  js.configs.recommended,
  {
    files: ["js/**/*.js", "sw.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.serviceworker },
    },
    rules: {
      eqeqeq: ["error", "smart"],
      "no-var": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
      curly: ["error", "multi-line"],
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      eqeqeq: ["error", "smart"],
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
