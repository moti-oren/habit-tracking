// Values computed from the Store and cached until its data changes (Store.revision, per-habit
// revisions) or the day changes. Results are frozen so callers cannot alter a cache.

import { todayDayNum } from '../core/dates.js';
import { getHabitStreakUnit } from '../core/format.js';
import { buildOverlapIndex, findOverlapsIn } from '../core/overlaps.js';
import { baseHabit, dayTimesRow, hasAnyTime, scheduleWeekdays } from '../core/schedule.js';
import { computeBestStreak, computeDayStats, computeHabitRangeProgress, computeStreak } from '../core/stats.js';
import { Store } from './store.js';

export function getLiveHabits() {
    return Store.liveHabits();
}

// Memoized per habit: recomputed only when that habit's data changed (its Store
// revision) or the day rolled over. Results are frozen so callers can't alter the cache.
const habitMemo = new Map(); // id -> { rev, today, obj, slots: Map }

function memoForHabit(habit, slot, compute) {
    const base = baseHabit(habit);
    const rev = base && Store.habitRevision(base.id);
    if (rev === undefined) return compute();
    const t = todayDayNum();
    let entry = habitMemo.get(base.id);
    if (!entry || entry.rev !== rev || entry.today !== t || entry.obj !== base) {
        entry = { rev, today: t, obj: base, slots: new Map() };
        habitMemo.set(base.id, entry);
    }
    if (entry.slots.has(slot)) return entry.slots.get(slot);
    const value = compute();
    entry.slots.set(slot, typeof value === 'object' && value !== null ? Object.freeze(value) : value);
    return entry.slots.get(slot);
}

export function calculateStreak(habit) {
    habit = baseHabit(habit);
    if (!habit) return 0;
    return memoForHabit(habit, 'streak', () => computeStreak(habit));
}

export function getHabitStreakText(habit) {
    const s = calculateStreak(habit);
    const unit = getHabitStreakUnit(habit);
    return s > 0 ? `רצף ${s} ${unit}` : '';
}

export function getHabitStreakLongText(habit) {
    const s = calculateStreak(habit);
    const unit = getHabitStreakUnit(habit);
    return s > 0 ? `רצף של ${s} ${unit}` : '';
}

// Per-day totals. For the full list (the common case: day strip, calendar, toggles) results
// are cached per day until the data changes; filtered lists are computed directly.
const dayStatsCache = { revision: -1, map: new Map() };

export function getDayStats(dayObj, habitList = Store.habits) {
    if (habitList !== Store.habits) return computeDayStats(dayObj, habitList);
    if (dayStatsCache.revision !== Store.revision) {
        dayStatsCache.revision = Store.revision;
        dayStatsCache.map.clear();
    }
    let stats = dayStatsCache.map.get(dayObj.key);
    if (!stats) {
        stats = Object.freeze(computeDayStats(dayObj, habitList));
        dayStatsCache.map.set(dayObj.key, stats);
    }
    return stats;
}

// Progress of one habit over a range. `elapsedOnly` limits the target to days that already passed.
export function getHabitRangeProgress(habit, days, elapsedOnly) {
    habit = baseHabit(habit);
    if (!days.length) return computeHabitRangeProgress(habit, days, elapsedOnly);
    const slot = `range|${days[0].key}|${days[days.length - 1].key}|${days.length}|${elapsedOnly ? 1 : 0}`;
    return memoForHabit(habit, slot, () => computeHabitRangeProgress(habit, days, elapsedOnly));
}

// Longest streak a habit ever had (days, or weeks for flexible habits).
export function calculateBestStreak(habit) {
    habit = baseHabit(habit);
    if (!habit) return 0;
    return memoForHabit(habit, 'best', () => computeBestStreak(habit));
}

// Other live habits whose time block overlaps this one on at least one shared weekday
// Other live habits whose time block overlaps this one on a shared weekday (each day by its own time)
// Index of every live, timed habit, rebuilt only when the data changes: a weekday bit mask
// and, per weekday, its time blocks already converted to minutes. Checking a definition is then
// one mask test per habit plus number comparisons — no string parsing in the loop.
let overlapIndex = { revision: -1, entries: [] };

function getOverlapIndex() {
    if (overlapIndex.revision === Store.revision) return overlapIndex.entries;
    const entries = buildOverlapIndex(getLiveHabits());
    overlapIndex = { revision: Store.revision, entries };
    return entries;
}

// The form asks twice per keystroke (hint + summary) with the same definition: remember the last answer
let overlapMemo = { key: null, result: [] };

export function findTimeOverlaps(def, excludeId) {
    if (!hasAnyTime(def)) return [];
    const key = `${Store.revision}|${excludeId}|${def.duration}|${JSON.stringify(scheduleWeekdays(def).map(d => dayTimesRow(def, d)))}`;
    if (overlapMemo.key === key) return overlapMemo.result;
    const result = findOverlapsIn(getOverlapIndex(), def, excludeId);
    overlapMemo = { key, result };
    return result;
}
