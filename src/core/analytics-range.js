// Analytics date ranges: the presets ("this week", "last 30 days"…), the previous range, labels.

import { HEBREW_MONTHS, HEBREW_MONTHS_FULL } from '../config/hebrew.js';
import { addDaysToKey, daysBetweenKeys, formatDateKey, getDateKeyDaysAgo, parseDateKeyLocal } from './dates.js';
import { isoNum } from './format.js';

export function getPresetRange(preset) {
    const todayKey = getDateKeyDaysAgo(0);
    const today = parseDateKeyLocal(todayKey);
    if (preset === '7d') return { start: addDaysToKey(todayKey, -6), end: todayKey };
    if (preset === '30d') return { start: addDaysToKey(todayKey, -29), end: todayKey };
    if (preset === 'month') {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { start: formatDateKey(first), end: formatDateKey(last) };
    }
    // week (Sunday–Saturday)
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    const sundayKey = formatDateKey(sunday);
    return { start: sundayKey, end: addDaysToKey(sundayKey, 6) };
}

export function formatRangeLabel(range) {
    const { preset, start, end } = range;
    const current = preset !== 'custom' ? getPresetRange(preset) : null;
    if (current && current.start === start && current.end === end) {
        return preset === 'week'
            ? 'השבוע הנוכחי'
            : preset === 'month'
              ? HEBREW_MONTHS_FULL[parseDateKeyLocal(start).getMonth()]
              : preset === '7d'
                ? '7 הימים האחרונים'
                : '30 הימים האחרונים';
    }
    const s = parseDateKeyLocal(start),
        e = parseDateKeyLocal(end);
    if (preset === 'month' && s.getDate() === 1) {
        return `${HEBREW_MONTHS_FULL[s.getMonth()]}${s.getFullYear() !== new Date().getFullYear() ? ' ' + s.getFullYear() : ''}`;
    }
    if (start === end) return `${s.getDate()} ב${HEBREW_MONTHS[s.getMonth()]}`;
    const yearSuffix = e.getFullYear() !== new Date().getFullYear() ? ` ${e.getFullYear()}` : '';
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return `${isoNum(`${s.getDate()}–${e.getDate()}`)} ב${HEBREW_MONTHS[e.getMonth()]}${yearSuffix}`;
    }
    return `${s.getDate()} ב${HEBREW_MONTHS[s.getMonth()]} – ${e.getDate()} ב${HEBREW_MONTHS[e.getMonth()]}${yearSuffix}`;
}

export function getPreviousRangeBounds(range) {
    const { preset, start, end } = range;
    if (preset === 'month') {
        const s0 = parseDateKeyLocal(start);
        const first = new Date(s0.getFullYear(), s0.getMonth() - 1, 1);
        const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
        return { start: formatDateKey(first), end: formatDateKey(last) };
    }
    const len = daysBetweenKeys(start, end) + 1;
    return { start: addDaysToKey(start, -len), end: addDaysToKey(end, -len) };
}
