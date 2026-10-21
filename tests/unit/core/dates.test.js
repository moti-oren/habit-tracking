// @vitest-environment jsdom
// Date math: day numbers, week windows, day descriptors and their caches, DST weeks.
// Time zone: Asia/Jerusalem (vitest.config.js). DST ends Sun 25 Oct 2026 and starts Fri 27 Mar 2026.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { implementations, NOW, setNow } from '../../harness/impls.js';

vi.useFakeTimers({ now: NOW });
const IMPLS = await implementations();

describe.each(IMPLS)('dates (%s)', (_, impl) => {
    afterEach(() => vi.setSystemTime(NOW));

    it('runs in the Asia/Jerusalem time zone', () => {
        expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-180); // summer time
        expect(new Date(2026, 11, 1).getTimezoneOffset()).toBe(-120);
    });

    it('formats local dates as YYYY-MM-DD', () => {
        expect(impl.formatDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
        expect(impl.formatDateKey(new Date(2026, 9, 25, 23, 59))).toBe('2026-10-25');
    });

    it('maps date keys to day numbers and back', () => {
        expect(impl.dayNumOf('1970-01-01')).toBe(0);
        expect(impl.dayNumOf('2026-01-01')).toBe(20454);
        expect(impl.dayNumOf('2026-10-21')).toBe(20747);
        expect(impl.keyOfDayNum(20747)).toBe('2026-10-21');
        expect(impl.keyOfDayNum(-1)).toBe('1969-12-31');
        for (let n = 20000; n < 21500; n += 37) expect(impl.dayNumOf(impl.keyOfDayNum(n))).toBe(n);
    });

    it('computes the weekday (0 = Sunday) from day numbers', () => {
        expect(impl.dowOfDayNum(0)).toBe(4); // 1970-01-01 was a Thursday
        expect(impl.dowOfDayNum(-1)).toBe(3);
        expect(impl.dowOfKey('2026-10-18')).toBe(0);
        expect(impl.dowOfKey('2026-10-21')).toBe(3);
        expect(impl.dowOfKey('2026-10-24')).toBe(6);
        expect(impl.dowOfKey('2026-10-25')).toBe(0); // DST change day
    });

    it("computes today's day number and follows the clock across midnight", () => {
        expect(impl.todayDayNum()).toBe(20747);
        setNow(vi, 2026, 10, 21, 23, 59);
        expect(impl.todayDayNum()).toBe(20747);
        setNow(vi, 2026, 10, 22, 0, 0);
        expect(impl.todayDayNum()).toBe(20748);
        setNow(vi, 2026, 10, 25, 0, 30); // DST ends at 02:00 this day
        expect(impl.todayDayNum()).toBe(20751);
        setNow(vi, 2026, 10, 25, 23, 30);
        expect(impl.todayDayNum()).toBe(20751);
        setNow(vi, 2026, 10, 20, 12, 0); // and back in time
        expect(impl.todayDayNum()).toBe(20746);
    });

    it('returns date keys relative to today', () => {
        expect(impl.getDateKeyDaysAgo(0)).toBe('2026-10-21');
        expect(impl.getDateKeyDaysAgo(1)).toBe('2026-10-20');
        expect(impl.getDateKeyDaysAgo(-1)).toBe('2026-10-22');
        expect(impl.getDateKeyDaysAgo(21)).toBe('2026-09-30');
        expect(impl.getDateKeyDaysAgo(365)).toBe('2025-10-21');
    });

    it('builds the Sunday–Saturday window of a week', () => {
        const keys = offset => impl.getWindow7Days(offset).map(d => d.key);
        expect(keys(0)).toEqual([
            '2026-10-18',
            '2026-10-19',
            '2026-10-20',
            '2026-10-21',
            '2026-10-22',
            '2026-10-23',
            '2026-10-24'
        ]);
        expect(keys(-1)[0]).toBe('2026-10-11');
        expect(keys(-1)[6]).toBe('2026-10-17');
        expect(keys(1)).toEqual([
            '2026-10-25',
            '2026-10-26',
            '2026-10-27',
            '2026-10-28',
            '2026-10-29',
            '2026-10-30',
            '2026-10-31'
        ]);
        expect(keys(-30)[0]).toBe('2026-03-22'); // the DST-start week
    });

    it('describes a day (labels, today, future) with local-midnight dates', () => {
        const [sun, , , wed, thu, , sat] = impl.getWindow7Days(0);
        expect(sun).toMatchObject({
            key: '2026-10-18',
            dayLetter: 'א׳',
            dayShort: 'א׳',
            dayFull: 'יום א׳',
            dayNum: 18,
            monthShort: 'אוק׳',
            isToday: false,
            isFuture: false
        });
        expect(sat.dayFull).toBe('שבת');
        expect(wed.isToday).toBe(true);
        expect(thu.isFuture).toBe(true);
        expect(sun.dateObj.getTime()).toBe(new Date(2026, 9, 18).getTime());
        const dstDay = impl.dayObjForKey('2026-10-25');
        expect([dstDay.dateObj.getHours(), dstDay.dateObj.getDate()]).toEqual([0, 25]);
    });

    it('shares frozen day descriptors and rebuilds them when the day changes', () => {
        const a = impl.dayObjForKey('2026-10-22');
        expect(impl.dayObjForKey('2026-10-22')).toBe(a);
        expect(Object.isFrozen(a)).toBe(true);
        expect(a.isFuture).toBe(true);
        setNow(vi, 2026, 10, 22, 8);
        const b = impl.dayObjForKey('2026-10-22');
        expect(b).not.toBe(a);
        expect([b.isToday, b.isFuture]).toEqual([true, false]);
        expect(impl.dayObjForKey('2026-10-21').isToday).toBe(false);
    });

    it('validates the date-key format only (not the calendar)', () => {
        expect(impl.isValidDateKey('2026-10-21')).toBe(true);
        expect(impl.isValidDateKey('2026-13-45')).toBe(true);
        for (const bad of ['2026-1-2', '20261021', '', null, undefined, 20261021, '2026-10-21 ', ' 2026-10-21']) {
            expect(impl.isValidDateKey(bad)).toBe(false);
        }
    });

    it('tells future date keys apart', () => {
        expect(impl.isFutureDateKey('2026-10-22')).toBe(true);
        expect(impl.isFutureDateKey('2026-10-21')).toBe(false);
        expect(impl.isFutureDateKey('2020-01-01')).toBe(false);
        expect(impl.isFutureDateKey('')).toBe(false);
        expect(impl.isFutureDateKey(null)).toBe(false);
    });

    it('parses keys as local dates and does day arithmetic across DST and leap days', () => {
        expect(impl.parseDateKeyLocal('2026-03-27').getTime()).toBe(new Date(2026, 2, 27).getTime());
        expect(impl.addDaysToKey('2026-10-24', 1)).toBe('2026-10-25');
        expect(impl.addDaysToKey('2026-10-25', 1)).toBe('2026-10-26');
        expect(impl.addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
        expect(impl.addDaysToKey('2024-02-28', 1)).toBe('2024-02-29');
        expect(impl.addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
        expect(impl.daysBetweenKeys('2026-10-18', '2026-10-25')).toBe(7);
        expect(impl.daysBetweenKeys('2026-03-26', '2026-03-28')).toBe(2);
        expect(impl.daysBetweenKeys('2026-10-25', '2026-10-18')).toBe(-7);
    });

    it('builds the days of a range, capped at a year and a week', () => {
        expect(impl.buildDaysForRange('2026-10-18', '2026-10-24').map(d => d.dayNum)).toEqual([
            18, 19, 20, 21, 22, 23, 24
        ]);
        expect(impl.buildDaysForRange('2026-10-24', '2026-10-18')).toEqual([]);
        expect(impl.buildDaysForRange('2026-10-21', '2026-10-21')).toHaveLength(1);
        const long = impl.buildDaysForRange('2020-01-01', '2026-10-21');
        expect(long).toHaveLength(373); // MAX_RANGE_DAYS (366) + 7
        expect(long[0].key).toBe('2020-01-01');
        expect(long[372].key).toBe('2021-01-07');
    });

    it('splits days into calendar weeks starting on Sunday', () => {
        const weeks = impl.splitDaysIntoWeeks(impl.buildDaysForRange('2026-10-21', '2026-11-03'));
        expect(weeks.map(w => w.length)).toEqual([4, 7, 3]);
        expect(weeks[1][0].key).toBe('2026-10-25');
        expect(impl.splitDaysIntoWeeks([])).toEqual([]);
    });
});

describe.each(IMPLS)('time of day (%s)', (_, impl) => {
    it('converts between "HH:MM" and minutes, wrapping around midnight', () => {
        expect(impl.timeToMinutes('06:30')).toBe(390);
        expect(impl.timeToMinutes('00:00')).toBe(0);
        expect(impl.minutesToTime(1500)).toBe('01:00');
        expect(impl.minutesToTime(-30)).toBe('23:30');
        expect(impl.minutesToTime(1439)).toBe('23:59');
    });

    it('formats times and ranges, isolated for RTL text', () => {
        expect(impl.formatTimeRange('06:00', 90)).toBe('06:00–07:30');
        expect(impl.formatTimeRange('23:30', 60)).toBe('23:30–00:30');
        expect(impl.formatTimeRange('06:00', 0)).toBe('06:00');
        expect(impl.formatTimeRange('', 30)).toBe('');
        expect(impl.timeRangeText('06:00', 30)).toBe('⁦06:00–06:30⁩');
        expect(impl.timeRangeHtml('06:00', 30, 'x')).toBe('<span dir="ltr" class="tabular-nums x">06:00–06:30</span>');
        expect(impl.isoNum('18–24')).toBe('⁦18–24⁩');
    });

    it('turns a time into a block of at least one minute', () => {
        expect(impl.timeBlock('06:00', 0)).toEqual([360, 361]);
        expect(impl.timeBlock('06:00', undefined)).toEqual([360, 361]);
        expect(impl.timeBlock('06:00', 30)).toEqual([360, 390]);
    });

    it('splits the day into morning (<12), noon (<17) and evening', () => {
        const part = t => impl.dayPartOf(t).id;
        expect(['00:00', '11:59', '12:00', '16:59', '17:00', '23:59'].map(part)).toEqual([
            'morning',
            'morning',
            'noon',
            'noon',
            'evening',
            'evening'
        ]);
        expect(impl.dayPartOf('07:00').inLabel).toBe('בבוקר');
    });
});
