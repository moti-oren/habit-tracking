import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production builds:
// - the single-file build (dist-single/, opened from file:// like the original), compared with the
//   original file side by side (e2e/visual-parity.spec.js);
// - the multi-file build served by `vite preview` (e2e/smoke.spec.js).
// The original loads Tailwind from its CDN and both load Google Fonts, so these tests need internet.
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
