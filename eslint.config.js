// @ts-check
const tseslint = require('typescript-eslint')
const reactHooks = require('eslint-plugin-react-hooks')

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'out/**', 'node_modules/**', 'release/**', 'eslint.config.js']
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules
    }
  },
  {
    // Baseline is deliberately modest: enough to catch real bugs (unused vars,
    // floating promises-style issues via recommended rules) without drowning
    // day one in stylistic churn. Tighten incrementally as the codebase adopts it.
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off'
    }
  }
)
