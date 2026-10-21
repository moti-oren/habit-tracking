import js from '@eslint/js';
import globals from 'globals';
import importX from 'eslint-plugin-import-x';
import prettier from 'eslint-config-prettier';

// Layers, lowest first. A layer may import only from the layers before it:
// config → core → store → state → audio → ui → events → main
const LAYERS = ['config', 'core', 'store', 'state', 'audio', 'ui', 'events'];
const layerZones = LAYERS.map((layer, i) => ({
    target: `./src/${layer}`,
    from: [...LAYERS.slice(i + 1).map(l => `./src/${l}`), './src/main.js', './src/monolith.js'],
    message: `"${layer}" may only import from: ${LAYERS.slice(0, i).join(', ') || 'nothing'}.`
}));

// Inside ui/: dom → components → shell → (section and dialog renderers) → app → actions, dialogs.
// Renderers never import actions, dialogs or the app shell; that is what keeps ui/ free of cycles.
const UI = './src/ui';
const uiZones = [
    { target: `${UI}/dom`, from: [`${UI}/components`, `${UI}/shell`, `${UI}/app`, `${UI}/sections`, `${UI}/dialogs`] },
    { target: `${UI}/components`, from: [`${UI}/shell`, `${UI}/app`, `${UI}/sections`, `${UI}/dialogs`] },
    { target: `${UI}/shell`, from: [`${UI}/app`, `${UI}/sections`, `${UI}/dialogs`] },
    {
        target: [`${UI}/sections/**/!(actions|filters).js`, `${UI}/dialogs/**/render.js`],
        from: [
            `${UI}/app/**`,
            `${UI}/dialogs/**/!(render).js`,
            `${UI}/sections/**/actions.js`,
            `${UI}/sections/*filters.js`
        ],
        message: 'Renderers must not import actions, dialogs or ui/app (it would create import cycles).'
    }
];

// Pure layers see only the built-in JavaScript globals: any DOM or browser API is a lint error.
const PURE_GLOBALS = { ...globals.es2025 };

export default [
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            'dist-single/**',
            'legacy/**',
            'coverage/**',
            'test-results/**',
            'playwright-report/**'
        ]
    },
    js.configs.recommended,
    {
        files: ['src/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.browser
        },
        plugins: { 'import-x': importX },
        settings: { 'import-x/resolver': { node: { extensions: ['.js'] } } },
        rules: {
            'import-x/no-cycle': ['error', { ignoreExternal: true }],
            'import-x/no-self-import': 'error',
            'import-x/no-useless-path-segments': 'error',
            'import-x/no-duplicates': 'error',
            'import-x/named': 'error',
            'import-x/no-unresolved': 'error',
            'import-x/extensions': ['error', 'ignorePackages'],
            'import-x/no-restricted-paths': ['error', { zones: [...layerZones, ...uiZones] }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            'no-var': 'error',
            'prefer-const': 'error',
            eqeqeq: ['error', 'always']
        }
    },
    {
        files: ['src/config/**/*.js', 'src/core/**/*.js', 'src/state/**/*.js'],
        languageOptions: { globals: PURE_GLOBALS }
    },
    {
        // The Store owns localStorage; nothing else in the data layer touches the browser.
        files: ['src/store/**/*.js'],
        languageOptions: { globals: { ...PURE_GLOBALS, localStorage: 'readonly', console: 'readonly' } }
    },
    {
        files: ['*.config.js', 'scripts/**/*.{js,mjs}', 'tests/**/*.js', 'e2e/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: { ...globals.node }
        }
    },
    {
        // Unit and parity tests run in jsdom (and Playwright specs evaluate code in the page)
        files: ['tests/**/*.js', 'e2e/**/*.js'],
        languageOptions: { globals: { ...globals.node, ...globals.browser } }
    },
    prettier
];
