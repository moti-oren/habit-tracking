// Statistics of habits: day totals, weekly goals and counts, current and best streaks, and
// progress over a range. Pure; the memoized versions used by the UI live in store/selectors.js.

import {
    addDaysToKey,
    dayNumOf,
    daysBetweenKeys,
    dowOfDayNum,
    dowOfKey,
    getDateKeyDaysAgo,
    isValidDateKey,
    keyOfDayNum,
    splitDaysIntoWeeks,
    todayDayNum
} from './dates.js';
import { isHabitActiveOnKey } from './habit.js';
import {
    baseHabit,
    getScheduleVersion,
    isFlexibleOnKey,
    isHabitScheduledForDateKey,
    isHabitScheduledForDayOfWeek,
    isHabitScheduledOnKey
} from './schedule.js';

// Weekly target for the given week, counting only the days the habit was active
// (a habit that started or was archived mid-week owes only its share)
export function getWeeklyGoalForHabit(habit, days) {
    habit = baseHabit(habit);
    const activeDays = days.filter(d => isHabitActiveOnKey(habit, d.key));
    if (!Array.isArray(habit.schedule) || habit.schedule.length <= 1) {
        const full = Number(habit.weeklyGoal) || 7;
        if (activeDays.length >= days.length) return full;
        if (habit.goalType === 'flexible') {
            return activeDays.length === 0 ? 0 : Math.max(1, Math.ceil((full * activeDays.length) / 7));
        }
        return activeDays.filter(d => isHabitScheduledForDayOfWeek(habit, d.dateObj.getDay())).length;
    }
    // Several versions: each active day counts by the version of that day. A due day (daily /
    // fixed days) adds 1; flexible days add their share of that version's quota.
    let goal = 0;
    const flexGroups = new Map(); // version -> number of active flexible days
    activeDays.forEach(d => {
        const v = getScheduleVersion(habit, d.key);
        if (v.goalType === 'flexible') flexGroups.set(v, (flexGroups.get(v) || 0) + 1);
        else if (isHabitScheduledForDayOfWeek(v, d.dateObj.getDay())) goal++;
    });
    flexGroups.forEach((n, v) => {
        const quota = Math.max(1, Number(v.weeklyGoal) || 1);
        goal += n >= 7 ? quota : Math.ceil((quota * n) / 7);
    });
    return goal;
}

export function getFlexibleStreakInWeeks(habit) {
    habit = baseHabit(habit);
    const t = todayDayNum();
    const todayKey = keyOfDayNum(t);
    const history = habit.history || {};
    const sunday0 = t - dowOfDayNum(t);
    let streak = 0;

    for (let w = 0; w >= -52; w--) {
        const sunday = sunday0 + w * 7;
        const lastKey = keyOfDayNum(sunday + 6);
        const lastElapsed = lastKey < todayKey ? lastKey : todayKey;
        const quota = Math.max(1, Number(getScheduleVersion(habit, lastElapsed).weeklyGoal) || 1);
        let doneInWeek = 0;
        for (let j = 0; j < 7; j++) if (history[keyOfDayNum(sunday + j)]) doneInWeek++;
        if (doneInWeek >= quota) streak++;
        else if (w !== 0) break; // the current week may still be in progress
    }
    return streak;
}

export function computeStreak(habit) {
    // The unit (days / weeks) follows the version in force today
    if (isFlexibleOnKey(habit, getDateKeyDaysAgo(0))) {
        return getFlexibleStreakInWeeks(habit);
    }
    const t = todayDayNum();
    let streak = 0;
    for (let i = 0; i < 365; i++) {
        const key = keyOfDayNum(t - i);
        const done = !!(habit.history && habit.history[key]);

        if (i === 0 && !done) {
            continue;
        }

        if (!isHabitActiveOnKey(habit, key)) {
            if (habit.startDate && key < habit.startDate) break;
            continue; // paused (archived) days neither break nor extend the streak
        }

        if (done) {
            streak++;
        } else {
            // a day that wasn't due by that day's version doesn't break the streak
            if (!isHabitScheduledForDateKey(habit, key)) {
                continue;
            }
            break;
        }
    }
    return streak;
}

export function getWeeklyCountForHabit(habit, days) {
    habit = baseHabit(habit);
    return days.reduce(
        (acc, d) => acc + (isHabitActiveOnKey(habit, d.key) && habit.history && habit.history[d.key] ? 1 : 0),
        0
    );
}

export function computeDayStats(dayObj, habitList) {
    const activeHabits = habitList.filter(h => isHabitActiveOnKey(h, dayObj.key));
    const dow = dowOfKey(dayObj.key);
    const scheduledHabits = activeHabits.filter(h => isHabitScheduledOnKey(h, dayObj.key, dow));
    const totalScheduled = scheduledHabits.length;
    const doneScheduled = scheduledHabits.filter(h => h.history && h.history[dayObj.key]).length;
    const bonusDone = activeHabits.filter(
        h => !isHabitScheduledOnKey(h, dayObj.key, dow) && h.history && h.history[dayObj.key]
    ).length;
    const totalDone = doneScheduled + bonusDone;
    const pct = totalScheduled > 0 ? Math.min(100, Math.round((doneScheduled / totalScheduled) * 100)) : 0;
    const allDone = totalScheduled > 0 && doneScheduled >= totalScheduled;
    return { totalScheduled, doneScheduled, extraDone: bonusDone, bonusDone, totalDone, pct, allDone };
}

export function computeHabitRangeProgress(habit, days, elapsedOnly) {
    const pool = elapsedOnly ? days.filter(d => !d.isFuture) : days;
    const doneOn = d => (habit.history && habit.history[d.key] ? 1 : 0);
    // A flexible stretch of days owes its share of the weekly quota. A week still in progress
    // only owes the share earned so far (rounded down), so it isn't "behind" on its first day.
    const flexTarget = (quota, n, inProgress) =>
        inProgress ? Math.floor((quota * n) / 7) : Math.max(1, Math.ceil((quota * n) / 7));

    if (!Array.isArray(habit.schedule) || habit.schedule.length <= 1) {
        if (habit.goalType === 'flexible') {
            const weeklyGoal = Math.max(1, Number(habit.weeklyGoal) || 1);
            let target = 0,
                done = 0;
            splitDaysIntoWeeks(days).forEach(week => {
                const activeInWeek = week.filter(d => isHabitActiveOnKey(habit, d.key));
                const counted = elapsedOnly ? activeInWeek.filter(d => !d.isFuture) : activeInWeek;
                if (counted.length === 0) return;
                const inProgress = elapsedOnly && week.some(d => d.isFuture);
                const weekTarget = flexTarget(weeklyGoal, counted.length, inProgress);
                if (weekTarget === 0) return;
                const checks = counted.reduce((acc, d) => acc + doneOn(d), 0);
                target += weekTarget;
                done += Math.min(weekTarget, checks);
            });
            return { target, done };
        }
        const scheduled = pool.filter(
            d => isHabitActiveOnKey(habit, d.key) && isHabitScheduledForDayOfWeek(habit, d.dateObj.getDay())
        );
        const done = scheduled.reduce((acc, d) => acc + doneOn(d), 0);
        return { target: scheduled.length, done: Math.min(scheduled.length, done) };
    }

    // Several versions: split into calendar weeks; due days count one by one,
    // flexible days (grouped by version) owe their share of that version's quota.
    let target = 0,
        done = 0;
    splitDaysIntoWeeks(days).forEach(week => {
        const activeInWeek = week.filter(d => isHabitActiveOnKey(habit, d.key));
        const counted = elapsedOnly ? activeInWeek.filter(d => !d.isFuture) : activeInWeek;
        if (counted.length === 0) return;
        const inProgress = elapsedOnly && week.some(d => d.isFuture);
        const flexGroups = new Map();
        counted.forEach(d => {
            const v = getScheduleVersion(habit, d.key);
            if (v.goalType === 'flexible') {
                if (!flexGroups.has(v)) flexGroups.set(v, []);
                flexGroups.get(v).push(d);
            } else if (isHabitScheduledForDayOfWeek(v, d.dateObj.getDay())) {
                target++;
                done += doneOn(d);
            }
        });
        flexGroups.forEach((groupDays, v) => {
            const weekTarget = flexTarget(Math.max(1, Number(v.weeklyGoal) || 1), groupDays.length, inProgress);
            if (weekTarget === 0) return;
            const checks = groupDays.reduce((acc, d) => acc + doneOn(d), 0);
            target += weekTarget;
            done += Math.min(weekTarget, checks);
        });
    });
    return { target, done };
}

export function computeBestStreak(habit) {
    const todayKey = getDateKeyDaysAgo(0);
    const historyKeys = Object.keys(habit.history || {})
        .filter(k => habit.history[k])
        .sort();
    let firstKey = habit.startDate && isValidDateKey(habit.startDate) ? habit.startDate : todayKey;
    if (historyKeys.length && historyKeys[0] < firstKey) firstKey = historyKeys[0];
    if (daysBetweenKeys(firstKey, todayKey) > 730) firstKey = addDaysToKey(todayKey, -730);
    let best = 0,
        run = 0;

    const history = habit.history || {};
    const todayNum = dayNumOf(todayKey);
    if (isFlexibleOnKey(habit, todayKey)) {
        const firstNum = dayNumOf(firstKey);
        for (let sunday = firstNum - dowOfDayNum(firstNum); sunday <= todayNum; sunday += 7) {
            const weekEndKey = keyOfDayNum(sunday + 6);
            const weekEnd = weekEndKey < todayKey ? weekEndKey : todayKey;
            const quota = Math.max(1, Number(getScheduleVersion(habit, weekEnd).weeklyGoal) || 1);
            let done = 0;
            for (let j = 0; j < 7; j++) if (history[keyOfDayNum(sunday + j)]) done++;
            const isCurrentWeek = todayNum >= sunday && todayNum <= sunday + 6;
            if (done >= quota) {
                run++;
                best = Math.max(best, run);
            } else if (!isCurrentWeek) run = 0;
        }
        return best;
    }

    for (let n = dayNumOf(firstKey); n <= todayNum; n++) {
        const key = keyOfDayNum(n);
        const done = !!history[key];
        // Same rules as the current streak: paused days are skipped, rest days don't break it
        if (!isHabitActiveOnKey(habit, key)) {
            // not tracked on this day
        } else if (done) {
            run++;
            best = Math.max(best, run);
        } else if (!isHabitScheduledOnKey(habit, key, dowOfDayNum(n))) {
            // not due that day (by that day's version)
        } else if (key !== todayKey) {
            run = 0;
        }
    }
    return best;
}
