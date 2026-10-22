import { defineConfig, devices } from '@playwright/test';

// End-to-end tests (e2e/smoke.spec.js) run against the production builds:
// - the multi-file build served by `vite preview`;
// - the single-file build (dist-single/, opened from file:// like the original), which must take
//   over the data the original file saved.
// The original loads Tailwind from its CDN and both load Google Fonts, so these tests need internet.
// (The side-by-side visual comparison with the original lives at the `refactor-verified` tag.)
export default defineConfig({
    testDir: 'e2e',
    timeout: 10 * 60 * 1000,
    expect: { timeout: 10000 },
    reporter: [['list']],
    outputDir: 'test-results',
    use: { trace: 'retain-on-failure', actionTimeout: 10000 },
    webServer: {
        command: 'npm run build && npm run build:single && npx vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 180 * 1000
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
