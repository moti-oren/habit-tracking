// The tracker's state: which week and day are shown, how, and filtered by which category.

import { getDateKeyDaysAgo, getWindow7Days } from '../core/dates.js';

export const tracker = Object.seal({
    /** 0 = this week, -1 = last week… (never in the future) */
    weekOffset: 0,
    /** The 7 day descriptors of that week, Sunday first (always matches weekOffset). */
    weekDays: getWindow7Days(0),
    /** The day being reported on. */
    selectedDateKey: getDateKeyDaysAgo(0),
    /** Today as of the last check, to notice midnight. */
    lastKnownTodayKey: getDateKeyDaysAgo(0),
    /** 'focus' (daily list) | 'grid' (weekly table) */
    viewMode: 'focus',
    selectedCategory: 'הכל',
    /** The collapsed "not scheduled today" group of the daily list. */
    restGroupExpanded: false
});

/** Shows the week `offset` weeks from this one: the offset and its days always change together. */
export function setWeek(offset) {
    tracker.weekOffset = offset;
    tracker.weekDays = getWindow7Days(offset);
}
