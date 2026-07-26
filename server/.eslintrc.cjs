// Server lint gate. TypeScript's strict compiler owns symbol/type checks;
// ESLint covers syntax-level correctness that is useful in CI.
module.exports = {
  root: true,
  env: { es2022: true, node: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended'],
  rules: {
    // TypeScript reports these more accurately for typed source.
    'no-undef': 'off',
    'no-unused-vars': 'off',
  },
  ignorePatterns: ['dist', 'node_modules', '*.cjs'],
};
