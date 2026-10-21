// @vitest-environment jsdom
// The Store: loading (old keys, damaged and hand-edited data), repairs, persistence, mutations,
// invariants and revisions. Every test gets a fresh instance and an empty localStorage.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { implementationFactories, NOW } from '../../harness/impls.js';

vi.useFakeTimers({ now: NOW });
const FACTORIES = await implementationFactories();

const KEYS = {
    habits: 'habit_tracker_he_v2',
    categories: 'habit_tracker_categories_he_v2',
    prefs: 'habit_tracker_prefs_he_v2',
    old: 'pulse_habit_tracker_he_v2'
};
const stored = key => JSON.parse(localStorage.getItem(key));
const DEFAULT_ICON = '🏋️';

describe.each(FACTORIES)('Store (%s)', (_, create) => {
    let impl;
    let Store;
    let warn;

    beforeEach(async () => {
        vi.setSystemTime(NOW);
        localStorage.clear();
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        impl = await create();
        Store = impl.Store;
    });
    afterEach(() => vi.restoreAllMocks());

    const put = (key, value) => localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    const load = ({ habits, categories } = {}) => {
        if (habits !== undefined) put(KEYS.habits, habits);
        if (categories !== undefined) put(KEYS.categories, categories);
        Store.load(impl.getDefaultHabits);
        return Store.habits;
    };
    const ids = () => Store.habits.map(h => h.id);

    describe('loading', () => {
        it('starts from the sample habits, sorted by name, and saves them', () => {
            load();
            expect(ids()).toEqual(['h1', 'h2', 'h5', 'h3', 'h4']);
            expect(Store.categories).toEqual(['בריאות', 'כושר', 'למידה', 'מיינדפולנס', 'פוקוס']);
            expect(stored(KEYS.habits)).toEqual(JSON.parse(JSON.stringify(Store.habits)));
            expect(stored(KEYS.categories)).toEqual(Store.categories);
            expect(localStorage.getItem(KEYS.prefs)).toBe(null);
            expect(Store.revision).toBe(1);
        });

        it('loads the old storage key when the current one is missing, then saves under the current key', () => {
            put(KEYS.old, [{ id: 'x1', name: 'ישן', goalType: 'daily', startDate: '2026-10-01' }]);
            load();
            expect(ids()).toEqual(['x1']);
            expect(stored(KEYS.habits).map(h => h.id)).toEqual(['x1']);
            expect(localStorage.getItem(KEYS.old)).not.toBe(null);
        });

        it('prefers the current key over the old one', () => {
            put(KEYS.old, [{ id: 'old', name: 'old' }]);
            load({ habits: [{ id: 'new', name: 'new' }] });
            expect(ids()).toEqual(['new']);
        });

        it('falls back to the samples (and overwrites) when the stored list is unreadable or not a list', () => {
            load({ habits: '{bad json' });
            expect(ids()).toEqual(['h1', 'h2', 'h5', 'h3', 'h4']);
            expect(warn).toHaveBeenCalledWith('Ignoring damaged habits data', expect.anything());
            expect(stored(KEYS.habits)).toHaveLength(5);
        });

        it('treats a stored non-list as missing', async () => {
            load({ habits: { a: 1 } });
            expect(ids()).toHaveLength(5);
            impl = await create();
            Store = impl.Store;
            load({ habits: [] });
            expect(ids()).toEqual([]);
        });

        it('skips damaged entries one by one and repairs ids and names', () => {
            const now = NOW.getTime();
            load({
                habits: [
                    null,
                    42,
                    'x',
                    [],
                    { id: 'ok', name: 'קריאה', history: { '2026-10-20': true } },
                    { id: 'bad id!', name: '' },
                    { id: 'dup', name: 'א' },
                    { id: 'dup', name: 'ב' },
                    { id: 'h9', name: 'x', goalType: 'fixed_days', fixedDays: [9] } // throws: dropped
                ]
            });
            expect(ids()).toEqual(['dup', `h_${now}_7`, `h_${now}_5`, 'ok']);
            expect(Store.find(`h_${now}_5`).name).toBe('הרגל ללא שם');
            expect(warn).toHaveBeenCalledWith('Skipped a damaged habit', expect.any(TypeError));
            expect(stored(KEYS.habits).map(h => h.id)).toEqual(ids());
        });

        it('repairs invalid fields', () => {
            load({
                habits: [
                    {
                        id: 'f1',
                        name: 'x'.repeat(130),
                        note: 5,
                        category: 7,
                        icon: '<b>',
                        color: 3,
                        history: { '2026-10-20': 1, bad: true, '2026-10-19': 0 }
                    },
                    { id: 'f2', name: '  ', note: 'n'.repeat(301), icon: '  📚 ', history: [true] },
                    { id: 'f3', name: 'b', icon: 'x'.repeat(33) },
                    { id: 'f4', name: 'c', icon: 'a\\b' },
                    { id: 'f5', name: 'd', icon: '' }
                ]
            });
            const f1 = Store.find('f1');
            expect(f1).toMatchObject({ note: '', category: '', icon: DEFAULT_ICON, color: 'indigo' });
            expect(f1.name).toHaveLength(120);
            expect(f1.history).toEqual({ '2026-10-20': true, '2026-10-19': false });
            const f2 = Store.find('f2');
            expect(f2).toMatchObject({ name: 'הרגל ללא שם', icon: '📚', history: {} });
            expect(f2.note).toHaveLength(300);
            expect(['f3', 'f4', 'f5'].map(id => Store.find(id).icon)).toEqual([
                DEFAULT_ICON,
                DEFAULT_ICON,
                DEFAULT_ICON
            ]);
        });

        it('keeps valid data byte for byte', async () => {
            load();
            const saved = localStorage.getItem(KEYS.habits);
            impl = await create();
            Store = impl.Store;
            load();
            expect(localStorage.getItem(KEYS.habits)).toBe(saved);
        });

        it('cleans the category list and adds the categories habits use', () => {
            load({
                habits: [{ id: 'a', name: 'a', category: 'חדש' }],
                categories: ['  כושר ', 'כושר', 5, '', 'הכל', 'ללא קטגוריה', 'x'.repeat(41), null, 'ב']
            });
            expect(Store.categories).toEqual(['5', 'ב', 'חדש', 'כושר']);
        });

        it('keeps the default categories when the stored list is damaged', () => {
            load({ habits: [], categories: '{x' });
            expect(Store.categories).toEqual(['בריאות', 'כושר', 'למידה', 'מיינדפולנס', 'פוקוס']);
            expect(warn).toHaveBeenCalledWith('Ignoring damaged data in', KEYS.categories, expect.anything());
        });

        it('removes marks dated after today', () => {
            load({
                habits: [
                    {
                        id: 'a',
                        name: 'a',
                        history: { '2026-10-21': true, '2026-10-22': true },
                        slotHistory: { '2026-10-23': [true] }
                    }
                ]
            });
            expect(Store.find('a').history).toEqual({ '2026-10-21': true });
            expect(Store.find('a').slotHistory).toEqual({});
        });

        it('survives storage that cannot be read', () => {
            vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('blocked');
            });
            load();
            expect(ids()).toHaveLength(5);
            expect(warn).toHaveBeenCalledWith('Could not read', KEYS.categories, expect.any(Error));
        });
    });

    describe('preferences', () => {
        it('loads only a plain object', () => {
            expect(Store.loadPrefs()).toBe(null);
            for (const bad of ['[1]', '5', '"x"', '{bad']) {
                put(KEYS.prefs, bad);
                expect(Store.loadPrefs()).toBe(null);
            }
            put(KEYS.prefs, { soundEnabled: false });
            expect(Store.loadPrefs()).toEqual({ soundEnabled: false });
        });

        it('saves preferences on their own and with every commit', () => {
            Store.savePrefs({ a: 1 });
            expect(stored(KEYS.prefs)).toEqual({ a: 1 });
            Store.configure({ prefsProvider: () => ({ b: 2 }) });
            load();
            expect(stored(KEYS.prefs)).toEqual({ b: 2 });
        });
    });

    describe('persistence errors', () => {
        const failWith = err =>
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw err;
            });

        it('reports a full storage as "quota" and keeps the data in memory', () => {
            load();
            const onPersistError = vi.fn();
            Store.configure({ onPersistError });
            failWith(new DOMException('full', 'QuotaExceededError'));
            Store.addCategory('חדשה');
            expect(onPersistError).toHaveBeenCalledWith('quota');
            expect(Store.categories).toContain('חדשה');
            expect(warn).toHaveBeenCalledWith('Could not persist', KEYS.categories, expect.anything());
        });

        it('reports any other failure as "unavailable" and retries on the next commit', () => {
            load();
            const onPersistError = vi.fn();
            Store.configure({ onPersistError });
            const spy = failWith(new Error('blocked'));
            Store.addCategory('חדשה');
            expect(onPersistError).toHaveBeenCalledWith('unavailable');
            spy.mockRestore();
            Store.moveHabits([], '');
            expect(stored(KEYS.categories)).toContain('חדשה');
        });

        it('does not rewrite a value that has not changed', () => {
            load();
            const spy = vi.spyOn(Storage.prototype, 'setItem');
            Store.moveHabits([], '');
            expect(spy).not.toHaveBeenCalled();
            Store.addCategory('x');
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(KEYS.categories, expect.any(String));
        });
    });

    describe('marks', () => {
        beforeEach(() =>
            load({
                habits: [
                    { id: 'a', name: 'a', startDate: '2026-10-01' },
                    { id: 's', name: 's', startDate: '2026-10-01', slotTimes: ['07:00', '19:00'] },
                    { id: 'b', name: 'b', startDate: '2026-10-01', history: { '2026-10-21': true } }
                ]
            })
        );

        it('toggles a whole day', () => {
            expect(Store.toggleDay('a', '2026-10-21')).toEqual({ on: true, slot: undefined });
            expect(Store.find('a').history['2026-10-21']).toBe(true);
            expect(Store.toggleDay('a', '2026-10-21')).toEqual({ on: false, slot: undefined });
            expect(Store.find('a').history['2026-10-21']).toBe(false);
            expect(Store.toggleDay('missing', '2026-10-21')).toBe(null);
        });

        it('toggles one occurrence; the day is done only when all are', () => {
            expect(Store.toggleDay('s', '2026-10-21', 1)).toEqual({ on: true, slot: 1 });
            expect(Store.find('s').slotHistory['2026-10-21']).toEqual([false, true]);
            expect(Store.find('s').history['2026-10-21']).toBe(false);
            Store.toggleDay('s', '2026-10-21', 0);
            expect(Store.find('s').history['2026-10-21']).toBe(true);
            // a whole-day toggle drops the per-occurrence marks of that day
            expect(Store.toggleDay('s', '2026-10-21')).toEqual({ on: false, slot: undefined });
            expect('2026-10-21' in Store.find('s').slotHistory).toBe(false);
        });

        it('marks and clears several habits on a day', () => {
            Store.toggleDay('s', '2026-10-20', 0);
            Store.markDay(['a', 's'], '2026-10-20');
            expect([Store.find('a').history['2026-10-20'], Store.find('s').history['2026-10-20']]).toEqual([
                true,
                true
            ]);
            expect('2026-10-20' in Store.find('s').slotHistory).toBe(false);
            Store.clearDay(['a', 'b'], '2026-10-21');
            expect(Store.find('b').history['2026-10-21']).toBe(false);
            expect('2026-10-21' in Store.find('a').history).toBe(false); // untouched: it had no mark
        });
    });

    describe('habits and categories', () => {
        beforeEach(() =>
            load({
                habits: [
                    { id: 'a', name: 'ב', category: 'כושר', startDate: '2026-10-01', history: { '2026-10-21': true } },
                    { id: 'b', name: 'ג', category: 'כושר', startDate: '2026-10-01' },
                    { id: 'c', name: 'ד', category: 'למידה', startDate: '2026-10-01', archivedSince: '2026-10-10' }
                ],
                categories: ['כושר', 'למידה']
            })
        );

        it('adds a habit (normalized) and keeps the list sorted', () => {
            const h = Store.addHabit({
                id: 'n',
                name: 'א',
                category: 'חדש',
                goalType: 'fixed_days',
                fixedDays: [3, 1]
            });
            expect(h).toBe(Store.find('n'));
            expect(h).toMatchObject({ fixedDays: [1, 3], weeklyGoal: 2, startDate: '2026-10-21' });
            expect(ids()).toEqual(['n', 'a', 'b', 'c']);
            expect(Store.categories).toEqual(['חדש', 'כושר', 'למידה']);
        });

        it('updates a habit, its schedule from today on, and re-sorts', () => {
            const def = impl.normalizeScheduleFields({ goalType: 'flexible', weeklyGoal: 2 });
            Store.updateHabit('a', { name: 'ת' }, def, 'forward');
            expect(ids()).toEqual(['b', 'c', 'a']);
            expect(Store.find('a').schedule.map(v => [v.from, v.goalType])).toEqual([
                [null, 'daily'],
                ['2026-10-21', 'flexible']
            ]);
            expect(Store.updateHabit('missing', {}, def, 'all')).toBe(null);
        });

        it('archives from today, or from tomorrow when already checked today', () => {
            expect(Store.archiveHabits(['a', 'b', 'c'], '2026-10-21', '2026-10-22')).toBe(2);
            expect(Store.find('a').archivedSince).toBe('2026-10-22');
            expect(Store.find('b').archivedSince).toBe('2026-10-21');
            expect(Store.find('c').archivedSince).toBe('2026-10-10');
            const rev = Store.revision;
            expect(Store.archiveHabits(['c'], '2026-10-21', '2026-10-22')).toBe(0);
            expect(Store.revision).toBe(rev);
        });

        it('restores an archived habit and remembers the gap as a pause', () => {
            expect(Store.restoreHabit('c', '2026-10-20')).toBe(true);
            expect(Store.find('c').pausedRanges).toEqual([['2026-10-10', '2026-10-20']]);
            expect('archivedSince' in Store.find('c')).toBe(false);
            expect(Store.restoreHabit('c', '2026-10-20')).toBe(false);
            Store.archiveHabits(['b'], '2026-10-21', '2026-10-22');
            Store.restoreHabit('b', '2026-10-20'); // archived today: no gap
            expect(Store.find('b').pausedRanges).toEqual([]);
        });

        it('moves, renames and deletes categories', () => {
            Store.moveHabits(['b'], 'למידה');
            expect(Store.find('b').category).toBe('למידה');
            Store.renameCategory('למידה', 'קריאה');
            expect(Store.categories).toEqual(['כושר', 'קריאה']);
            expect(['b', 'c'].map(id => Store.find(id).category)).toEqual(['קריאה', 'קריאה']);
            Store.deleteCategories(['קריאה']);
            expect(Store.categories).toEqual(['כושר']);
            expect(['b', 'c'].map(id => Store.find(id).category)).toEqual(['', '']);
        });

        it('deletes habits', () => {
            Store.deleteHabits(['a', 'c']);
            expect(ids()).toEqual(['b']);
        });

        it('restores a snapshot deeply copied from an earlier state', () => {
            const snap = Store.snapshot();
            expect(snap.habits).not.toBe(Store.habits);
            Store.deleteHabits(['a']);
            Store.addCategory('זמני');
            Store.restore(snap);
            expect(ids()).toEqual(['a', 'b', 'c']);
            expect(Store.categories).toEqual(['כושר', 'למידה']);
        });

        it('resets to the samples and the default categories', () => {
            Store.resetToDefaults(impl.getDefaultHabits);
            expect(ids()).toEqual(['h1', 'h2', 'h5', 'h3', 'h4']);
            expect(Store.categories).toEqual(['בריאות', 'כושר', 'למידה', 'מיינדפולנס', 'פוקוס']);
        });

        it('lists the live (not archived) habits, frozen and cached per revision', () => {
            const live = Store.liveHabits();
            expect(live.map(h => h.id)).toEqual(['a', 'b']);
            expect(Object.isFrozen(live)).toBe(true);
            expect(Store.liveHabits()).toBe(live);
            Store.restoreHabit('c', '2026-10-20');
            expect(Store.liveHabits()).not.toBe(live);
            expect(Store.liveHabits().map(h => h.id)).toEqual(['a', 'b', 'c']);
        });

        it('bumps the revision on every commit and a habit revision only when that habit changed', () => {
            const rev = Store.revision;
            const [ra, rb] = [Store.habitRevision('a'), Store.habitRevision('b')];
            Store.toggleDay('b', '2026-10-21');
            expect(Store.revision).toBe(rev + 1);
            expect(Store.habitRevision('a')).toBe(ra);
            expect(Store.habitRevision('b')).toBeGreaterThan(rb);
            Store.deleteHabits(['b']);
            expect(Store.habitRevision('b')).toBe(undefined);
        });
    });
});
