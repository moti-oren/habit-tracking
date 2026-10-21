// @vitest-environment jsdom
// A habit's own state: normalization of stored habits, activity (start, archive, pauses), marks.
import { describe, expect, it, vi } from 'vitest';
import { implementations, NOW } from '../../harness/impls.js';

vi.useFakeTimers({ now: NOW });
const IMPLS = await implementations(['core/habit', 'core/dates']);

describe.each(IMPLS)('normalizeHabitGoal (%s)', (_, impl) => {
    const norm = h => impl.normalizeHabitGoal({ id: 'h', name: 'n', ...h });

    it('gives a habit without history an empty one and builds its schedule', () => {
        const h = norm({});
        expect(h.history).toEqual({});
        expect(h.schedule).toHaveLength(1);
        expect(h.goalType).toBe('daily');
        expect(norm({ history: 'x' }).history).toEqual({});
    });

    it('cleans per-occurrence marks and drops a damaged slotHistory', () => {
        const h = norm({ slotHistory: { '2026-10-20': [1, 0, 'x'], bad: [true], '2026-10-19': 'no' } });
        expect(h.slotHistory).toEqual({ '2026-10-20': [true, false, true] });
        expect('slotHistory' in norm({ slotHistory: null })).toBe(false);
        expect('slotHistory' in norm({ slotHistory: 5 })).toBe(false);
        expect('slotHistory' in norm({})).toBe(false);
    });

    it('migrates colours of the old palette', () => {
        const colour = c => norm({ color: c }).color;
        expect(['emerald', 'rose', 'cyan', 'amber', 'indigo', 'red'].map(colour)).toEqual([
            'teal',
            'pink',
            'sky',
            'orange',
            'indigo',
            'red'
        ]);
    });

    it('infers a missing start date: earliest of the first check and the id timestamp, else today', () => {
        const created = new Date(2026, 0, 15, 12).getTime();
        expect(norm({ id: `h_${created}`, history: { '2026-02-01': true, '2026-01-02': false } }).startDate).toBe(
            '2026-01-15'
        );
        expect(norm({ id: `h_${created}`, history: { '2026-01-10': true } }).startDate).toBe('2026-01-10');
        expect(norm({ slotHistory: { '2026-03-03': [false, true] } }).startDate).toBe('2026-03-03');
        expect(norm({ slotHistory: { '2026-03-03': [false, false] } }).startDate).toBe('2026-10-21');
        expect(norm({ id: 'h_123' }).startDate).toBe('2026-10-21'); // too short to be a timestamp
        expect(norm({ startDate: '2025-05-05', history: { '2025-01-01': true } }).startDate).toBe('2025-05-05');
        expect(norm({ startDate: 'bad' }).startDate).toBe('2026-10-21');
    });

    it('drops a damaged archive date and damaged pause ranges', () => {
        expect('archivedSince' in norm({ archivedSince: 'soon' })).toBe(false);
        expect(norm({ archivedSince: '2026-10-01' }).archivedSince).toBe('2026-10-01');
        expect(norm({}).pausedRanges).toEqual([]);
        expect(norm({ pausedRanges: 'x' }).pausedRanges).toEqual([]);
        expect(
            norm({ pausedRanges: [['2026-01-01', '2026-01-05'], ['2026-02-01'], 'x', ['a', 'b']] }).pausedRanges
        ).toEqual([['2026-01-01', '2026-01-05']]);
    });
});

describe.each(IMPLS)('habit activity and marks (%s)', (_, impl) => {
    const h = impl.normalizeHabitGoal({
        id: 'a',
        name: 'a',
        startDate: '2026-10-05',
        archivedSince: '2026-10-20',
        pausedRanges: [['2026-10-10', '2026-10-12']],
        history: { '2026-10-06': true, '2026-10-07': false },
        slotHistory: { '2026-10-08': [false, true] }
    });

    it('exists only from its start date, outside pauses and before its archive date', () => {
        const active = key => impl.isHabitActiveOnKey(h, key);
        expect(
            ['2026-10-04', '2026-10-05', '2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13'].map(active)
        ).toEqual([false, true, true, false, false, true]);
        expect(active('2026-10-19')).toBe(true);
        expect(active('2026-10-20')).toBe(false);
        expect(impl.isHabitActiveOnKey(null, '2026-01-01')).toBe(true);
        expect(impl.isHabitArchived(h)).toBe(true);
        expect(impl.isHabitArchived({})).toBe(false);
        expect(impl.isHabitArchived(null)).toBe(false);
    });

    it('is active in a list of days if it is active on any of them', () => {
        const days = keys => keys.map(k => impl.dayObjForKey(k));
        expect(impl.isHabitActiveInDays(h, days(['2026-10-01', '2026-10-10']))).toBe(false);
        expect(impl.isHabitActiveInDays(h, days(['2026-10-01', '2026-10-13']))).toBe(true);
        expect(impl.isHabitActiveInDays(h, [])).toBe(true);
    });

    it('reads whole-day and per-occurrence marks', () => {
        expect(impl.isSlotDone(h, '2026-10-06', 3)).toBe(true); // whole day counts for every occurrence
        expect(impl.isSlotDone(h, '2026-10-07', 0)).toBe(false);
        expect(impl.isSlotDone(h, '2026-10-08', 0)).toBe(false);
        expect(impl.isSlotDone(h, '2026-10-08', 1)).toBe(true);
        expect(impl.hasAnyMarkOnDay(h, '2026-10-06')).toBe(true);
        expect(impl.hasAnyMarkOnDay(h, '2026-10-07')).toBe(false);
        expect(impl.hasAnyMarkOnDay(h, '2026-10-08')).toBe(true);
        expect(impl.getEarliestCheckedKey(h)).toBe('2026-10-06');
        expect(impl.getEarliestCheckedKey({ history: {} })).toBe(null);
    });

    it('displays the category trimmed, or "no category"', () => {
        expect(impl.getHabitCategoryDisplay({ category: ' כושר ' })).toBe('כושר');
        expect(impl.getHabitCategoryDisplay({ category: '' })).toBe('ללא קטגוריה');
        expect(impl.getHabitCategoryDisplay({})).toBe('ללא קטגוריה');
        expect(impl.getHabitCategoryDisplay(null)).toBe('ללא קטגוריה');
    });
});
