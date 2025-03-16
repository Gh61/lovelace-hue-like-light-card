import typescriptEslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: ["**/languages/*.json"],
}, ...compat.extends("plugin:@typescript-eslint/recommended"), {
    plugins: {
        "@typescript-eslint": typescriptEslint,
    },

    languageOptions: {
        globals: {
            ...globals.browser,
        },

        parser: tsParser,
        ecmaVersion: 2020,
        sourceType: "module",

        parserOptions: {
            project: "./tsconfig.json",
        },
    },

    linterOptions: {
        reportUnusedDisableDirectives: "off" // until airbnb is migrated to eslint 9
    },

    rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "linebreak-style": ["error", "unix"],
        "@/indent": ["error", 4, { "SwitchCase": 1 }],
        "@/comma-dangle": ["error", "never"],

        "no-underscore-dangle": ["error", {
            allow: [
                "_containers",
                "_args",
                "_instance",
                "_isMouseDown",
                "_wrapper",
                "_lastHash",
                "_isHistoryOverriden",
                "_registeredCards",
            ],

            allowAfterThis: true,
            enforceInMethodNames: true,
            allowFunctionParams: false,
        }],

        "@typescript-eslint/no-unused-expressions": ["error", {
            allowShortCircuit: true,
        }],

        "@typescript-eslint/lines-between-class-members": "off",

        "@/keyword-spacing": ["error", {
            overrides: {
                this: {
                    before: false,
                },
            },
        }],

        "@typescript-eslint/explicit-member-accessibility": "error",
        "@/brace-style": ["error", "stroustrup"],
        "react/jsx-filename-extension": "off",
        "import/extensions": "off",
        "import/no-extraneous-dependencies": "off",

        "@typescript-eslint/no-empty-function": ["error", {
            allow: ["functions", "methods", "private-constructors", "protected-constructors"],
        }],

        "@typescript-eslint/no-unused-vars": ["error", {
            argsIgnorePattern: "^_",
        }],

        "no-restricted-syntax": ["error", {
            selector: "MethodDefinition[static = true] ThisExpression",
            message: "this.member is prohibited for static members. Only ClassName.member is allowed.",
        }],

        "@typescript-eslint/no-use-before-define": ["error", {
            functions: true,
            classes: false,
            variables: true,
            allowNamedExports: false,
        }],
    },
}];