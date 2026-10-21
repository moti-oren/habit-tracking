// Building blocks for HTML strings.

import { formatTimeRange } from '../../core/time.js';

export function timeRangeHtml(time, duration, cls = '') {
    return `<span dir="ltr" class="tabular-nums ${cls}">${formatTimeRange(time, duration)}</span>`;
}

export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
