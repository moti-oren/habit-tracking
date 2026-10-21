// Light / dark theme: follows the device until the user picks one (the pre-paint script in
// index.html applies a saved choice before anything is drawn).

import { app } from '../../state/app.js';
import { savePrefs } from '../../state/prefs.js';

const systemDarkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

// Until the user picks a theme, the app follows the device setting.
export function initDeviceTheme() {
    app.isDarkMode = systemDarkQuery ? systemDarkQuery.matches : false;
}

export function applyThemeUI(dark) {
    app.isDarkMode = !!dark;
    const html = document.documentElement;
    html.classList.toggle('dark', app.isDarkMode);
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.setAttribute('aria-pressed', String(app.isDarkMode));
        themeBtn.setAttribute(
            'aria-label',
            app.isDarkMode ? 'מצב כהה פעיל. מעבר למצב בהיר' : 'מצב בהיר פעיל. מעבר למצב כהה'
        );
        themeBtn.title = app.isDarkMode ? 'מעבר למצב בהיר' : 'מעבר למצב כהה';
    }
    const container = document.getElementById('themeIconContainer');
    if (container) {
        container.className = app.isDarkMode ? 'text-amber-400' : 'text-slate-700';
        container.innerHTML = app.isDarkMode
            ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>';
    }
}

export function toggleTheme() {
    app.themeChosenByUser = true;
    applyThemeUI(!app.isDarkMode);
    savePrefs();
}

export function wireSystemTheme() {
    if (systemDarkQuery && systemDarkQuery.addEventListener) {
        systemDarkQuery.addEventListener('change', e => {
            if (!app.themeChosenByUser) applyThemeUI(e.matches);
        });
    }
}
