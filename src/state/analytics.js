// The analytics section's state: the date range and what it shows (everything, a category, a habit).

import { ANALYTICS_PRESETS } from '../config/analytics.js';
import { getPresetRange } from '../core/analytics-range.js';
import { isValidDateKey } from '../core/dates.js';

export const analytics = Object.seal({
    /** preset: 'week' | '7d' | '30d' | 'month' | 'custom'; start/end are filled by ensureAnalyticsRange */
    range: { preset: 'week', start: null, end: null },
    /** 'all' | 'cat:<name>' | 'habit:<id>' */
    filter: 'all'
});

export function restoreAnalyticsRange(saved) {
    if (!saved || !ANALYTICS_PRESETS.some(p => p.id === saved.preset)) return;
    if (saved.preset === 'custom') {
        if (isValidDateKey(saved.start) && isValidDateKey(saved.end) && saved.start <= saved.end) {
            analytics.range = { preset: 'custom', start: saved.start, end: saved.end };
        }
        return;
    }
    // Presets always restart from "now" so the view stays current
    analytics.range = { preset: saved.preset, ...getPresetRange(saved.preset) };
}

export function ensureAnalyticsRange() {
    if (!analytics.range.start || !analytics.range.end) {
        analytics.range = {
            preset: analytics.range.preset === 'custom' ? 'week' : analytics.range.preset,
            ...getPresetRange(analytics.range.preset === 'custom' ? 'week' : analytics.range.preset)
        };
    }
}
