const globals = require('globals');
const js = require('@eslint/js');

const OFF = 'off';
const WARN = 'warn';
const ERROR = 'error';

const baseRules = {
  ...js.configs.recommended.rules,
  'no-unused-vars': [WARN, { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-console': OFF,
  'prefer-const': ERROR,
  'no-var': ERROR,
  'eqeqeq': [ERROR, 'always'],
  'curly': [ERROR, 'multi-line'],
  'no-throw-literal': ERROR,
  'no-shadow': [ERROR, { allow: ['req', 'res', 'next', 'err', 'error', 'resolve', 'reject'] }],
  'no-param-reassign': [ERROR, { props: false }],
};

module.exports = [
  { ignores: ['node_modules/', 'data/', 'coverage/'] },

  // Server code — Node.js environment
  {
    files: ['*.js', 'routes/**/*.js', 'middleware/**/*.js', 'services/**/*.js', 'config.js', 'db.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: baseRules,
  },

  // Frontend JS — browser environment
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        localStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        document: 'readonly',
        window: 'readonly',
        location: 'readonly',
        setTimeout: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        FileReader: 'readonly',
        Event: 'readonly',
        HTMLElement: 'readonly',
      },
    },
    rules: {
      ...baseRules,
      'no-console': WARN,
      'no-unused-vars': OFF,
    },
  },

  // Test files — Node.js + Jest globals
  {
    files: ['test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    rules: {
      ...baseRules,
      'no-console': OFF,
      'max-lines': [WARN, { max: 500, skipBlankLines: true, skipComments: true }],
    },
  },
];
