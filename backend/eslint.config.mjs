import js from '@eslint/js'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'uploads/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
    },
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: globals.vitest,
    },
  },
  {
    files: ['src/routes/**/*.js', 'src/middleware/**/*.js', 'src/services/**/*.js', 'src/agents/**/*.js'],
    rules: {
      'no-restricted-modules': ['error', '../db', '../../db'],
    },
  },
  {
    files: ['*.config.mjs'],
    languageOptions: {
      sourceType: 'module',
    },
  },
]
