import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

const noCrossModule = (forbidden) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: forbidden.map((mod) => ({
        group: [`**/modules/${mod}/**`, `../${mod}/**`, `../${mod}`],
        message:
          'Do not import another core-api module. Communicate via interfaces/events. audit is the shared writer.',
      })),
    },
  ],
});

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      // Playwright output and the browser-test build of the admin.
      '**/dist-e2e/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/e2e-screens/**',
      '**/.turbo/**',
      '**/node_modules/**',
      '**/.expo/**',
      '**/ios/**',
      '**/android/**',
      '**/*.tsbuildinfo',
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
      },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.{mjs,cjs,js}'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
  {
    files: ['apps/admin/**/*.{ts,tsx}', 'apps/mobile/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: {
      // Metro resolves static assets via require().
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['apps/api/src/modules/tenant/**/*.ts'],
    rules: noCrossModule(['platform', 'brands']),
  },
  {
    files: ['apps/api/src/modules/platform/**/*.ts'],
    rules: noCrossModule(['tenant', 'brands']),
  },
  {
    files: ['apps/api/src/modules/brands/**/*.ts'],
    rules: noCrossModule(['tenant', 'platform']),
  },
  {
    files: [
      'apps/api/src/main.ts',
      'apps/auth-service/src/main.ts',
      'db/**/*.mjs',
      'scripts/**/*.mjs',
      '**/*.test.ts',
    ],
    rules: { 'no-console': 'off' },
  },
);
