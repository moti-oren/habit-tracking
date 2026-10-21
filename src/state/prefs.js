// Preferences: what the UI saves under PREFS_STORAGE_KEY. They ride along with every data commit
// (Store.configure prefsProvider) and are saved on their own for UI-only changes. The key names
// are part of the stored format.

import { Store } from '../store/store.js';
import { analytics } from './analytics.js';
import { app } from './app.js';
import { tracker } from './tracker.js';

export function currentPrefs() {
    return {
        ...(app.themeChosenByUser ? { isDarkMode: app.isDarkMode } : {}),
        soundEnabled: app.soundEnabled,
        currentViewMode: tracker.viewMode,
        currentMainSection: app.currentMainSection,
        analyticsRange: analytics.range,
        analyticsFilter: analytics.filter
    };
}

export function savePrefs() {
    Store.savePrefs(currentPrefs());
}
