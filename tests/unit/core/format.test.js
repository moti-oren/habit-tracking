// @vitest-environment jsdom
// Text shown to the user: day sets, time summaries, goal labels, dates and ranges (Hebrew, RTL).
import { describe, expect, it, vi } from 'vitest';
import { implementations, NOW, setNow } from '../../harness/impls.js';

vi.useFakeTimers({ now: NOW });
const IMPLS = await implementations([
    'core/format',
    'core/analytics-range',
    'core/schedule',
    'core/habit',
    'ui/dom/html'
]);
const iso = s => `⁦${s}⁩`;

describe.each(IMPLS)('formatting (%s)', (_, impl) => {
    it('writes weekday sets with ranges for 3+ consecutive days', () => {
        expect(impl.formatDaySet([0, 1, 2, 3, 4])).toBe('א׳–ה׳');
        expect(impl.formatDaySet([0, 2, 4])).toBe('א׳, ג׳, ה׳');
        expect(impl.formatDaySet([0, 1, 3, 4, 5])).toBe('א׳, ב׳, ד׳–ו׳');
        expect(impl.formatDaySet([6, 0])).toBe('א׳, ש׳');
        expect(impl.formatDaySet([])).toBe('');
    });

    it('summarizes the times of a schedule', () => {
        const def = extra => impl.normalizeScheduleFields({ goalType: 'daily', ...extra });
        expect(impl.scheduleTimeSummary(def({ time: '06:00', duration: 60 }))).toBe(iso('06:00–07:00'));
        expect(impl.scheduleTimeSummary(def({}))).toBe('');
        expect(impl.scheduleTimeSummary(def({ slotTimes: ['18:00', '07:00'] }))).toBe(
            `2 פעמים ביום: ${iso('07:00')}, ${iso('18:00')}`
        );
        expect(impl.scheduleTimeSummary(def({ slotTimes: ['07:00', ''] }))).toBe(
            `2 פעמים ביום: ${iso('07:00')}, ללא שעה`
        );
        const perDay = def({
            goalType: 'fixed_days',
            fixedDays: [0, 1, 2, 3, 4],
            dayTimes: [['06:00'], ['06:00'], ['06:00'], ['06:00'], ['09:00'], [], []]
        });
        expect(impl.scheduleTimeSummary(perDay)).toBe(`א׳–ד׳ ${iso('06:00')} · ה׳ ${iso('09:00')}`);
        const withBlank = def({ dayTimes: [['06:00'], [''], ['06:00'], ['06:00'], ['06:00'], ['06:00'], ['06:00']] });
        expect(impl.scheduleTimeSummary(withBlank)).toBe(`א׳, ג׳–ש׳ ${iso('06:00')} · ב׳ ללא שעה`);
    });

    it('labels goals', () => {
        const h = extra => impl.normalizeHabitGoal({ id: 'g', name: 'g', ...extra });
        expect(impl.getHabitGoalLabel(h({ goalType: 'daily' }))).toBe('כל יום (7/7)');
        expect(impl.getHabitGoalLabel(h({ goalType: 'fixed_days', fixedDays: [2, 0] }))).toBe('ימים קבועים: א׳, ג׳');
        expect(impl.getHabitGoalLabel(h({ goalType: 'flexible', weeklyGoal: 3 }))).toBe('3 ימים בשבוע (גמיש)');
        expect(impl.getHabitGoalLabel(h({ goalType: 'daily', slotTimes: ['', ''] }))).toBe(
            'כל יום (7/7) · 2 פעמים ביום'
        );
        expect(impl.getHabitGoalTypeLabel({ goalType: 'flexible' })).toBe('4 ימים בשבוע (גמיש)');
        expect(impl.describeScheduleVersion(h({ time: '06:00' }), false)).toBe(`כל יום (7/7), ${iso('06:00')}`);
        expect(impl.describeScheduleVersion(h({}), true)).toBe('כל יום (7/7), ללא שעה');
        expect(impl.describeScheduleVersion(h({ slotTimes: ['', ''] }), false)).toBe('כל יום (7/7) · 2 פעמים ביום');
    });

    it('formats dates, with the year only when it is not the current one', () => {
        expect(impl.formatStartDateLabel('2026-10-05')).toBe('5 באוקטובר');
        expect(impl.formatStartDateLabel('2025-12-31')).toBe('31 בדצמבר 2025');
        expect(impl.formatStartDateLabel('bad')).toBe('');
        expect(impl.formatDateTriggerLabel('2026-10-21')).toBe('היום, יום ד׳, 21 באוקטובר');
        expect(impl.formatDateTriggerLabel('2026-10-20')).toBe('אתמול, יום ג׳, 20 באוקטובר');
        expect(impl.formatDateTriggerLabel('2025-01-04')).toBe('שבת, 4 בינואר 2025');
        expect(impl.formatDateTriggerLabel('')).toBe('');
        expect(impl.formatDateCompactLabel('2026-10-05')).toBe('5 באוק׳');
        expect(impl.formatDateCompactLabel('2025-01-04')).toBe('4 בינו׳ 2025');
        expect(impl.formatDateCompactLabel(null)).toBe('');
    });

    it('formats the label of a week', () => {
        const label = (a, b) => impl.formatWeekRangeText(impl.dayObjForKey(a), impl.dayObjForKey(b));
        expect(label('2026-10-18', '2026-10-24')).toBe(`${iso('18–24')} באוקטובר`);
        expect(label('2026-09-27', '2026-10-03')).toBe('27 בספטמבר - 3 באוקטובר');
        expect(label('2026-12-27', '2027-01-02')).toBe('27 בדצמבר - 2 בינואר 2027');
        expect(label('2025-10-12', '2025-10-18')).toBe(`${iso('12–18')} באוקטובר 2025`);
    });

    it('greets by the hour', () => {
        const at = h => {
            setNow(vi, 2026, 10, 21, h);
            return impl.getGreetingByHour();
        };
        expect([4, 5, 11, 12, 16, 17, 21, 22].map(at)).toEqual([
            'לילה טוב',
            'בוקר טוב',
            'בוקר טוב',
            'צהריים טובים',
            'צהריים טובים',
            'ערב טוב',
            'ערב טוב',
            'לילה טוב'
        ]);
        vi.setSystemTime(NOW);
    });

    it('isolates numbers and times for RTL text and HTML', () => {
        expect(impl.isoNum('18–24')).toBe(iso('18–24'));
        expect(impl.timeRangeHtml('06:00', 30, 'x')).toBe('<span dir="ltr" class="tabular-nums x">06:00–06:30</span>');
    });

    it('counts habits in words', () => {
        expect(impl.habitCountLabel(1)).toBe('הרגל אחד');
        expect(impl.habitCountLabel(3)).toBe('3 הרגלים');
    });
});

describe.each(IMPLS)('analytics ranges (%s)', (_, impl) => {
    it('computes the preset ranges from today', () => {
        expect(impl.getPresetRange('week')).toEqual({ start: '2026-10-18', end: '2026-10-24' });
        expect(impl.getPresetRange('7d')).toEqual({ start: '2026-10-15', end: '2026-10-21' });
        expect(impl.getPresetRange('30d')).toEqual({ start: '2026-09-22', end: '2026-10-21' });
        expect(impl.getPresetRange('month')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
        expect(impl.getPresetRange('custom')).toEqual({ start: '2026-10-18', end: '2026-10-24' });
    });

    it('finds the previous range of the same kind', () => {
        expect(impl.getPreviousRangeBounds({ preset: 'week', start: '2026-10-18', end: '2026-10-24' })).toEqual({
            start: '2026-10-11',
            end: '2026-10-17'
        });
        expect(impl.getPreviousRangeBounds({ preset: 'month', start: '2026-03-01', end: '2026-03-31' })).toEqual({
            start: '2026-02-01',
            end: '2026-02-28'
        });
        expect(impl.getPreviousRangeBounds({ preset: 'custom', start: '2026-10-05', end: '2026-10-07' })).toEqual({
            start: '2026-10-02',
            end: '2026-10-04'
        });
    });

    it('labels ranges, naming the current ones', () => {
        const label = (preset, start, end) => impl.formatRangeLabel({ preset, start, end });
        expect(label('week', '2026-10-18', '2026-10-24')).toBe('השבוע הנוכחי');
        expect(label('month', '2026-10-01', '2026-10-31')).toBe('אוקטובר');
        expect(label('7d', '2026-10-15', '2026-10-21')).toBe('7 הימים האחרונים');
        expect(label('30d', '2026-09-22', '2026-10-21')).toBe('30 הימים האחרונים');
        expect(label('week', '2026-10-11', '2026-10-17')).toBe(`${iso('11–17')} באוק׳`);
        expect(label('month', '2026-09-01', '2026-09-30')).toBe('ספטמבר');
        expect(label('month', '2025-09-01', '2025-09-30')).toBe('ספטמבר 2025');
        expect(label('custom', '2026-10-05', '2026-10-05')).toBe('5 באוק׳');
        expect(label('custom', '2026-09-28', '2026-10-02')).toBe('28 בספט׳ – 2 באוק׳');
        expect(label('custom', '2025-12-28', '2026-01-02')).toBe('28 בדצמ׳ – 2 בינו׳');
        expect(label('7d', '2025-10-15', '2025-10-21')).toBe(`${iso('15–21')} באוק׳ 2025`);
    });
});
