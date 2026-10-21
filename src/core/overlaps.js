// Time overlaps between habits: which habits have a time block that overlaps a definition's on a
// shared weekday. Pure; the caches around it (rebuilt when the Store changes) are in store/selectors.js.

import { hasAnyTime, scheduleWeekdays, timesOnDay } from './schedule.js';
import { timeBlock } from './time.js';

// Index of every timed habit of the list: a weekday bit mask and, per weekday, its time blocks
// already converted to minutes. Checking a definition is then one mask test per habit plus number
// comparisons — no string parsing in the loop.
export function buildOverlapIndex(habits) {
    const entries = [];
    habits.forEach(h => {
        if (!hasAnyTime(h)) return;
        const days = scheduleWeekdays(h);
        const blocks = [];
        let mask = 0;
        days.forEach(d => {
            blocks[d] = timesOnDay(h, d).map(t => [...timeBlock(t, h.duration), t]);
            mask |= 1 << d;
        });
        entries.push({ h, days, mask, blocks });
    });
    return entries;
}

// The habits of the index (other than `excludeId`) that overlap `def`, with the shared weekdays and
// the start time of the first overlapping block.
export function findOverlapsIn(entries, def, excludeId) {
    const days1 = scheduleWeekdays(def);
    let mask1 = 0;
    const blocks1 = [];
    days1.forEach(d => {
        mask1 |= 1 << d;
        blocks1[d] = timesOnDay(def, d).map(t => timeBlock(t, def.duration));
    });
    const result = [];
    entries.forEach(({ h, days, mask, blocks }) => {
        if (h.id === excludeId || !(mask & mask1)) return;
        let hit = '';
        const hitDays = days.filter(d => {
            if (!(mask1 & (1 << d))) return false;
            return blocks1[d].some(([s1, e1]) =>
                blocks[d].some(([s2, e2, t2]) => {
                    if (s1 < e2 && s2 < e1) {
                        hit = hit || t2;
                        return true;
                    }
                    return false;
                })
            );
        });
        if (hitDays.length) result.push({ h, days: hitDays, time: hit });
    });
    return result;
}
