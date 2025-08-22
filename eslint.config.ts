import { fixupConfigRules } from '@eslint/compat';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactPlugin from 'eslint-plugin-react';
import { browser, es2020, node } from 'globals';
import { config, configs as tsConfigs, parser as tsParser } from 'typescript-eslint';
import type { FixupConfigArray } from '@eslint/compat';

export default config(
  // Shared configs
  js.configs.recommended,
  ...tsConfigs.recommended,
  eslintPluginPrettierRecommended,
  ...fixupConfigRules(new FlatCompat().extends('plugin:react-hooks/recommended') as FixupConfigArray),
  {
    files: ['**/*.{ts,tsx}'],
    ...reactPlugin.configs.flat.recommended,
    ...reactPlugin.configs.flat['jsx-runtime'],
  },
  // Custom config
  {
    ignores: ['**/build/**', '**/dist/**', '**/node_modules/**', 'chrome-extension/manifest.js', '**/vitest.config.ts'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
        projectService: true,
      },
      globals: {
        ...browser,
        ...es2020,
        ...node,
        chrome: 'readonly',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'prefer-const': 'off',
      'no-var': 'error',
      'func-style': 'off',
      'no-restricted-imports': [
        'error',
        {
          name: 'type-fest',
          message: 'Please import from `@extension/shared` instead of `type-fest`.',
        },
      ],
      'arrow-body-style': 'off',
      'prettier/prettier': 'off',
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/consistent-type-exports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-case-declarations': 'off',
      'no-useless-escape': 'off',
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  // Overrides Rules
  {
    files: ['**/packages/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
);
