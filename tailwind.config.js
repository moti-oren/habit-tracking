// Ported 1:1 from the inline `tailwind.config` of the original page (Tailwind Play CDN 3.4.17).
// Tailwind is pinned to exactly that version so the generated CSS is the same.

/** @type {import('tailwindcss').Config} */
export default {
    content: {
        relative: true,
        // Many classes live in JS template strings, so every source file is scanned.
        files: ['./index.html', './src/**/*.js']
    },
    darkMode: 'class',
    future: { hoverOnlyWhenSupported: true },
    theme: {
        extend: {
            fontFamily: {
                sans: ['Heebo', 'sans-serif']
            },
            // Smallest text in the app is 13px (was 12px)
            fontSize: {
                xs: ['0.8125rem', { lineHeight: '1.125rem' }]
            },
            // Plain `transition` uses the micro token
            transitionDuration: { DEFAULT: '120ms' },
            transitionTimingFunction: { DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)' }
        }
    }
};
