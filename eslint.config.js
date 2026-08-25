import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: "latest",
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
    plugins: { react },
    rules: {
      // Without these two, ESLint can't see that a name referenced only
      // inside JSX is used, and reports every `const { icon: Icon }` as
      // dead code. They are the reason this plugin is here.
      "react/jsx-uses-react": "error",
      "react/jsx-uses-vars": "error",

      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Node-executed config files (not shipped to the browser)
    files: ["vite.config.js", "tailwind.config.js", "postcss.config.js"],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
