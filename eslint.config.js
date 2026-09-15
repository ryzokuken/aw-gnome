import {defineConfig} from 'eslint/config';
import gnome from 'eslint-config-gnome';

export default defineConfig([
    gnome.configs.recommended,
    gnome.configs.jsdoc,
    {
        ignores: ['node_modules'],
    },
    {
        rules: {
            'camelcase': ['error', {properties: 'never'}],
            'consistent-return': 'error',
            'eqeqeq': ['error', 'smart'],
            'prefer-arrow-callback': 'error',
            'prefer-const': ['error', {destructuring: 'all'}],
            'jsdoc/require-param-description': 'off',
            'jsdoc/require-jsdoc': ['error', {
                exemptEmptyFunctions: true,
                publicOnly: {esm: true},
            }],
        },
    },
    {
        files: ['extension.js', 'lib/**'],
        languageOptions: {
            globals: {global: 'readonly'},
        },
    },
    {
        files: ['tests/**', 'eslint.config.js'],
        rules: {
            'jsdoc/require-jsdoc': 'off',
        },
    },
]);
