// Scheduling: goal type, days, time — with history
// Each habit keeps `schedule`: versions { from, goalType, fixedDays, weeklyGoal, time, duration },
// sorted by `from` (the first version has from: null = "from the start"). Every past day is
// measured by the version in force on that day. The top-level fields always mirror the last version.

import { MAX_SLOTS, TIME_RE } from '../config/schedule.js';
import { dowOfKey, getDateKeyDaysAgo, isValidDateKey } from './dates.js';
import { timeToMinutes } from './time.js';

// Normalizes the scheduling fields of a habit or of a schedule version (in place)
export function normalizeScheduleFields(obj) {
    if (!obj.goalType) {
        if (Array.isArray(obj.fixedDays) && obj.fixedDays.length > 0 && obj.fixedDays.length < 7) {
            obj.goalType = 'fixed_days';
        } else if (Number(obj.weeklyGoal) && Number(obj.weeklyGoal) < 7) {
            obj.goalType = 'flexible';
        } else {
            obj.goalType = 'daily';
        }
    }
    if (obj.goalType === 'daily') {
        obj.fixedDays = [0, 1, 2, 3, 4, 5, 6];
        obj.weeklyGoal = 7;
    } else if (obj.goalType === 'fixed_days') {
        if (!Array.isArray(obj.fixedDays) || obj.fixedDays.length === 0) {
            obj.fixedDays = [0, 2, 4];
        }
        obj.fixedDays = [...new Set(obj.fixedDays.map(Number))].sort((a, b) => a - b);
        obj.weeklyGoal = obj.fixedDays.length;
    } else {
        obj.goalType = 'flexible';
        obj.fixedDays = [];
        obj.weeklyGoal = Math.min(6, Math.max(1, Number(obj.weeklyGoal) || 4));
    }
    obj.time = typeof obj.time === 'string' && TIME_RE.test(obj.time.trim()) ? obj.time.trim() : '';
    // Times: up to MAX_SLOTS a day. Built as 7 rows (one per weekday) and stored in the
    // simplest shape that holds them: `time` (once a day, same time), `slotTimes` (several a day,
    // the same times every day) or `dayTimes` (7 rows of times, when days differ).
    // '' = an occurrence without a time. Inside a row timed occurrences come first, in time order.
    const validTime = t => (typeof t === 'string' && TIME_RE.test(t.trim()) ? t.trim() : '');
    let rows;
    if (Array.isArray(obj.dayTimes) && obj.dayTimes.length === 7) {
        rows = obj.dayTimes.map(e => (Array.isArray(e) ? e : [e]).slice(0, MAX_SLOTS).map(validTime));
    } else if (Array.isArray(obj.slotTimes) && obj.slotTimes.length >= 1) {
        const st = obj.slotTimes.slice(0, MAX_SLOTS).map(validTime);
        rows = Array.from({ length: 7 }, () => [...st]);
    } else {
        rows = Array.from({ length: 7 }, () => [obj.time]);
    }
    const n = Math.max(1, ...rows.map(r => r.length));
    const active = scheduleWeekdays(obj);
    rows = rows.map((r, d) => {
        if (!active.includes(d)) return Array(n).fill('');
        const padded = [...r, ...Array(n - r.length).fill('')];
        const timed = padded.filter(Boolean).sort((x, y) => timeToMinutes(x) - timeToMinutes(y));
        return [...timed, ...padded.filter(t => !t)];
    });
    const first = rows[active[0]];
    if (active.every(d => rows[d].join('|') === first.join('|'))) {
        obj.dayTimes = null;
        obj.slotTimes = n > 1 ? [...first] : null;
        obj.time = n > 1 ? '' : first[0];
    } else {
        obj.dayTimes = rows;
        obj.slotTimes = null;
        obj.time = '';
    }
    const hasTime = hasAnyTime(obj);
    const dur = Math.round(Number(obj.duration));
    obj.duration = hasTime && Number.isFinite(dur) && dur > 0 ? Math.min(dur, 24 * 60) : 0;
    return obj;
}

export function pickScheduleFields(src) {
    return {
        goalType: src.goalType,
        fixedDays: Array.isArray(src.fixedDays) ? [...src.fixedDays] : [],
        weeklyGoal: src.weeklyGoal,
        time: src.time,
        duration: src.duration,
        dayTimes: Array.isArray(src.dayTimes) ? src.dayTimes.map(r => (Array.isArray(r) ? [...r] : r)) : null,
        slotTimes: Array.isArray(src.slotTimes) ? [...src.slotTimes] : null
    };
}

export function sameScheduleFields(a, b) {
    return (
        a.goalType === b.goalType &&
        a.weeklyGoal === b.weeklyGoal &&
        a.time === b.time &&
        a.duration === b.duration &&
        (a.fixedDays || []).join(',') === (b.fixedDays || []).join(',') &&
        JSON.stringify(a.dayTimes || null) === JSON.stringify(b.dayTimes || null) &&
        (a.slotTimes || []).join(',') === (b.slotTimes || []).join(',')
    );
}

// Builds/cleans `schedule` (migration for old habits), then mirrors the last version on top
export function normalizeHabitSchedule(habit) {
    let versions;
    if (!Array.isArray(habit.schedule) || habit.schedule.filter(v => v && typeof v === 'object').length === 0) {
        versions = [{ from: null, ...pickScheduleFields(normalizeScheduleFields(habit)) }];
    } else {
        versions = habit.schedule
            .filter(v => v && typeof v === 'object')
            .map(v => {
                const n = normalizeScheduleFields(pickScheduleFields(v));
                return { from: isValidDateKey(v.from) ? v.from : null, ...n };
            });
        // sort by `from` (null first); for the same day the later entry wins
        versions = versions
            .map((v, i) => ({ v, i }))
            .sort((x, y) => {
                const fx = x.v.from || '',
                    fy = y.v.from || '';
                return fx < fy ? -1 : fx > fy ? 1 : x.i - y.i;
            })
            .map(x => x.v);
        const byFrom = [];
        versions.forEach(v => {
            const last = byFrom[byFrom.length - 1];
            if (last && (last.from || '') === (v.from || '')) byFrom[byFrom.length - 1] = v;
            else byFrom.push(v);
        });
        versions = byFrom;
        versions[0].from = null;
    }
    // merge consecutive identical versions
    const merged = [];
    versions.forEach(v => {
        const last = merged[merged.length - 1];
        if (last && sameScheduleFields(last, v)) return;
        merged.push(v);
    });
    habit.schedule = merged;
    Object.assign(habit, pickScheduleFields(merged[merged.length - 1]));
    return habit;
}

// The original habit behind a per-day copy made by habitOn()
export function baseHabit(habit) {
    return habit && habit._base ? habit._base : habit;
}

// The schedule version in force on a given day (the first version for days before all of them)
export function getScheduleVersion(habit, dateKey) {
    const base = baseHabit(habit);
    const s = base && base.schedule;
    if (!Array.isArray(s) || s.length === 0) return base;
    let v = s[0];
    for (let i = 1; i < s.length; i++) {
        if (s[i].from && s[i].from <= dateKey) v = s[i];
        else break;
    }
    return v;
}

// A shallow copy of the habit with the scheduling fields of that day.
// With a single version the same object is returned (fast, and keeps === comparisons working).
export function habitOn(habit, dateKey) {
    const base = baseHabit(habit);
    if (!base) return base;
    const multi = Array.isArray(base.schedule) && base.schedule.length > 1;
    const v = multi ? getScheduleVersion(base, dateKey) : base;
    if (!multi && !v.dayTimes) return base;
    const fields = pickScheduleFields(v);
    // with times per weekday, the copy carries that day's times (once, or several a day)
    if (v.dayTimes) {
        const row = dayTimesRow(v, dowOfKey(dateKey));
        fields.slotTimes = row.length > 1 ? [...row] : null;
        fields.time = row.length > 1 ? '' : row[0] || '';
        fields.dayTimes = null;
    }
    return { ...base, ...fields, _base: base };
}

export function isHabitScheduledForDayOfWeek(habit, dayOfWeekIdx) {
    if (!habit) return false;
    if (habit.goalType === 'flexible') {
        return false;
    }
    if (habit.goalType === 'fixed_days' && Array.isArray(habit.fixedDays)) {
        return habit.fixedDays.includes(dayOfWeekIdx);
    }
    return true;
}

// Date-aware: was the habit due on this specific day, by the settings in force that day
export function isHabitScheduledOnKey(habit, dateKey, dayOfWeekIdx) {
    const dow = dayOfWeekIdx !== undefined ? dayOfWeekIdx : dowOfKey(dateKey);
    return isHabitScheduledForDayOfWeek(getScheduleVersion(habit, dateKey), dow);
}

export function isFlexibleOnKey(habit, dateKey) {
    return getScheduleVersion(habit, dateKey).goalType === 'flexible';
}

// Days of the week a definition is active on (daily / flexible: every day)
export function scheduleWeekdays(def) {
    return def.goalType === 'fixed_days' ? def.fixedDays || [] : [0, 1, 2, 3, 4, 5, 6];
}

// All occurrence times of a weekday ('' = an occurrence without a time)
export function dayTimesRow(def, dow) {
    if (def.dayTimes) {
        const r = def.dayTimes[dow];
        return Array.isArray(r) ? r : [r || ''];
    }
    if (def.slotTimes) return def.slotTimes;
    return [def.time || ''];
}

export function hasAnyTime(def) {
    return (
        !!def.time ||
        !!(def.dayTimes && def.dayTimes.some(r => (Array.isArray(r) ? r : [r]).some(Boolean))) ||
        !!(def.slotTimes && def.slotTimes.some(Boolean))
    );
}

// How many times a day (1 unless several occurrences are set)
export function slotCount(def) {
    if (!def) return 1;
    if (Array.isArray(def.dayTimes)) return Array.isArray(def.dayTimes[0]) ? def.dayTimes[0].length : 1;
    return Array.isArray(def.slotTimes) ? def.slotTimes.length : 1;
}

// All the times of a definition on a weekday (several a day, or the single / per-day time)
export function timesOnDay(def, dow) {
    return dayTimesRow(def, dow).filter(Boolean);
}

export function isHabitScheduledForDateKey(habit, dateKey) {
    if (!isValidDateKey(dateKey)) return false;
    return isHabitScheduledOnKey(habit, dateKey, dowOfKey(dateKey));
}

// Applies a new schedule definition: from today on, or as a correction for the whole period
export function applyScheduleEdit(habit, def, scope) {
    normalizeHabitSchedule(habit);
    const todayKey = getDateKeyDaysAgo(0);
    if (sameScheduleFields(habit.schedule[habit.schedule.length - 1], def)) return;
    const hasPastDays = isValidDateKey(habit.startDate) && habit.startDate < todayKey;
    if (scope === 'forward' && hasPastDays) {
        habit.schedule = habit.schedule.filter(v => !v.from || v.from < todayKey);
        habit.schedule.push({ from: todayKey, ...pickScheduleFields(def) });
    } else {
        habit.schedule = [{ from: null, ...pickScheduleFields(def) }];
    }
    normalizeHabitSchedule(habit);
}
