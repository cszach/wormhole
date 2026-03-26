import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import sonarjsPlugin from "eslint-plugin-sonarjs";

export default tseslint.config(
	{
		ignores: ["public/**", "dist/**", "node_modules/**"]
	},
	...tseslint.configs.recommended,
	prettierConfig,
	{
		plugins: {
			import: importPlugin,
			sonarjs: sonarjsPlugin
		},
		rules: {
			// General

			eqeqeq: ["error", "always"],
			"no-var": "error",
			"prefer-const": "error",
			curly: "error",

			// TypeScript

			"@typescript-eslint/no-explicit-any": "error",
			"@typescript-eslint/consistent-type-imports": [
				"error",
				{
					prefer: "type-imports",
					fixStyle: "separate-type-imports"
				}
			],
			"@typescript-eslint/consistent-type-definitions": ["error", "type"],

			// Naming

			"@typescript-eslint/naming-convention": [
				"error",
				{
					selector: "memberLike",
					modifiers: ["private"],
					format: ["camelCase"],
					leadingUnderscore: "forbid"
				}
			],

			// Variables

			"prefer-destructuring": ["error", { object: true, array: false }],

			// Functions

			"func-style": ["error", "declaration", { allowArrowFunctions: true }],
			"prefer-arrow-callback": "error",

			// Classes

			"@typescript-eslint/member-ordering": [
				"error",
				{
					default: [
						"public-static-field",
						"private-static-field",
						"public-instance-field",
						"private-instance-field",
						"public-static-method",
						"constructor",
						["public-instance-get", "public-instance-set"],
						"public-instance-method",
						"private-instance-method",
						"private-static-method"
					]
				}
			],

			// Loops

			"@typescript-eslint/prefer-for-of": "error",

			// Import statements

			"no-restricted-imports": [
				"error",
				{
					patterns: [
						{
							group: ["../*", ".."],
							message: "Avoid '..' — use absolute paths instead."
						}
					]
				}
			],
			"import/order": [
				"error",
				{
					groups: [
						"builtin",
						"external",
						"internal",
						["parent", "sibling", "index"]
					],
					pathGroups: [
						{
							pattern: "@/**",
							group: "internal"
						}
					],
					"newlines-between": "always"
				}
			],

			// Exports

			"no-restricted-syntax": [
				"error",
				{
					selector: "ExportDefaultDeclaration",
					message: "Use named exports. Never use default exports."
				}
			],

			// SonarJS

			"sonarjs/cognitive-complexity": ["warn", 30],
			"sonarjs/cyclomatic-complexity": "off",
			"sonarjs/nested-control-flow": "warn",
			"sonarjs/no-identical-functions": "warn",
			"sonarjs/no-duplicated-branches": "warn",
			"sonarjs/no-collapsible-if": "warn",
			"sonarjs/no-redundant-jump": "warn",
			"sonarjs/no-unused-collection": "warn",
			"sonarjs/no-ignored-exceptions": "warn",
			"sonarjs/no-nested-conditional": "warn",
			"sonarjs/prefer-single-boolean-return": "warn",
			"sonarjs/pseudo-random": "warn",
			"sonarjs/no-reference-error": "off",
			"sonarjs/too-many-break-or-continue-in-loop": "warn"
		}
	},
	{
		files: ["*.mjs"],
		rules: {
			"no-restricted-syntax": "off"
		}
	}
);
