// @vitest-environment jsdom
// Values cached on the Store revision: day stats, per-habit memos (streaks, range progress) and the
// time-overlap index. The invalidation rules are part of the behaviour, so they are pinned here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { implementationFactories, NOW, setNow } from '../../harness/impls.js';

vi.useFakeTimers({ now: NOW });
const FACTORIES = await implementationFactories();

describe.each(FACTORIES)('selectors (%s)', (_, create) => {
    let impl;
    let Store;
    beforeEach(async () => {
        vi.setSystemTime(NOW);
        localStorage.clear();
        impl = await create();
        Store = impl.Store;
        localStorage.setItem(
            'habit_tracker_he_v2',
            JSON.stringify([
                {
                    id: 'a',
                    name: 'א',
                    startDate: '2026-10-01',
                    time: '07:00',
                    duration: 30,
                    history: { '2026-10-20': true }
                },
                { id: 'b', name: 'ב', startDate: '2026-10-01', goalType: 'fixed_days', fixedDays: [1], time: '07:15' },
                { id: 'c', name: 'ג', startDate: '2026-10-01', time: '07:00', archivedSince: '2026-10-05' },
                { id: 'd', name: 'ד', startDate: '2026-10-01', slotTimes: ['12:00', '20:00'], duration: 60 }
            ])
        );
        Store.load(impl.getDefaultHabits);
    });
    afterEach(() => vi.setSystemTime(NOW));

    it('caches day stats of the full list until the data changes, and never caches filtered lists', () => {
        const day = impl.dayObjForKey('2026-10-21');
        const s1 = impl.getDayStats(day);
        expect(impl.getDayStats(day)).toBe(s1);
        expect(Object.isFrozen(s1)).toBe(true);
        expect(s1).toMatchObject({ totalScheduled: 2, doneScheduled: 0 });
        const filtered = impl.getDayStats(day, Store.habits.slice(0, 1));
        expect(impl.getDayStats(day, Store.habits.slice(0, 1))).not.toBe(filtered);
        Store.toggleDay('a', '2026-10-21');
        const s2 = impl.getDayStats(day);
        expect(s2).not.toBe(s1);
        expect(s2.doneScheduled).toBe(1);
    });

    it("memoizes streaks per habit until that habit's data or the day changes", () => {
        const a = Store.find('a');
        expect(impl.calculateStreak(a)).toBe(1);
        Store.toggleDay('a', '2026-10-21');
        expect(impl.calculateStreak(Store.find('a'))).toBe(2);
        Store.toggleDay('b', '2026-10-21'); // another habit: a's memo stays valid
        expect(impl.calculateStreak(Store.find('a'))).toBe(2);
        setNow(vi, 2026, 10, 23); // two days later: the streak is broken
        expect(impl.calculateStreak(Store.find('a'))).toBe(0);
    });

    it('memoizes range progress per range and freezes the result', () => {
        const days = impl.buildDaysForRange('2026-10-18', '2026-10-24');
        const p = impl.getHabitRangeProgress(Store.find('a'), days, true);
        expect(p).toEqual({ target: 4, done: 1 });
        expect(Object.isFrozen(p)).toBe(true);
        expect(impl.getHabitRangeProgress(Store.find('a'), days, true)).toBe(p);
        expect(impl.getHabitRangeProgress(Store.find('a'), days, false)).toEqual({ target: 7, done: 1 });
    });

    it('computes habits outside the Store without memoizing them', () => {
        const loose = impl.normalizeHabitGoal({
            id: 'zz',
            name: 'z',
            startDate: '2026-10-01',
            history: { '2026-10-21': true }
        });
        expect(impl.calculateStreak(loose)).toBe(1);
        loose.history['2026-10-20'] = true;
        expect(impl.calculateStreak(loose)).toBe(2);
    });

    it('finds live habits whose time blocks overlap on a shared weekday', () => {
        const def = impl.normalizeScheduleFields({ goalType: 'daily', time: '07:10', duration: 10 });
        const found = impl.findTimeOverlaps(def, '').map(o => [o.h.id, o.days, o.time]);
        expect(found).toEqual([
            ['a', [0, 1, 2, 3, 4, 5, 6], '07:00'],
            ['b', [1], '07:15']
        ]);
        expect(impl.findTimeOverlaps(def, 'a').map(o => o.h.id)).toEqual(['b']);
        const evening = impl.normalizeScheduleFields({ goalType: 'fixed_days', fixedDays: [5], time: '20:30' });
        expect(impl.findTimeOverlaps(evening, '').map(o => [o.h.id, o.days, o.time])).toEqual([['d', [5], '20:00']]);
        expect(impl.findTimeOverlaps(impl.normalizeScheduleFields({}), '')).toEqual([]);
        // a's block is 07:00–07:30 and its end is exclusive, so 07:30 does not overlap it
        expect(impl.findTimeOverlaps(impl.normalizeScheduleFields({ time: '07:30' }), '').map(o => o.h.id)).toEqual([]);
    });

    it('answers repeated overlap questions from a memo, rebuilt when the data changes', () => {
        const def = impl.normalizeScheduleFields({ goalType: 'daily', time: '07:10', duration: 10 });
        const r1 = impl.findTimeOverlaps(def, '');
        expect(impl.findTimeOverlaps(def, '')).toBe(r1);
        Store.archiveHabits(['a'], '2026-10-21', '2026-10-22');
        expect(impl.findTimeOverlaps(def, '').map(o => o.h.id)).toEqual(['b']);
    });

    it('lists live habits through the Store', () => {
        expect(impl.getLiveHabits().map(h => h.id)).toEqual(['a', 'b', 'd']);
        expect(impl.getLiveHabits()).toBe(Store.liveHabits());
    });
});
