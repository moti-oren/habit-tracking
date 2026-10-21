// A habit as stored: normalization of saved data, its start date, archive and pauses (when it
// "exists"), its marks (whole day or per occurrence) and its category label.

import { UNCATEGORIZED_LABEL } from '../config/categories.js';
import { COLOR_MIGRATION } from '../config/colors.js';
import { formatDateKey, getDateKeyDaysAgo, isValidDateKey } from './dates.js';
import { baseHabit, normalizeHabitSchedule } from './schedule.js';

export function normalizeHabitGoal(habit) {
    normalizeHabitSchedule(habit);
    if (!habit.history || typeof habit.history !== 'object') {
        habit.history = {};
    }
    // Per-occurrence marks for habits done several times a day: { day: [true, false, ...] }.
    // history[day] stays the single source for statistics: true only when every occurrence is done.
    if (habit.slotHistory && typeof habit.slotHistory === 'object') {
        Object.keys(habit.slotHistory).forEach(k => {
            const arr = habit.slotHistory[k];
            if (!isValidDateKey(k) || !Array.isArray(arr)) delete habit.slotHistory[k];
            else habit.slotHistory[k] = arr.map(Boolean);
        });
    } else if (habit.slotHistory !== undefined) {
        delete habit.slotHistory;
    }
    if (COLOR_MIGRATION[habit.color]) {
        habit.color = COLOR_MIGRATION[habit.color];
    }
    if (!isValidDateKey(habit.startDate)) {
        habit.startDate = inferHabitStartDate(habit);
    }
    if (habit.archivedSince && !isValidDateKey(habit.archivedSince)) {
        delete habit.archivedSince;
    }
    habit.pausedRanges = Array.isArray(habit.pausedRanges)
        ? habit.pausedRanges.filter(r => Array.isArray(r) && isValidDateKey(r[0]) && isValidDateKey(r[1]))
        : [];
    return habit;
}

// Is occurrence i done on that day? Without per-occurrence marks the whole-day mark counts for all.
export function isSlotDone(habit, dateKey, i) {
    const base = baseHabit(habit);
    const arr = base.slotHistory && base.slotHistory[dateKey];
    if (Array.isArray(arr)) return !!arr[i];
    return !!(base.history && base.history[dateKey]);
}

// Any mark on that day: the whole day, or at least one occurrence
export function hasAnyMarkOnDay(habit, dateKey) {
    const base = baseHabit(habit);
    return (
        !!(base.history && base.history[dateKey]) ||
        !!(base.slotHistory && Array.isArray(base.slotHistory[dateKey]) && base.slotHistory[dateKey].some(Boolean))
    );
}

export function getEarliestCheckedKey(habit) {
    const keys = Object.keys((habit && habit.history) || {}).filter(k => habit.history[k] && isValidDateKey(k));
    if (habit && habit.slotHistory)
        keys.push(...Object.keys(habit.slotHistory).filter(k => habit.slotHistory[k].some(Boolean)));
    keys.sort();
    return keys[0] || null;
}

// For habits saved before start dates existed: earliest of (first check mark, creation time encoded in the id), else today
export function inferHabitStartDate(habit) {
    const candidates = [];
    const firstCheck = getEarliestCheckedKey(habit);
    if (firstCheck) candidates.push(firstCheck);
    const m = /^h_(\d{12,})/.exec(String(habit.id || ''));
    if (m) {
        const created = new Date(Number(m[1]));
        if (!isNaN(created.getTime())) candidates.push(formatDateKey(created));
    }
    candidates.sort();
    return candidates[0] || getDateKeyDaysAgo(0);
}

export function isHabitArchived(habit) {
    return !!(habit && habit.archivedSince);
}

// A habit "exists" on a day only if: the day is on/after its start date, before it was
// archived, and not inside a past archive period it was later restored from.
export function isHabitActiveOnKey(habit, dateKey) {
    if (!habit) return true;
    if (habit.startDate && dateKey < habit.startDate) return false;
    if (habit.archivedSince && dateKey >= habit.archivedSince) return false;
    if (Array.isArray(habit.pausedRanges) && habit.pausedRanges.some(r => dateKey >= r[0] && dateKey <= r[1]))
        return false;
    return true;
}

// Active at any point during the given list of day objects (e.g. the visible week)
export function isHabitActiveInDays(habit, days) {
    if (!days || days.length === 0) return true;
    return days.some(d => isHabitActiveOnKey(habit, d.key));
}

export function getHabitCategoryDisplay(habit) {
    const cat = habit && habit.category ? String(habit.category).trim() : '';
    return cat || UNCATEGORIZED_LABEL;
}
