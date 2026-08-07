import js from "@eslint/js";
import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      import: importPlugin
    },
    rules: {
      "import/extensions": [
        "error",
        "ignorePackages",
        { js: "always", ts: "never" }
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
      ],
      "no-empty": ["error", { "allowEmptyCatch": true }]
    }
  },
  {
    ignores: ["dist/**", "node_modules/**"]
  }
];
