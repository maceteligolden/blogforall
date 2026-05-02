import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ["dist/**", "node_modules/**"] },
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      // Prefer `logger` in app code; warn (not error) so the logging implementation may use console.
      "no-console": "warn",
      "no-empty-function": ["error", { allow: ["constructors"] }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
    },
  },
  eslintConfigPrettier,
];
