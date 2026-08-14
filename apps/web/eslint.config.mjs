import { baseConfig } from '@tech-challenge/config/eslint.base.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        project: './tsconfig.json',
      },
    },
  },
  {
    ignores: [
      '.next/**',
      'next-env.d.ts',
      'eslint.config.mjs',
      '.prettierrc.mjs',
      'next.config.ts',
      'postcss.config.mjs',
      'vitest.config.mts',
      'vitest.setup.ts',
    ],
  },
];
