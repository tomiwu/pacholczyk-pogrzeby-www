import js from "@eslint/js";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores([
    "out/**",
    ".next/**",
    ".sandcastle/**",
    ".lighthouseci/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
  js.configs.recommended,
  ...nextVitals,
  ...nextTs,
  // eslint-config-next already registers the jsx-a11y plugin. Add only the strict rules.
  { rules: jsxA11y.flatConfigs.strict.rules },
  prettier,
]);
