// @vitest-environment jsdom
// Logic parity on random data: the original and the refactored modules load the same seeded,
// partly damaged data into their Stores, then every statistic, label and schedule lookup is
// computed by both, on several "todays", and must be equal. Runs once refactored modules exist.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadLegacy } from '../harness/legacy.js';
import { loadModern } from '../harness/modern.js';
import { makeGenerator } from '../harness/generators.js';
import { NOW } from '../harness/impls.js';

vi.useFakeTimers({ now: NOW });
// all the modules the comparisons below call into
const MODULES = [
    'core/dates',
    'core/time',
    'core/schedule',
    'core/habit',
    'core/stats',
    'core/format',
    'core/analytics-range',
    'store/store',
    'store/sample-habits',
    'store/selectors'
];
const HAS_MODERN = !!(await loadModern({ modules: MODULES }));
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const HABITS_PER_SEED = 120;
const TODAYS = [
    new Date(2026, 9, 21, 10), // Wednesday
    new Date(2026, 9, 24, 23, 30), // Saturday night
    new Date(2026, 9, 25, 9), // the DST change day (Sunday)
    new Date(2026, 9, 18, 7), // Sunday
    new Date(2026, 9, 22, 0, 5) // just after midnight
];

const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

/** Calls fn with each implementation and returns [original, refactored], errors included. */
function both(legacy, modern, fn) {
    const run = impl => {
        try {
            return { value: fn(impl) };
        } catch (e) {
            return { error: `${e.name}: ${e.message}` };
        }
    };
    return [run(legacy), run(modern)];
}

describe.skipIf(!HAS_MODERN)('logic parity on random data', () => {
    afterEach(() => vi.restoreAllMocks());

    it.each(SEEDS)('seed %i: loading, repairs and storage', async seed => {
        const gen = makeGenerator(seed);
        const raw = JSON.stringify(gen.habits(HABITS_PER_SEED));
        const cats = JSON.stringify(gen.categories());
        const results = [];
        for (const create of [() => loadLegacy(), () => loadModern({ fresh: true, modules: MODULES })]) {
            vi.setSystemTime(NOW);
            localStorage.clear();
            localStorage.setItem('habit_tracker_he_v2', raw);
            localStorage.setItem('habit_tracker_categories_he_v2', cats);
            const warn = quiet();
            const impl = await create();
            impl.Store.load(impl.getDefaultHabits);
            results.push({
                habits: JSON.stringify(impl.Store.habits),
                categories: JSON.stringify(impl.Store.categories),
                storage: { ...localStorage },
                warnings: warn.mock.calls.map(c => c[0]),
                revision: impl.Store.revision
            });
            warn.mockRestore();
        }
        expect(results[1]).toEqual(results[0]);
    });

    it.each(SEEDS)('seed %i: statistics, schedules and labels on several days', async seed => {
        const gen = makeGenerator(seed);
        const raw = JSON.stringify(gen.habits(HABITS_PER_SEED));
        const load = async create => {
            vi.setSystemTime(NOW);
            localStorage.clear();
            localStorage.setItem('habit_tracker_he_v2', raw);
            quiet();
            const impl = await create();
            impl.Store.load(impl.getDefaultHabits);
            return impl;
        };
        const legacy = await load(() => loadLegacy());
        const modern = await load(() => loadModern({ fresh: true, modules: MODULES }));
        const mismatches = [];
        const same = (label, fn) => {
            const [a, b] = both(legacy, modern, fn);
            if (JSON.stringify(a) !== JSON.stringify(b)) {
                mismatches.push(
                    `${label}\n  original:   ${JSON.stringify(a).slice(0, 300)}\n  refactored: ${JSON.stringify(b).slice(0, 300)}`
                );
            }
        };
        const n = legacy.Store.habits.length;
        for (const today of TODAYS) {
            vi.setSystemTime(today);
            const tag = today.toISOString();
            const recent = impl => impl.buildDaysForRange(impl.getDateKeyDaysAgo(20), impl.getDateKeyDaysAgo(-3));
            for (let i = 0; i < n; i++) {
                const H = impl => impl.Store.habits[i];
                same(`${tag} #${i} streaks`, impl => [
                    impl.calculateStreak(H(impl)),
                    impl.calculateBestStreak(H(impl)),
                    impl.getHabitStreakUnit(H(impl)),
                    impl.getHabitStreakText(H(impl)),
                    impl.getHabitStreakLongText(H(impl))
                ]);
                same(`${tag} #${i} ranges`, impl =>
                    ['week', '7d', '30d', 'month'].flatMap(p => {
                        const r = impl.getPresetRange(p);
                        const days = impl.buildDaysForRange(r.start, r.end);
                        const prev = impl.getPreviousRangeBounds({ preset: p, ...r });
                        const prevDays = impl.buildDaysForRange(prev.start, prev.end);
                        return [
                            impl.getHabitRangeProgress(H(impl), days, true),
                            impl.getHabitRangeProgress(H(impl), days, false),
                            impl.getHabitRangeProgress(H(impl), prevDays, true)
                        ];
                    })
                );
                same(`${tag} #${i} weeks`, impl =>
                    [0, -1, -6].map(w => {
                        const week = impl.getWindow7Days(w);
                        return [impl.getWeeklyGoalForHabit(H(impl), week), impl.getWeeklyCountForHabit(H(impl), week)];
                    })
                );
                same(`${tag} #${i} days`, impl =>
                    recent(impl).map(d => {
                        const h = H(impl);
                        const on = impl.habitOn(h, d.key);
                        return [
                            impl.isHabitActiveOnKey(h, d.key),
                            impl.isHabitScheduledOnKey(h, d.key),
                            impl.isFlexibleOnKey(h, d.key),
                            impl.pickScheduleFields(on),
                            impl.isSlotDone(h, d.key, 0),
                            impl.isSlotDone(h, d.key, 1),
                            impl.hasAnyMarkOnDay(h, d.key),
                            impl.slotCount(impl.getScheduleVersion(h, d.key))
                        ];
                    })
                );
                same(`${tag} #${i} labels`, impl => {
                    const h = H(impl);
                    return [
                        impl.getHabitGoalLabel(h),
                        impl.scheduleTimeSummary(h),
                        impl.describeScheduleVersion(h, true),
                        impl.getHabitCategoryDisplay(h),
                        impl.formatStartDateLabel(h.startDate),
                        impl.findTimeOverlaps(h, h.id).map(o => [o.h.id, o.days, o.time])
                    ];
                });
            }
            same(`${tag} day stats`, impl =>
                recent(impl).map(d => [
                    impl.getDayStats(d),
                    impl.getDayStats(
                        d,
                        impl.Store.habits.filter((_, i) => i % 3 === 0)
                    )
                ])
            );
            same(`${tag} live habits`, impl => impl.getLiveHabits().map(h => h.id));
        }
        expect(mismatches.slice(0, 5).join('\n\n')).toBe('');
    });

    it.each(SEEDS)('seed %i: schedule normalization of random raw definitions', seed => {
        const gen = makeGenerator(seed * 1000);
        const legacy = loadLegacy();
        return loadModern({ fresh: true, modules: MODULES }).then(modern => {
            for (let i = 0; i < 400; i++) {
                const def = gen.scheduleFields();
                const [a, b] = both(legacy, modern, impl => impl.normalizeScheduleFields(structuredClone(def)));
                expect(b).toEqual(a);
            }
        });
    });
});
