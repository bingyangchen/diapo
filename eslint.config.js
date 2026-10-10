import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist/", "tests/e2e/.output/", "test-results/"]),

  {
    files: ["**/*.{js,ts,tsx}"],
    extends: [js.configs.recommended],
    plugins: { "simple-import-sort": simpleImportSort },
    rules: {
      curly: ["error", "multi-line"],
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "import", next: "*" },
        { blankLine: "any", prev: "import", next: "import" },
        { blankLine: "always", prev: "function", next: "function" },
        { blankLine: "always", prev: "export", next: "export" },
      ],
    },
  },

  {
    files: ["**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    files: ["src/player/**", "src/site/**", "decks/**", "tests/fixtures/decks/**"],
    extends: [reactHooks.configs.flat["recommended-latest"]],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ["src/build/**", "tests/{unit,integration,e2e}/**", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },

  // Must come last: turns off stylistic rules that would conflict with Prettier.
  prettier,
);
