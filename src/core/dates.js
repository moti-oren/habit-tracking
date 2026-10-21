// Calendar math on "YYYY-MM-DD" date keys: day numbers, today, week windows, day descriptors.
// Pure: reads the clock, never the DOM. Its caches depend only on the date (see todayDayNum).
import { MAX_RANGE_DAYS } from '../config/analytics.js';
import { HEBREW_DAYS_FULL, HEBREW_DAYS_SHORT, HEBREW_MONTHS } from '../config/hebrew.js';

export function formatDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ===== Day numbers: date math without Date objects in hot loops =====
// A date key ("YYYY-MM-DD") maps to a day number: whole calendar days since 1970-01-01.
// It is built from the calendar date itself (UTC), so daylight-saving changes never shift it.
// Both directions are cached; a session only ever touches a few thousand distinct days.
const DAY_MS = 86400000;

const keyToDayNum = new Map();

const dayNumToKey = new Map();

export function dayNumOf(key) {
    let n = keyToDayNum.get(key);
    if (n === undefined) {
        n = Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) / DAY_MS;
        keyToDayNum.set(key, n);
    }
    return n;
}

export function keyOfDayNum(n) {
    let key = dayNumToKey.get(n);
    if (key === undefined) {
        const dt = new Date(n * DAY_MS);
        key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
        dayNumToKey.set(n, key);
    }
    return key;
}

// 0 = Sunday … 6 = Saturday (1970-01-01 was a Thursday)
export function dowOfDayNum(n) {
    return (((n + 4) % 7) + 7) % 7;
}

export function dowOfKey(key) {
    return dowOfDayNum(dayNumOf(key));
}

// Today's day number, recomputed only when the clock leaves the cached local day
const todayCache = { start: 0, end: -1, num: 0 };

export function todayDayNum() {
    const now = Date.now();
    if (now < todayCache.start || now >= todayCache.end) {
        const d = new Date(now);
        const y = d.getFullYear(),
            m = d.getMonth(),
            day = d.getDate();
        todayCache.start = new Date(y, m, day).getTime();
        todayCache.end = new Date(y, m, day + 1).getTime();
        todayCache.num = Date.UTC(y, m, day) / DAY_MS;
    }
    return todayCache.num;
}

export function getDateKeyDaysAgo(daysAgo) {
    return keyOfDayNum(todayDayNum() - daysAgo);
}

// Day descriptors are shared and frozen; the cache is dropped when the day changes
// (isToday / isFuture depend on it).
const dayObjCache = new Map();

let dayObjCacheToday = null;

export function dayObjForKey(key) {
    const t = todayDayNum();
    if (dayObjCacheToday !== t) {
        dayObjCache.clear();
        dayObjCacheToday = t;
    }
    let o = dayObjCache.get(key);
    if (!o) {
        const n = dayNumOf(key);
        const month = +key.slice(5, 7) - 1;
        const dayNum = +key.slice(8, 10);
        const dayIdx = dowOfDayNum(n);
        o = Object.freeze({
            key,
            dateObj: new Date(+key.slice(0, 4), month, dayNum),
            dayLetter: HEBREW_DAYS_SHORT[dayIdx],
            dayShort: HEBREW_DAYS_SHORT[dayIdx],
            dayFull: HEBREW_DAYS_FULL[dayIdx],
            dayNum,
            monthShort: HEBREW_MONTHS[month],
            isToday: n === t,
            isFuture: n > t
        });
        dayObjCache.set(key, o);
    }
    return o;
}

export function getWindow7Days(offsetWeeks = 0) {
    const t = todayDayNum();
    const sunday = t - dowOfDayNum(t) + offsetWeeks * 7;
    const days = [];
    for (let i = 0; i < 7; i++) days.push(dayObjForKey(keyOfDayNum(sunday + i)));
    return days;
}

export function isFutureDateKey(dateKey) {
    if (!dateKey) return false;
    const todayKey = getDateKeyDaysAgo(0);
    return dateKey > todayKey;
}

// ---- Habit start date: a habit only "exists" from its start date onward ----
export function isValidDateKey(key) {
    return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

// A fresh (mutable) Date for callers that need one; hot paths use day numbers instead
export function parseDateKeyLocal(key) {
    return new Date(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));
}

export function addDaysToKey(key, delta) {
    return keyOfDayNum(dayNumOf(key) + delta);
}

export function daysBetweenKeys(a, b) {
    return dayNumOf(b) - dayNumOf(a);
}

export function buildDaysForRange(startKey, endKey) {
    const days = [];
    const first = dayNumOf(startKey);
    const last = Math.min(dayNumOf(endKey), first + MAX_RANGE_DAYS + 6);
    for (let n = first; n <= last; n++) days.push(dayObjForKey(keyOfDayNum(n)));
    return days;
}

// Split a range into its calendar weeks (Sunday–Saturday) so flexible quotas are judged per week.
export function splitDaysIntoWeeks(days) {
    const weeks = [];
    let current = null;
    days.forEach(d => {
        if (!current || d.dateObj.getDay() === 0) {
            current = [];
            weeks.push(current);
        }
        current.push(d);
    });
    return weeks;
}
