import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";


export default defineConfig([
    {
        files: ['**/*.ts'],
        ignores: ['**/*.g.d.ts'],
        extends: [
            eslint.configs.recommended,
            tseslint.configs.recommended,
            tseslint.configs.stylistic,
            angular.configs.tsRecommended,
        ],
        processor: angular.processInlineTemplates,
        rules: {
            indent: ["error", 4, { "SwitchCase": 1 }],
            quotes: ["error", "double"],
            "@angular-eslint/component-selector": [
                "error",
                {
                    prefix: "",
                    type: "element",
                    style: "kebab-case",
                },
            ],
            "@angular-eslint/directive-selector": [
                "error",
                {
                    prefix: "",
                    type: "attribute",
                    style: "camelCase",
                },
            ],
            "@typescript-eslint/no-explicit-any": "off", // HM TODO: fix this?
            "@typescript-eslint/no-empty-function": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/consistent-type-definitions": "off",
            "comma-dangle": ["error", "never"]
        },
    },
    {
        files: ["**/*.html"],
        extends: [angular.configs.templateRecommended], //angular.configs.templateAccessibility
        rules: {},
    },
]);
