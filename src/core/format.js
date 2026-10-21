// Text shown to the user (Hebrew): labels for dates, ranges, schedules, goals and counts.

import { HEBREW_DAYS_FULL, HEBREW_DAYS_SHORT, HEBREW_MONTHS_FULL, HEBREW_MONTHS_SHORT } from '../config/hebrew.js';
import { getDateKeyDaysAgo, isValidDateKey } from './dates.js';
import { baseHabit, dayTimesRow, hasAnyTime, isFlexibleOnKey, scheduleWeekdays, slotCount } from './schedule.js';
import { timeRangeText } from './time.js';

export function getGreetingByHour() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'בוקר טוב';
    if (hour >= 12 && hour < 17) return 'צהריים טובים';
    if (hour >= 17 && hour < 22) return 'ערב טוב';
    return 'לילה טוב';
}

// [0,1,2,3,4] -> "א׳–ה׳", [0,2,4] -> "א׳, ג׳, ה׳"
export function formatDaySet(days) {
    const sorted = [...days].sort((a, b) => a - b);
    const parts = [];
    for (let i = 0; i < sorted.length; i++) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
        parts.push(
            j - i >= 2
                ? `${HEBREW_DAYS_SHORT[sorted[i]]}–${HEBREW_DAYS_SHORT[sorted[j]]}`
                : sorted
                      .slice(i, j + 1)
                      .map(d => HEBREW_DAYS_SHORT[d])
                      .join(', ')
        );
        i = j;
    }
    return parts.join(', ');
}

// Text summary of the times: "06:00–07:00", or "א׳–ה׳ 06:00–07:00 · ו׳ 09:00–10:00 · ש׳ ללא שעה"
export function scheduleTimeSummary(def) {
    const n = slotCount(def);
    const prefix = n > 1 ? `${n} פעמים ביום: ` : '';
    const fmtRow = row =>
        row.every(t => !t) ? 'ללא שעה' : row.map(t => (t ? timeRangeText(t, def.duration) : 'ללא שעה')).join(', ');
    if (def.dayTimes) {
        const groups = [];
        scheduleWeekdays(def).forEach(d => {
            const row = dayTimesRow(def, d);
            const key = row.join('|');
            const g = groups.find(x => x.key === key);
            if (g) g.days.push(d);
            else groups.push({ key, row, days: [d] });
        });
        return prefix + groups.map(g => `${formatDaySet(g.days)} ${fmtRow(g.row)}`).join(' · ');
    }
    if (def.slotTimes) return prefix + fmtRow(def.slotTimes);
    return def.time ? timeRangeText(def.time, def.duration) : '';
}

export function formatStartDateLabel(dateKey) {
    if (!isValidDateKey(dateKey)) return '';
    const [y, m, d] = dateKey.split('-').map(Number);
    const yearSuffix = y !== new Date().getFullYear() ? ` ${y}` : '';
    return `${d} ב${HEBREW_MONTHS_FULL[m - 1]}${yearSuffix}`;
}

export function getHabitGoalLabel(habit) {
    habit = baseHabit(habit);
    const base = getHabitGoalTypeLabel(habit);
    const n = slotCount(habit);
    return n > 1 ? `${base} · ${n} פעמים ביום` : base;
}

export function getHabitGoalTypeLabel(habit) {
    if (habit.goalType === 'daily') {
        return 'כל יום (7/7)';
    }
    if (habit.goalType === 'fixed_days' && Array.isArray(habit.fixedDays) && habit.fixedDays.length > 0) {
        const daysStr = habit.fixedDays.map(d => HEBREW_DAYS_SHORT[d]).join(', ');
        return `ימים קבועים: ${daysStr}`;
    }
    return `${habit.weeklyGoal || 4} ימים בשבוע (גמיש)`;
}

export function getHabitStreakUnit(habit) {
    return habit && isFlexibleOnKey(habit, getDateKeyDaysAgo(0)) ? 'שבועות' : 'ימים';
}

export function formatWeekRangeText(firstDayObj, lastDayObj) {
    const currentYear = new Date().getFullYear();
    const firstMonthName = HEBREW_MONTHS_FULL[firstDayObj.dateObj.getMonth()];
    const lastMonthName = HEBREW_MONTHS_FULL[lastDayObj.dateObj.getMonth()];
    const firstYear = firstDayObj.dateObj.getFullYear();
    const lastYear = lastDayObj.dateObj.getFullYear();
    const yearSuffix = lastYear !== currentYear || firstYear !== currentYear ? ` ${lastYear}` : '';

    if (firstDayObj.dateObj.getMonth() === lastDayObj.dateObj.getMonth()) {
        return `${isoNum(`${firstDayObj.dayNum}–${lastDayObj.dayNum}`)} ב${lastMonthName}${yearSuffix}`;
    }
    return `${firstDayObj.dayNum} ב${firstMonthName} - ${lastDayObj.dayNum} ב${lastMonthName}${yearSuffix}`;
}

// Keep a numeric range in reading order inside Hebrew text (an en dash between digits would flip)
export function isoNum(text) {
    return `\u2066${text}\u2069`;
}

export function habitCountLabel(n) {
    return n === 1 ? 'הרגל אחד' : `${n} הרגלים`;
}

export function describeScheduleVersion(v, mentionNoTime) {
    // the time summary already says "N פעמים ביום", so use the goal type alone
    const label = hasAnyTime(v) ? getHabitGoalTypeLabel(v) : getHabitGoalLabel(v);
    if (hasAnyTime(v)) return `${label}, ${scheduleTimeSummary(v)}`;
    return mentionNoTime ? `${label}, ללא שעה` : label;
}

export function formatDateTriggerLabel(key) {
    if (!isValidDateKey(key)) return '';
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const todayKey = getDateKeyDaysAgo(0);
    const prefix = key === todayKey ? 'היום, ' : key === getDateKeyDaysAgo(1) ? 'אתמול, ' : '';
    const yearSuffix = y !== new Date().getFullYear() ? ` ${y}` : '';
    return `${prefix}${HEBREW_DAYS_FULL[dt.getDay()]}, ${d} ב${HEBREW_MONTHS_FULL[m - 1]}${yearSuffix}`;
}

export function formatDateCompactLabel(key) {
    if (!isValidDateKey(key)) return '';
    const [y, m, d] = key.split('-').map(Number);
    const yearSuffix = y !== new Date().getFullYear() ? ` ${y}` : '';
    return `${d} ב${HEBREW_MONTHS_SHORT[m - 1]}${yearSuffix}`;
}
