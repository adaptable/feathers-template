const fs = require("fs");

const tsProject = fs.existsSync("./tsconfig.eslint.json") ?
    "./tsconfig.eslint.json" : "./tsconfig.json";

const config = {
    root: true,
    parser: "@typescript-eslint/parser",
    extends: [
        "airbnb-typescript",
        'plugin:@typescript-eslint/recommended',
        "plugin:react-hooks/recommended",
        "plugin:promise/recommended",
    ],
    env: {
        es6: true,
        node: true,
    },
    parserOptions: {
        ecmaVersion: 2018,
        sourceType: "module",
        ecmaFeatures: {
            jsx: true
        },
        project: tsProject,
    },
    settings: {
        "import/resolver": {
            node: {
                extensions: [".js", ".jsx", ".ts", ".tsx", ".d.ts", ".json"],
                paths: [
                    "./",
                ],
            },
        },
        "react": { "version": "latest" },
    },
    rules: {
        // Next does not require this
        "react/react-in-jsx-scope": "off",

        // Indent=4
        "react/jsx-indent": ["error", 4],
        "react/jsx-indent-props": ["error", 4],
        "@typescript-eslint/indent": ["error", 4],

        // Double quotes
        "@typescript-eslint/quotes": ["error", "double", {
            allowTemplateLiterals: true,
            avoidEscape: true,
        }],

        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-empty-interface": "off",
        "@typescript-eslint/no-floating-promises": "error",

        // Don't require propTypes, but validate if present
        "react/prop-types": ["error", {
            ignore: [],
            customValidators: [],
            skipUndeclared: true,
        }],

        // Don't require defaultProps for function components.
        // The main benefit vs a default value is type checking, which
        // TypeScript handles for us.
        "react/require-default-props": ["error", {
            ignoreFunctionalComponents: true,
        }],

        // Let the TS compiler do this.
        "@typescript-eslint/no-unused-vars": "off",

        // Rules where we just disagree with AirBnB's opinion
        "lines-between-class-members": ["error", "always", {
            exceptAfterSingleLine: true,
        }],
        "max-classes-per-file": "off",
        "no-param-reassign": "off",
        "react/jsx-props-no-spreading": "off",
        "no-underscore-dangle": "off",

        // Removes AirBnB's restriction on for..of, but leaves the other
        // restrictions for this rule type
        "no-restricted-syntax": ["error",
            {
                selector: "ForInStatement",
                message: "for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.",
            },
            {
                selector: "LabeledStatement",
                message: "Labels are a form of GOTO; using them makes code confusing and hard to maintain and understand.",
            },
            {
                selector: "WithStatement",
                message: "`with` is disallowed in strict mode because it makes code impossible to predict and optimize.",
            },
        ],

        "promise/always-return": "off",
        "no-cycle": "off", //Nice but too slow for use in VSCode
    },
};

// Change errors to warnings to work around lack of a VS Code eslint
// extension setting to distinguish lint errors from compile errors.
// If the eslint extension implements something like the tslint extension
// option "tslint.alwaysShowRuleFailuresAsWarnings", this code can be
// removed.
//
// From https://github.com/airbnb/javascript/blob/master/packages/eslint-config-airbnb/whitespace.js
// (MIT license)
const { CLIEngine } = require("eslint");

const severities = ["off", "warn", "error"];

function getSeverity(ruleConfig) {
    if (Array.isArray(ruleConfig)) {
        return getSeverity(ruleConfig[0]);
    }
    if (typeof ruleConfig === "number") {
        return severities[ruleConfig];
    }
    return ruleConfig;
}

function forceToWarnings(cfg) {
    const cli = new CLIEngine({ baseConfig: cfg, useEslintrc: false });
    const baseRules = cli.getConfigForFile(__filename).rules;

    Object.entries(baseRules).forEach((rule) => {
        const ruleName = rule[0];
        const ruleConfig = rule[1];
        const severity = getSeverity(ruleConfig);

        if (severity === "error") {
            if (Array.isArray(ruleConfig)) {
                cfg.rules[ruleName] = ["warn"].concat(ruleConfig.slice(1));
            } else if (typeof ruleConfig === "number") {
                cfg.rules[ruleName] = 1;
            } else {
                cfg.rules[ruleName] = "warn";
            }
        }
    });
}
forceToWarnings(config);

module.exports = config;
