// The sample habits a new user starts with: valid data the app keeps as it is, marks only where a
// mark can be, every kind of schedule shown, and a believable story (streaks, a half-done today).
// "Today" is Wednesday 21 Oct 2026.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NOW, setNow } from '../../harness/impls.js';
import { getDefaultHabits } from '../../../src/store/sample-habits.js';
import { DEFAULT_CATEGORIES } from '../../../src/config/categories.js';
import { COLOR_OPTIONS } from '../../../src/config/colors.js';
import { addDaysToKey, getDateKeyDaysAgo } from '../../../src/core/dates.js';
import { isHabitActiveOnKey, normalizeHabitGoal } from '../../../src/core/habit.js';
import { isHabitScheduledForDateKey } from '../../../src/core/schedule.js';
import { computeStreak } from '../../../src/core/stats.js';

vi.useFakeTimers({ now: NOW });

const TODAY = '2026-10-21';
const markedKeys = h => [
    ...Object.keys(h.history).filter(k => h.history[k]),
    ...Object.keys(h.slotHistory || {}).filter(k => h.slotHistory[k].some(Boolean))
];

describe('sample habits', () => {
    afterEach(() => vi.setSystemTime(NOW));

    it('are the same on every call of the same day, and move with today', () => {
        expect(getDefaultHabits()).toEqual(getDefaultHabits());
        const today = getDefaultHabits();
        setNow(vi, 2026, 10, 22);
        const tomorrow = getDefaultHabits();
        expect(tomorrow.map(h => h.startDate)).toEqual(today.map(h => addDaysToKey(h.startDate, 1)));
        expect(tomorrow.find(h => h.id === 'h1').history['2026-10-22']).toBe(true);
    });

    it('are valid stored data: loading them changes nothing', () => {
        const raw = getDefaultHabits();
        const loaded = JSON.parse(JSON.stringify(raw)).map(normalizeHabitGoal);
        expect(loaded).toEqual(JSON.parse(JSON.stringify(raw)).map(h => normalizeHabitGoal(normalizeHabitGoal(h))));
        for (const [h, n] of raw.map((h, i) => [h, loaded[i]])) {
            expect(n.startDate).toBe(h.startDate);
            expect(n.schedule.length).toBe(h.schedule.length);
            expect(n.goalType).toBe(h.goalType);
            expect(n.history).toEqual(h.history);
        }
    });

    it('use the default categories and the habit colours, with unique ids', () => {
        const habits = getDefaultHabits();
        expect(new Set(habits.map(h => h.id)).size).toBe(habits.length);
        for (const h of habits) {
            expect(DEFAULT_CATEGORIES).toContain(h.category);
            expect(COLOR_OPTIONS.map(c => c.id)).toContain(h.color);
        }
        expect(new Set(habits.map(h => h.category))).toEqual(new Set(DEFAULT_CATEGORIES));
    });

    it('have marks only on days the habit existed, up to today', () => {
        for (const h of getDefaultHabits().map(normalizeHabitGoal)) {
            for (const key of markedKeys(h)) {
                expect(key >= h.startDate && key <= TODAY, `${h.id} ${key}`).toBe(true);
                expect(isHabitActiveOnKey(h, key), `${h.id} ${key} (paused or archived)`).toBe(true);
                if (h.goalType !== 'flexible') {
                    expect(isHabitScheduledForDateKey(h, key), `${h.id} ${key} (not due)`).toBe(true);
                }
            }
        }
    });

    it('keep the whole-day mark equal to "every occurrence done"', () => {
        for (const h of getDefaultHabits().filter(h => h.slotHistory)) {
            for (const [key, slots] of Object.entries(h.slotHistory)) {
                expect(slots).toHaveLength(h.slotTimes.length);
                expect(!!h.history[key], `${h.id} ${key}`).toBe(slots.every(Boolean));
            }
        }
    });

    it('show every kind of schedule the app has', () => {
        const habits = getDefaultHabits().map(normalizeHabitGoal);
        const some = fn => habits.some(fn);
        expect(some(h => h.goalType === 'daily')).toBe(true);
        expect(some(h => h.goalType === 'fixed_days')).toBe(true);
        expect(some(h => h.goalType === 'flexible')).toBe(true);
        expect(some(h => h.time && h.duration)).toBe(true);
        expect(some(h => h.slotTimes && h.slotTimes.length > 1)).toBe(true);
        expect(some(h => h.dayTimes)).toBe(true);
        expect(some(h => h.schedule.length > 1)).toBe(true);
        expect(some(h => h.pausedRanges.length > 0)).toBe(true);
        expect(some(h => h.archivedSince)).toBe(true);
    });

    it('tell a story: months of history, real streaks, and a today that is half done', () => {
        const habits = getDefaultHabits().map(normalizeHabitGoal);
        const active = habits.filter(h => !h.archivedSince);
        expect(habits.map(h => h.startDate).sort()[0] <= getDateKeyDaysAgo(120)).toBe(true);
        expect(Math.max(...active.map(computeStreak))).toBeGreaterThanOrEqual(30);
        expect(active.filter(h => computeStreak(h) > 0).length).toBeGreaterThanOrEqual(active.length - 1);
        const dueToday = active.filter(h => h.goalType !== 'flexible' && isHabitScheduledForDateKey(h, TODAY));
        const doneToday = dueToday.filter(h => h.history[TODAY]);
        expect(doneToday.length).toBeGreaterThan(0);
        expect(doneToday.length).toBeLessThan(dueToday.length);
    });
});
