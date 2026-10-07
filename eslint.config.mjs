import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [{
    ignores: [
        "src/ha/**", // Home Assistant source code
        "**/languages/*.json", // json localization
        "dist", // release
        "*.config.js", // config file
        "*.config.mjs", // config file
        "scripts/**", // node tooling, not part of the card
        "test-ha/**" // testing Home Assistant instance (config + Playwright scripts)
    ],
}, ...typescriptEslint.configs["flat/recommended"], {
    languageOptions: {
        parser: tsParser,
        ecmaVersion: 2020,
        sourceType: "module",

        parserOptions: {
            project: "./tsconfig.json",
        },
    },

    rules: {
        "@typescript-eslint/no-non-null-assertion": "off",
        "linebreak-style": ["error", "unix"],
        "@/indent": ["error", 4, { "SwitchCase": 1 }],
        "@/comma-dangle": ["error", "never"],
        "@/quotes": ["error", "single", { "avoidEscape": true }],
        "@/semi": ["error", "always"],
        "eqeqeq": ["error", "always", { "null": "ignore" }],
        "no-console": "error",
        "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "as" }],

        "no-underscore-dangle": ["error", {
            allow: [
                "_containers",
                "_args",
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

        "@/keyword-spacing": ["error", {
            overrides: {
                this: {
                    before: false,
                },
            },
        }],

        "@typescript-eslint/explicit-member-accessibility": "error",
        "@/brace-style": ["error", "stroustrup"],

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