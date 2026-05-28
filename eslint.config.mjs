import js from "@eslint/js";
import globals from "globals";
import css from "@eslint/css";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";

export default defineConfig([
    globalIgnores([
        "*",
        "!config",
        "!helper"
    ]),
  { files: ["**/*.{js,mjs,cjs}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: {...globals.browser, ...globals.node} } },
  { files: ["**/*.js"], languageOptions: { sourceType: "commonjs" } },
  { files: ["**/*.css"], plugins: { css }, language: "css/css", extends: ["css/recommended"] },
  prettier,
]);
