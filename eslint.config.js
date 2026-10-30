// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
      // Off: the app is an NgModule app by design -- every component and the pipe is declared in
      // AppModule with `standalone: false` (see CLAUDE.md, Architecture).
      "@angular-eslint/prefer-standalone": "off",
      // Off: every component is ChangeDetectionStrategy.Eager on purpose, which keeps the
      // pre-Angular-22 change detection. OnPush would be a behaviour change, not a lint fix.
      "@angular-eslint/prefer-on-push-component-change-detection": "off",
      // Off: constructor injection is the house style throughout; moving to inject() is a
      // separate refactor (`ng generate @angular/core:inject`), not part of the upgrade.
      "@angular-eslint/prefer-inject": "off",
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {},
  }
]);
