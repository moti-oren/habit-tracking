// Boot (loading preferences and data) and the day rolling over at midnight.

import { getDateKeyDaysAgo } from '../../core/dates.js';
import { analytics, ensureAnalyticsRange, restoreAnalyticsRange } from '../../state/analytics.js';
import { app } from '../../state/app.js';
import { manage } from '../../state/manage.js';
import { currentPrefs } from '../../state/prefs.js';
import { setWeek, tracker } from '../../state/tracker.js';
import { getDefaultHabits } from '../../store/sample-habits.js';
import { Store } from '../../store/store.js';
import { showToast } from '../components/toast.js';
import { applyViewModeButtonsUI } from '../sections/tracker/view-mode.js';
import { applySoundUI } from '../shell/sound.js';
import { applyThemeUI } from '../shell/theme.js';
import { renderAll } from './render.js';

// Storage can be full or blocked (private mode, quota). The data stays in memory for this
// session, and the warning is shown after the action's own message so it isn't overwritten.
function handlePersistError(kind) {
    queueMicrotask(() =>
        showToast(
            kind === 'quota'
                ? 'האחסון בדפדפן מלא — השינויים נשמרים רק עד לסגירת הדף'
                : 'לא ניתן לשמור בדפדפן הזה — השינויים נשמרים רק עד לסגירת הדף'
        )
    );
}

export function loadState() {
    Store.configure({ prefsProvider: currentPrefs, onPersistError: handlePersistError });
    const prefs = Store.loadPrefs();
    if (prefs) {
        if (typeof prefs.isDarkMode === 'boolean') {
            app.isDarkMode = prefs.isDarkMode;
            app.themeChosenByUser = true;
        }
        if (typeof prefs.soundEnabled === 'boolean') app.soundEnabled = prefs.soundEnabled;
        if (prefs.currentViewMode === 'focus' || prefs.currentViewMode === 'grid') {
            tracker.viewMode = prefs.currentViewMode;
        }
        if (['tracker', 'analytics', 'manage'].includes(prefs.currentMainSection)) {
            app.currentMainSection = prefs.currentMainSection;
        }
        restoreAnalyticsRange(prefs.analyticsRange);
        if (typeof prefs.analyticsFilter === 'string') analytics.filter = prefs.analyticsFilter;
    }

    // Always open on Today (reset weekOffset & selectedDateKey, and reset filters to 'הכל')
    setWeek(0);
    tracker.selectedDateKey = getDateKeyDaysAgo(0);
    tracker.lastKnownTodayKey = tracker.selectedDateKey;
    tracker.selectedCategory = 'הכל';
    manage.selectedCategory = 'הכל';

    ensureAnalyticsRange(); // concrete dates from the start, even before analytics is first drawn

    applyThemeUI(app.isDarkMode);
    applySoundUI(app.soundEnabled);
    applyViewModeButtonsUI(tracker.viewMode);

    Store.load(getDefaultHabits);
}

export function checkDayRollover() {
    const nowTodayKey = getDateKeyDaysAgo(0);
    if (nowTodayKey !== tracker.lastKnownTodayKey) {
        tracker.lastKnownTodayKey = nowTodayKey;
        setWeek(0);
        tracker.selectedDateKey = nowTodayKey;
        Store.stripFuture(nowTodayKey);
        renderAll();
    }
}
