import { defineConfig } from 'vitest/config';

// Date math is checked in the app's own time zone, including the DST weeks.
process.env.TZ = 'Asia/Jerusalem';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        environment: 'node',
        env: { TZ: 'Asia/Jerusalem' },
        testTimeout: 60000,
        hookTimeout: 120000
    }
});
