// The analytics range: preset pills, previous / next and the custom dates.

import { ANALYTICS_PRESETS } from '../../../config/analytics.js';
import { formatRangeLabel } from '../../../core/analytics-range.js';
import {
    addDaysToKey,
    buildDaysForRange,
    formatDateKey,
    getDateKeyDaysAgo,
    parseDateKeyLocal
} from '../../../core/dates.js';
import { analytics, ensureAnalyticsRange } from '../../../state/analytics.js';
import { scheduleScrollFades } from '../../components/scroll-fades.js';
import { updateSegPill } from '../../components/segmented.js';

export function getAnalyticsDays() {
    ensureAnalyticsRange();
    return buildDaysForRange(analytics.range.start, analytics.range.end);
}

export function renderAnalyticsRangeControls() {
    ensureAnalyticsRange();
    const presetsEl = document.getElementById('analyticsRangePresets');
    if (!presetsEl) return;
    presetsEl.innerHTML = ANALYTICS_PRESETS.map(p => {
        const active = p.id === analytics.range.preset;
        return `<button type="button" aria-pressed="${active}" data-action="setPreset" data-arg="${p.id}" class="tap-44 h-9 px-2.5 sm:px-3 rounded-lg transition-all ${
            active
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }">${p.label}</button>`;
    }).join('');
    updateSegPill(presetsEl);
    document.getElementById('analyticsRangeLabel').textContent = formatRangeLabel(analytics.range);
    const nextStart =
        analytics.range.preset === 'month'
            ? formatDateKey(
                  new Date(
                      parseDateKeyLocal(analytics.range.start).getFullYear(),
                      parseDateKeyLocal(analytics.range.start).getMonth() + 1,
                      1
                  )
              )
            : addDaysToKey(analytics.range.end, 1);
    document.getElementById('analyticsNextRangeBtn').disabled = nextStart > getDateKeyDaysAgo(0);
    const custom = document.getElementById('analyticsCustomRange');
    const isCustom = analytics.range.preset === 'custom';
    custom.classList.toggle('hidden', !isCustom);
    if (isCustom) {
        const startEl = document.getElementById('analyticsRangeStart');
        const endEl = document.getElementById('analyticsRangeEnd');
        if (document.activeElement !== startEl) startEl.value = analytics.range.start;
        if (document.activeElement !== endEl) endEl.value = analytics.range.end;
        startEl.max = getDateKeyDaysAgo(0);
        endEl.max = getDateKeyDaysAgo(0);
    }
    scheduleScrollFades();
}
