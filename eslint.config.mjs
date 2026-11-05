import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import playwright from 'eslint-plugin-playwright'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
    {
        ignores: ['node_modules/', 'playwright-report/', 'test-results/', 'blob-report/'],
    },
    eslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            // A promise that is never awaited lets a test continue before the step finishes
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-explicit-any': 'error',
            // restore* fixtures are requested only so their teardown runs, so they are never read in the test body
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^(_|restore)' }],
        },
    },
    {
        files: ['tests/**/*.ts', 'playwright-utils/**/*.ts'],
        ...playwright.configs['flat/recommended'],
        rules: {
            ...playwright.configs['flat/recommended'].rules,
            'playwright/no-focused-test': 'error',
            'playwright/no-skipped-test': 'error',
            'playwright/no-wait-for-timeout': 'error',
            'playwright/no-force-option': 'error',
            'playwright/prefer-web-first-assertions': 'error',
            'playwright/missing-playwright-await': 'error',
            // Tests assert through page object expect* methods (pom.ownersPage.expectOwnerCountInCity), so count those
            'playwright/expect-expect': ['error', { assertFunctionPatterns: ['^expect[A-Z]'] }],
        },
    },
    {
        files: ['**/*.mjs'],
        ...tseslint.configs.disableTypeChecked,
    },
    // Last, so formatting is left entirely to Prettier
    prettier,
)
