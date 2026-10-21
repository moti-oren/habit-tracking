// Analytics actions: range presets, custom range, previous / next, filter.

import { MAX_RANGE_DAYS } from '../../../config/analytics.js';
import { getPresetRange } from '../../../core/analytics-range.js';
import {
    addDaysToKey,
    daysBetweenKeys,
    formatDateKey,
    getDateKeyDaysAgo,
    isValidDateKey,
    parseDateKeyLocal
} from '../../../core/dates.js';
import { analytics, ensureAnalyticsRange } from '../../../state/analytics.js';
import { motion } from '../../../state/motion.js';
import { savePrefs } from '../../../state/prefs.js';
import { showToast } from '../../components/toast.js';
import { openRangePicker } from '../../dialogs/calendar/calendar.js';
import { renderAnalytics } from './analytics.js';
import { renderLeaderboard } from './leaderboard.js';

export function setAnalyticsPreset(preset) {
    motion.analyticsEntryAnim = true;
    if (preset === 'custom') {
        ensureAnalyticsRange();
        const todayKey = getDateKeyDaysAgo(0);
        const end = analytics.range.end > todayKey ? todayKey : analytics.range.end;
        const start = analytics.range.start > end ? end : analytics.range.start;
        analytics.range = { preset: 'custom', start, end };
    } else {
        analytics.range = { preset, ...getPresetRange(preset) };
    }
    savePrefs();
    renderAnalytics();
    renderLeaderboard();
}

export function applyCustomAnalyticsRange() {
    motion.analyticsEntryAnim = true;
    const startEl = document.getElementById('analyticsRangeStart');
    const endEl = document.getElementById('analyticsRangeEnd');
    let start = startEl.value;
    let end = endEl.value;
    if (!isValidDateKey(start) || !isValidDateKey(end)) return;
    if (start > end) [start, end] = [end, start];
    if (daysBetweenKeys(start, end) + 1 > MAX_RANGE_DAYS) {
        start = addDaysToKey(end, -(MAX_RANGE_DAYS - 1));
        showToast('הטווח המקסימלי הוא שנה');
    }
    analytics.range = { preset: 'custom', start, end };
    savePrefs();
    renderAnalytics();
    renderLeaderboard();
}

export function openAnalyticsRangePicker(fromInput) {
    const startEl = document.getElementById('analyticsRangeStart');
    const endEl = document.getElementById('analyticsRangeEnd');
    openRangePicker({
        start: startEl.value,
        end: endEl.value,
        focusKey: fromInput ? fromInput.value : endEl.value,
        max: getDateKeyDaysAgo(0),
        onRangePick: (start, end) => {
            startEl.value = start;
            endEl.value = end;
            applyCustomAnalyticsRange();
        }
    });
}

export function shiftAnalyticsRange(dir) {
    motion.analyticsEntryAnim = true;
    ensureAnalyticsRange();
    const { preset, start, end } = analytics.range;
    let ns, ne;
    if (preset === 'month') {
        const s0 = parseDateKeyLocal(start);
        const first = new Date(s0.getFullYear(), s0.getMonth() + dir, 1);
        const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
        ns = formatDateKey(first);
        ne = formatDateKey(last);
    } else {
        const len = daysBetweenKeys(start, end) + 1;
        ns = addDaysToKey(start, dir * len);
        ne = addDaysToKey(end, dir * len);
    }
    if (dir > 0 && ns > getDateKeyDaysAgo(0)) return;
    analytics.range = { preset, start: ns, end: ne };
    savePrefs();
    renderAnalytics();
    renderLeaderboard();
}

export function setAnalyticsFilter(value) {
    motion.analyticsEntryAnim = true;
    analytics.filter = value || 'all';
    savePrefs();
    renderAnalytics();
    renderLeaderboard();
}
