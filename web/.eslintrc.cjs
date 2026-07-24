// Minimal lint gate (WP1). Intentionally narrow: the enforced rule set grows
// as the codebase is cleaned up in later work packages.
module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint'],
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: ['dist', 'node_modules', '*.cjs'],
};
