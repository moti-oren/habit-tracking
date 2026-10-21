// @vitest-environment jsdom
// Scheduling: normalization of every stored shape, schedule versions, per-day copies, edits.
import { describe, expect, it, vi } from 'vitest';
import { implementations, NOW } from '../../harness/impls.js';

vi.useFakeTimers({ now: NOW });
const IMPLS = await implementations(['core/schedule', 'core/habit']);
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const NO_TIMES = { time: '', dayTimes: null, slotTimes: null, duration: 0 };

describe.each(IMPLS)('normalizeScheduleFields (%s)', (_, impl) => {
    const norm = obj => impl.normalizeScheduleFields({ ...obj });

    it('infers the goal type of old data and fills the fields it implies', () => {
        expect(norm({})).toEqual({ goalType: 'daily', fixedDays: ALL_DAYS, weeklyGoal: 7, ...NO_TIMES });
        expect(norm({ fixedDays: [5, 1, 1, '3'] })).toEqual({
            goalType: 'fixed_days',
            fixedDays: [1, 3, 5],
            weeklyGoal: 3,
            ...NO_TIMES
        });
        expect(norm({ weeklyGoal: 3 })).toEqual({ goalType: 'flexible', fixedDays: [], weeklyGoal: 3, ...NO_TIMES });
        expect(norm({ fixedDays: ALL_DAYS }).goalType).toBe('daily');
        expect(norm({ fixedDays: [], weeklyGoal: 7 }).goalType).toBe('daily');
    });

    it('clamps and repairs goals', () => {
        expect(norm({ goalType: 'flexible', weeklyGoal: 9 }).weeklyGoal).toBe(6);
        expect(norm({ goalType: 'flexible', weeklyGoal: 0 }).weeklyGoal).toBe(4);
        expect(norm({ goalType: 'flexible', weeklyGoal: '2' }).weeklyGoal).toBe(2);
        expect(norm({ goalType: 'weird' })).toMatchObject({ goalType: 'flexible', fixedDays: [], weeklyGoal: 4 });
        expect(norm({ goalType: 'fixed_days', fixedDays: [] })).toMatchObject({ fixedDays: [0, 2, 4], weeklyGoal: 3 });
        expect(norm({ goalType: 'fixed_days', fixedDays: 'x' })).toMatchObject({ fixedDays: [0, 2, 4] });
        expect(norm({ goalType: 'daily', fixedDays: [1], weeklyGoal: 2 })).toMatchObject({
            fixedDays: ALL_DAYS,
            weeklyGoal: 7
        });
    });

    it('keeps only valid times, and a duration only when there is a time', () => {
        expect(norm({ time: ' 07:05 ', duration: 30 })).toMatchObject({ time: '07:05', duration: 30 });
        for (const bad of ['7:05', '24:00', '12:60', 'noon', 905, null]) expect(norm({ time: bad }).time).toBe('');
        expect(norm({ time: '', duration: 30 }).duration).toBe(0);
        expect(norm({ time: '06:00', duration: '45.6' }).duration).toBe(46);
        expect(norm({ time: '06:00', duration: 2000 }).duration).toBe(1440);
        expect(norm({ time: '06:00', duration: -5 }).duration).toBe(0);
        expect(norm({ time: '06:00', duration: 'x' }).duration).toBe(0);
    });

    it('stores several times a day as slotTimes, timed slots first in time order', () => {
        expect(norm({ slotTimes: ['18:00', '', '07:00'], duration: 15 })).toEqual({
            goalType: 'daily',
            fixedDays: ALL_DAYS,
            weeklyGoal: 7,
            time: '',
            dayTimes: null,
            slotTimes: ['07:00', '18:00', ''],
            duration: 15
        });
        expect(norm({ slotTimes: ['1', '2', '3', '4', '5', '6'] }).slotTimes).toEqual(['', '', '', '']);
        expect(norm({ slotTimes: ['', ''] })).toMatchObject({ slotTimes: ['', ''], duration: 0 });
        expect(norm({ slotTimes: ['09:00'] })).toMatchObject({ time: '09:00', slotTimes: null });
    });

    it('collapses per-day times that are equal on every active day', () => {
        const dayTimes = [['09:00'], ['08:00'], ['09:00'], ['08:00'], '09:00', null, ['09:00']];
        expect(norm({ goalType: 'fixed_days', fixedDays: [1, 3], dayTimes })).toMatchObject({
            dayTimes: null,
            slotTimes: null,
            time: '08:00'
        });
    });

    it('keeps per-day times that differ, padding rows and blanking inactive days', () => {
        const dayTimes = [[], ['08:00', '20:00'], [], ['09:30'], [], [], []];
        expect(norm({ goalType: 'fixed_days', fixedDays: [1, 3], dayTimes })).toMatchObject({
            time: '',
            slotTimes: null,
            dayTimes: [
                ['', ''],
                ['08:00', '20:00'],
                ['', ''],
                ['09:30', ''],
                ['', ''],
                ['', ''],
                ['', '']
            ]
        });
        // single strings and non-arrays are read as one occurrence
        expect(
            norm({ goalType: 'daily', dayTimes: ['06:00', '07:00', '06:00', '06:00', '06:00', '06:00', '06:00'] })
                .dayTimes[1]
        ).toEqual(['07:00']);
    });

    it('ignores dayTimes that are not 7 rows', () => {
        expect(norm({ dayTimes: [['06:00']], time: '05:00' })).toMatchObject({ dayTimes: null, time: '05:00' });
    });
});

describe.each(IMPLS)('schedule versions (%s)', (_, impl) => {
    const habit = extra => impl.normalizeHabitSchedule({ id: 'h', ...extra });

    it('creates one version from the top-level fields of an old habit', () => {
        const h = habit({ goalType: 'flexible', weeklyGoal: 3 });
        expect(h.schedule).toEqual([{ from: null, goalType: 'flexible', fixedDays: [], weeklyGoal: 3, ...NO_TIMES }]);
        expect(habit({ schedule: [] }).schedule).toHaveLength(1);
        expect(habit({ schedule: [null, 5, 'x'] }).schedule).toHaveLength(1);
    });

    it('sorts versions, forces the first to "from the start" and mirrors the last on top', () => {
        const h = habit({
            schedule: [
                { from: '2026-05-01', goalType: 'flexible', weeklyGoal: 3 },
                { from: null, goalType: 'daily' },
                { from: '2026-03-01', goalType: 'fixed_days', fixedDays: [1] }
            ]
        });
        expect(h.schedule.map(v => [v.from, v.goalType])).toEqual([
            [null, 'daily'],
            ['2026-03-01', 'fixed_days'],
            ['2026-05-01', 'flexible']
        ]);
        expect(h).toMatchObject({ goalType: 'flexible', weeklyGoal: 3, fixedDays: [] });

        const shifted = habit({
            schedule: [
                { from: '2026-03-01', goalType: 'fixed_days', fixedDays: [1] },
                { from: '2026-05-01', goalType: 'daily' }
            ]
        });
        expect(shifted.schedule.map(v => v.from)).toEqual([null, '2026-05-01']);
    });

    it('lets the later entry win for the same day, treats bad dates as "from the start", merges repeats', () => {
        const sameDay = habit({
            schedule: [
                { from: null, goalType: 'daily' },
                { from: '2026-03-01', goalType: 'fixed_days', fixedDays: [1] },
                { from: '2026-03-01', goalType: 'fixed_days', fixedDays: [2] }
            ]
        });
        expect(sameDay.schedule.map(v => [v.from, v.fixedDays])).toEqual([
            [null, ALL_DAYS],
            ['2026-03-01', [2]]
        ]);
        const badFrom = habit({
            schedule: [
                { from: 'garbage', goalType: 'fixed_days', fixedDays: [1] },
                { from: null, goalType: 'daily' }
            ]
        });
        expect(badFrom.schedule.map(v => v.goalType)).toEqual(['daily']);
        const repeats = habit({
            schedule: [
                { from: null, goalType: 'daily' },
                { from: '2026-03-01', goalType: 'daily' },
                { from: '2026-04-01', goalType: 'flexible', weeklyGoal: 2 },
                { from: '2026-05-01', goalType: 'flexible', weeklyGoal: 2 }
            ]
        });
        expect(repeats.schedule.map(v => v.from)).toEqual([null, '2026-04-01']);
    });

    it('compares and copies schedule fields', () => {
        const a = impl.normalizeScheduleFields({ goalType: 'fixed_days', fixedDays: [1, 3], time: '06:00' });
        const b = impl.pickScheduleFields(a);
        expect(b).toEqual({
            goalType: 'fixed_days',
            fixedDays: [1, 3],
            weeklyGoal: 2,
            time: '06:00',
            duration: 0,
            dayTimes: null,
            slotTimes: null
        });
        expect(b.fixedDays).not.toBe(a.fixedDays);
        expect(impl.sameScheduleFields(a, b)).toBe(true);
        expect(impl.sameScheduleFields(a, { ...b, time: '06:05' })).toBe(false);
        expect(impl.sameScheduleFields({ ...b, slotTimes: null }, { ...b, slotTimes: [] })).toBe(true);
    });
});

describe.each(IMPLS)('schedule lookups (%s)', (_, impl) => {
    const multi = () =>
        impl.normalizeHabitSchedule({
            id: 'm',
            history: {},
            schedule: [
                { from: null, goalType: 'daily' },
                { from: '2026-03-01', goalType: 'fixed_days', fixedDays: [1, 3] },
                { from: '2026-06-01', goalType: 'flexible', weeklyGoal: 3 }
            ]
        });

    it('finds the version in force on a day', () => {
        const h = multi();
        const at = key => impl.getScheduleVersion(h, key).goalType;
        expect(['2025-01-01', '2026-02-28', '2026-03-01', '2026-05-31', '2026-06-01', '2027-01-01'].map(at)).toEqual([
            'daily',
            'daily',
            'fixed_days',
            'fixed_days',
            'flexible',
            'flexible'
        ]);
        const plain = { goalType: 'daily' };
        expect(impl.getScheduleVersion(plain, '2026-01-01')).toBe(plain);
    });

    it('answers "due on this day?" by the version of that day', () => {
        const h = multi();
        expect(impl.isHabitScheduledOnKey(h, '2026-02-03')).toBe(true); // daily
        expect(impl.isHabitScheduledOnKey(h, '2026-03-02')).toBe(true); // Monday, fixed [1, 3]
        expect(impl.isHabitScheduledOnKey(h, '2026-03-03')).toBe(false); // Tuesday
        expect(impl.isHabitScheduledOnKey(h, '2026-06-01')).toBe(false); // flexible: never "due"
        expect(impl.isFlexibleOnKey(h, '2026-06-01')).toBe(true);
        expect(impl.isFlexibleOnKey(h, '2026-05-01')).toBe(false);
        expect(impl.isHabitScheduledForDateKey(h, 'bad')).toBe(false);
        expect(impl.isHabitScheduledForDayOfWeek(null, 1)).toBe(false);
        expect(impl.isHabitScheduledForDayOfWeek({ goalType: 'daily' }, 6)).toBe(true);
    });

    it('returns the same object for single-version habits and a dated copy otherwise', () => {
        const single = impl.normalizeHabitGoal({ id: 's', name: 's', goalType: 'daily', time: '07:00' });
        expect(impl.habitOn(single, '2026-10-21')).toBe(single);
        const h = multi();
        const onMay = impl.habitOn(h, '2026-05-01');
        expect(onMay).not.toBe(h);
        expect(onMay).toMatchObject({ goalType: 'fixed_days', fixedDays: [1, 3], _base: h });
        expect(impl.baseHabit(onMay)).toBe(h);
        expect(impl.habitOn(onMay, '2026-07-01').goalType).toBe('flexible');
        expect(impl.habitOn(null, '2026-01-01')).toBe(null);
    });

    it("gives per-weekday times their day's time on the copy", () => {
        const h = impl.normalizeHabitGoal({
            id: 'd',
            name: 'd',
            goalType: 'fixed_days',
            fixedDays: [1, 3],
            dayTimes: [[], ['08:00', '20:00'], [], ['09:30'], [], [], []]
        });
        const mon = impl.habitOn(h, '2026-10-19');
        expect(mon).toMatchObject({ time: '', slotTimes: ['08:00', '20:00'], dayTimes: null });
        // every row is padded to the day with the most occurrences, so Wednesday has 2 slots too
        const wed = impl.habitOn(h, '2026-10-21');
        expect(wed).toMatchObject({ time: '', slotTimes: ['09:30', ''], dayTimes: null });
        const single = impl.normalizeHabitGoal({
            id: 'e',
            name: 'e',
            goalType: 'fixed_days',
            fixedDays: [1, 3],
            dayTimes: [[], ['08:00'], [], ['09:30'], [], [], []]
        });
        expect(impl.habitOn(single, '2026-10-21')).toMatchObject({ time: '09:30', slotTimes: null });
    });

    it('reads occurrences, weekdays and times of a definition', () => {
        expect(impl.scheduleWeekdays({ goalType: 'fixed_days', fixedDays: [2, 4] })).toEqual([2, 4]);
        expect(impl.scheduleWeekdays({ goalType: 'flexible' })).toEqual(ALL_DAYS);
        expect(impl.dayTimesRow({ time: '06:00' }, 3)).toEqual(['06:00']);
        expect(impl.dayTimesRow({ slotTimes: ['06:00', ''] }, 3)).toEqual(['06:00', '']);
        expect(impl.dayTimesRow({ dayTimes: [['06:00'], '07:00', null, [], [], [], []] }, 1)).toEqual(['07:00']);
        expect(impl.dayTimesRow({ dayTimes: [['06:00'], '07:00', null, [], [], [], []] }, 2)).toEqual(['']);
        expect(impl.timesOnDay({ slotTimes: ['06:00', ''] }, 0)).toEqual(['06:00']);
        expect(impl.hasAnyTime({ time: '' })).toBe(false);
        expect(impl.hasAnyTime({ slotTimes: ['', '06:00'] })).toBe(true);
        expect(impl.hasAnyTime({ dayTimes: [[''], '', null, [], [], [], ['05:00']] })).toBe(true);
        expect(impl.slotCount(null)).toBe(1);
        expect(impl.slotCount({ slotTimes: ['', '', ''] })).toBe(3);
        expect(impl.slotCount({ dayTimes: [['', ''], [], [], [], [], [], []] })).toBe(2);
        expect(impl.slotCount({ dayTimes: ['06:00', '', '', '', '', '', ''] })).toBe(1);
    });
});

describe.each(IMPLS)('applyScheduleEdit (%s)', (_, impl) => {
    const def = extra => impl.normalizeScheduleFields({ goalType: 'fixed_days', fixedDays: [1], ...extra });
    const withHistory = startDate =>
        impl.normalizeHabitGoal({ id: 'e', name: 'e', goalType: 'daily', startDate, history: {} });

    it('adds a version from today when the habit has past days and the scope is "forward"', () => {
        const h = withHistory('2026-10-01');
        impl.applyScheduleEdit(h, def(), 'forward');
        expect(h.schedule.map(v => [v.from, v.goalType])).toEqual([
            [null, 'daily'],
            ['2026-10-21', 'fixed_days']
        ]);
        expect(h).toMatchObject({ goalType: 'fixed_days', fixedDays: [1], weeklyGoal: 1 });
    });

    it('replaces every version when the scope is "all" or there are no past days', () => {
        const all = withHistory('2026-10-01');
        impl.applyScheduleEdit(all, def(), 'all');
        expect(all.schedule.map(v => v.from)).toEqual([null]);
        const fresh = withHistory('2026-10-21');
        impl.applyScheduleEdit(fresh, def(), 'forward');
        expect(fresh.schedule).toHaveLength(1);
        expect(fresh.goalType).toBe('fixed_days');
    });

    it('drops versions dated today or later before adding the new one, and ignores no-op edits', () => {
        const h = impl.normalizeHabitGoal({
            id: 'f',
            name: 'f',
            startDate: '2026-01-01',
            schedule: [
                { from: null, goalType: 'daily' },
                { from: '2026-10-21', goalType: 'flexible', weeklyGoal: 2 },
                { from: '2026-12-01', goalType: 'flexible', weeklyGoal: 5 }
            ]
        });
        impl.applyScheduleEdit(h, def({ fixedDays: [2] }), 'forward');
        expect(h.schedule.map(v => [v.from, v.goalType, v.fixedDays])).toEqual([
            [null, 'daily', ALL_DAYS],
            ['2026-10-21', 'fixed_days', [2]]
        ]);
        const before = JSON.stringify(h);
        impl.applyScheduleEdit(h, def({ fixedDays: [2] }), 'forward');
        expect(JSON.stringify(h)).toBe(before);
    });
});
