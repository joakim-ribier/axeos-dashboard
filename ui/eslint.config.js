import js from "@eslint/js";
import ts from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-plugin-prettier";
import globals from "globals";
import simpleImportSort from "eslint-plugin-simple-import-sort"; // 👈 ajout

export default [
  // Build output (gitignored, not source) -- "lint ." + --ext .js otherwise
  // picks up the bundled/minified production JS under dist/ and reports
  // thousands of irrelevant errors against it.
  { ignores: ["dist/**", "dist-ssr/**"] },

  js.configs.recommended,

  // --- FRONTEND (React + TypeScript) ---
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser, // ✅ ajoute les globales du navigateur
        ...globals.es2021, // pour Promise, Map, etc.
        React: true, // ✅ Ajoute ceci
        JSX: true, // ✅ Et ceci pour les types TSX
      },
    },
    plugins: {
      "@typescript-eslint": ts,
      react: reactPlugin,
      "react-hooks": reactHooks,
      prettier,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...ts.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "prettier/prettier": "error",

      // --- Tri des imports ✨ ---
      "simple-import-sort/imports": [
        "warn",
        {
          groups: [
            // Packages externes
            ["^react", "^@?\\w"],
            // Imports absolus depuis src/
            ["^(@|src)(/.*|$)"],
            // Imports relatifs : parent, current, siblings
            ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
            ["^\\./(?=.*/)(?!/?$)", "^\\.(?!/?$)", "^\\./?$"],
            // Fichiers de styles
            ["^.+\\.s?css$"],
          ],
        },
      ],
      "simple-import-sort/exports": "warn",

      // 🔹 Règles de confort
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",

      // 🔹 Autorise setState dans un useEffect d’initialisation
      "react-hooks/set-state-in-effect": "off",
    },
    settings: {
      react: { version: "detect" },
    },
  },

  // --- CONFIG FILES (Node) ---
  {
    files: ["*.config.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // --- BACKEND (Node + Express) ---
  {
    files: ["src/server/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      prettier,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...js.configs.recommended.rules,

      "no-undef": "off",
      "no-unused-vars": "warn",

      "prettier/prettier": "error",

      "simple-import-sort/imports": "warn",
      "simple-import-sort/exports": "warn",
    },
  },
];
