import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The app is opened straight from disk, and module scripts can't load from file://.
// `npm run build:single` therefore inlines all JS and CSS into one HTML file named like the
// original, so it can replace the old file at the same path (same origin, so the same localStorage).
const SINGLE_FILE_NAME = 'habit_tracker_dashboard.html';

function renameHtml(fileName) {
    return {
        name: 'rename-html',
        enforce: 'post',
        generateBundle(_, bundle) {
            const html = bundle['index.html'];
            if (html) html.fileName = fileName;
        }
    };
}

export default defineConfig(({ mode }) => {
    const single = mode === 'single';
    return {
        base: './',
        plugins: single ? [viteSingleFile(), renameHtml(SINGLE_FILE_NAME)] : [],
        build: {
            outDir: single ? 'dist-single' : 'dist',
            emptyOutDir: true,
            // Vite's CSS minifier (Lightning CSS) rewrites syntax, e.g. `(max-width: 767px)` becomes
            // the range form `(width<=767px)` that Safari < 16.4 ignores, and it reorders declarations.
            // The CDN never minified its CSS, so the build ships the PostCSS output as-is (~12 kB gzip).
            cssMinify: false
        }
    };
});
