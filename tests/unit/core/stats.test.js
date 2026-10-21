// @vitest-environment jsdom
// Statistics: day totals, weekly goals, current and best streaks, progress over a range.
// "Today" is Wednesday 21 Oct 2026; the current week is Sun 18 – Sat 24 Oct.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { implementations, NOW, setNow } from '../../harness/impls.js';

vi.useFakeTimers({ now: NOW });
const IMPLS = await implementations();

const marks = (...keys) => Object.fromEntries(keys.map(k => [k, true]));
const oct = (...days) => days.map(d => `2026-10-${String(d).padStart(2, '0')}`);

describe.each(IMPLS)('statistics (%s)', (_, impl) => {
    let seq = 0;
    const mk = extra => impl.normalizeHabitGoal({ id: `s${seq++}`, name: 'x', startDate: '2026-01-01', ...extra });
    const week = () => impl.getWindow7Days(0);
    const range = (a, b) => impl.buildDaysForRange(a, b);

    afterEach(() => vi.setSystemTime(NOW));

    describe('day totals', () => {
        it('counts due habits, done ones and bonus marks on a day', () => {
            const day = impl.dayObjForKey('2026-10-21'); // Wednesday
            const list = [
                mk({ goalType: 'daily', history: marks('2026-10-21') }),
                mk({ goalType: 'daily' }),
                mk({ goalType: 'fixed_days', fixedDays: [1], history: marks('2026-10-21') }), // bonus
                mk({ goalType: 'flexible', weeklyGoal: 3, history: marks('2026-10-21') }), // bonus
                mk({ goalType: 'daily', startDate: '2026-10-22', history: marks('2026-10-21') }) // not started
            ];
            expect(impl.computeDayStats(day, list)).toEqual({
                totalScheduled: 2,
                doneScheduled: 1,
                extraDone: 2,
                bonusDone: 2,
                totalDone: 3,
                pct: 50,
                allDone: false
            });
            expect(impl.computeDayStats(day, [])).toMatchObject({ totalScheduled: 0, pct: 0, allDone: false });
            expect(impl.computeDayStats(day, list.slice(0, 1))).toMatchObject({ pct: 100, allDone: true });
        });
    });

    describe('weekly goal and count', () => {
        it('owes the full goal for a full week', () => {
            expect(impl.getWeeklyGoalForHabit(mk({ goalType: 'daily' }), week())).toBe(7);
            expect(impl.getWeeklyGoalForHabit(mk({ goalType: 'fixed_days', fixedDays: [0, 2, 4] }), week())).toBe(3);
            expect(impl.getWeeklyGoalForHabit(mk({ goalType: 'flexible', weeklyGoal: 5 }), week())).toBe(5);
        });

        it('owes only its share when it started mid-week', () => {
            const start = { startDate: '2026-10-21' };
            expect(impl.getWeeklyGoalForHabit(mk({ goalType: 'daily', ...start }), week())).toBe(4);
            expect(
                impl.getWeeklyGoalForHabit(mk({ goalType: 'fixed_days', fixedDays: [0, 2, 4], ...start }), week())
            ).toBe(1);
            expect(impl.getWeeklyGoalForHabit(mk({ goalType: 'flexible', weeklyGoal: 5, ...start }), week())).toBe(3);
            expect(
                impl.getWeeklyGoalForHabit(
                    mk({ goalType: 'flexible', weeklyGoal: 5, archivedSince: '2026-10-18' }),
                    week()
                )
            ).toBe(0);
        });

        it('counts each day by the version in force that day', () => {
            const h = mk({
                schedule: [
                    { from: null, goalType: 'daily' },
                    { from: '2026-10-21', goalType: 'flexible', weeklyGoal: 3 }
                ]
            });
            expect(impl.getWeeklyGoalForHabit(h, week())).toBe(5); // 3 daily days + ceil(3 * 4 / 7)
            expect(impl.getWeeklyGoalForHabit(impl.habitOn(h, '2026-10-21'), week())).toBe(5);
        });

        it('counts the done days of the week while the habit was active', () => {
            const h = mk({
                startDate: '2026-10-19',
                history: marks('2026-10-18', '2026-10-19', '2026-10-21', '2026-10-25')
            });
            expect(impl.getWeeklyCountForHabit(h, week())).toBe(2);
        });
    });

    describe('current streak', () => {
        const streak = h => impl.calculateStreak(h);

        it('counts consecutive done days, today included when done', () => {
            expect(streak(mk({ history: marks(...oct(21, 20, 19)) }))).toBe(3);
            expect(impl.getHabitStreakUnit(mk({}))).toBe('ימים');
        });

        it('does not break on today while it is still open', () => {
            expect(streak(mk({ history: marks(...oct(20, 19)) }))).toBe(2);
            expect(streak(mk({ history: marks(...oct(19)) }))).toBe(0);
        });

        it('skips days that were not due by that day’s settings', () => {
            const h = mk({ goalType: 'fixed_days', fixedDays: [1, 3], history: marks(...oct(21, 19, 14, 12)) });
            expect(streak(h)).toBe(4);
        });

        it('stops at the start date and skips paused days', () => {
            expect(streak(mk({ startDate: '2026-10-19', history: marks(...oct(21, 20, 19, 18)) }))).toBe(3);
            const paused = mk({
                pausedRanges: [['2026-10-15', '2026-10-17']],
                history: marks(...oct(21, 20, 19, 18, 14))
            });
            expect(streak(paused)).toBe(5);
        });

        it('counts weeks that met the quota for a flexible habit (the current week may be in progress)', () => {
            const h = mk({
                goalType: 'flexible',
                weeklyGoal: 2,
                history: marks(...oct(19), ...oct(12, 15), ...oct(5, 6, 9), '2026-09-29')
            });
            expect(streak(h)).toBe(2);
            expect(impl.getHabitStreakUnit(h)).toBe('שבועות');
            const met = mk({ goalType: 'flexible', weeklyGoal: 2, history: marks(...oct(19, 20), ...oct(12, 15)) });
            expect(streak(met)).toBe(2);
        });

        it('builds the streak labels', () => {
            const h = mk({ history: marks(...oct(21, 20)) });
            expect(impl.getHabitStreakText(h)).toBe('רצף 2 ימים');
            expect(impl.getHabitStreakLongText(h)).toBe('רצף של 2 ימים');
            expect(impl.getHabitStreakText(mk({}))).toBe('');
        });

        it('caps the current streak at 365 days', () => {
            const keys = Array.from({ length: 500 }, (_, i) => impl.getDateKeyDaysAgo(i));
            expect(streak(mk({ startDate: '2020-01-01', history: marks(...keys) }))).toBe(365);
        });
    });

    describe('best streak', () => {
        const best = h => impl.calculateBestStreak(h);

        it('finds the longest run of due days', () => {
            const h = mk({
                startDate: '2026-10-01',
                history: marks(...oct(1, 2, 3, 4, 5), ...oct(10, 11, 12), ...oct(20, 21))
            });
            expect(best(h)).toBe(5);
        });

        it('lets rest days and paused days pass, and today stay open', () => {
            const fixed = mk({
                goalType: 'fixed_days',
                fixedDays: [1, 3],
                startDate: '2026-10-01',
                history: marks(...oct(5, 7, 12, 14, 19))
            });
            expect(best(fixed)).toBe(5);
            const open = mk({ startDate: '2026-10-18', history: marks(...oct(18, 19, 20)) });
            expect(best(open)).toBe(3);
        });

        it('ignores marks before the start date, and looks back 730 days', () => {
            expect(best(mk({ startDate: '2026-10-10', history: marks(...oct(1, 2, 3)) }))).toBe(0);
            const keys = Array.from({ length: 900 }, (_, i) => impl.getDateKeyDaysAgo(i));
            expect(best(mk({ startDate: '2020-01-01', history: marks(...keys) }))).toBe(731);
        });

        it('counts weeks for flexible habits', () => {
            const h = mk({
                goalType: 'flexible',
                weeklyGoal: 2,
                startDate: '2026-09-01',
                history: marks('2026-09-01', '2026-09-02', '2026-09-08', '2026-09-09', '2026-09-15', ...oct(5, 6))
            });
            expect(best(h)).toBe(2);
        });
    });

    describe('progress over a range', () => {
        const progress = (h, a, b, elapsedOnly) => impl.getHabitRangeProgress(h, range(a, b), elapsedOnly);

        it('counts due days, optionally only the elapsed ones', () => {
            const h = mk({ history: marks(...oct(18, 20, 21)) });
            expect(progress(h, '2026-10-18', '2026-10-24', true)).toEqual({ target: 4, done: 3 });
            expect(progress(h, '2026-10-18', '2026-10-24', false)).toEqual({ target: 7, done: 3 });
        });

        it('owes a flexible week its share, rounded down while the week is in progress', () => {
            const h = mk({ goalType: 'flexible', weeklyGoal: 5, history: marks(...oct(18, 20, 21)) });
            expect(progress(h, '2026-10-18', '2026-10-24', true)).toEqual({ target: 2, done: 2 });
            expect(progress(h, '2026-10-18', '2026-10-24', false)).toEqual({ target: 5, done: 3 });
            expect(progress(h, '2026-10-11', '2026-10-17', true)).toEqual({ target: 5, done: 0 });
            setNow(vi, 2026, 10, 18);
            expect(progress(mk({ goalType: 'flexible', weeklyGoal: 2 }), '2026-10-18', '2026-10-24', true)).toEqual({
                target: 0,
                done: 0
            });
        });

        it('splits by version when the schedule changed inside the range', () => {
            const h = mk({
                schedule: [
                    { from: null, goalType: 'daily' },
                    { from: '2026-10-20', goalType: 'flexible', weeklyGoal: 3 }
                ],
                history: marks(...oct(18, 20, 21))
            });
            expect(progress(h, '2026-10-18', '2026-10-24', true)).toEqual({ target: 2, done: 1 });
            // 18–19 daily (2 due) + 20–24 flexible: ceil(3 * 5 / 7) = 3
            expect(progress(h, '2026-10-18', '2026-10-24', false)).toEqual({ target: 5, done: 3 });
            expect(progress(h, '2026-10-11', '2026-10-24', false)).toEqual({ target: 12, done: 3 });
        });

        it('returns an empty result for no days', () => {
            expect(impl.getHabitRangeProgress(mk({}), [], true)).toEqual({ target: 0, done: 0 });
        });
    });
});
