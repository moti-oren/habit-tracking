// The tracker's daily list.

import { DAY_PARTS } from '../../../config/schedule.js';
import { getDateKeyDaysAgo, isFutureDateKey } from '../../../core/dates.js';
import { isSlotDone } from '../../../core/habit.js';
import { habitOn, hasAnyTime, isHabitScheduledForDayOfWeek } from '../../../core/schedule.js';
import { compareByName } from '../../../core/sort.js';
import { getWeeklyCountForHabit, getWeeklyGoalForHabit } from '../../../core/stats.js';
import { dayPartOf, timeToMinutes } from '../../../core/time.js';
import { tracker } from '../../../state/tracker.js';
import { icon } from '../../dom/icons.js';
import { patchHTML } from '../../dom/patch.js';
import { buildHabitFocusCardHtml } from './habit-card.js';

// The daily list: the habits of the selected day, by time of day (when times are set) and by status
export function renderFocusView(container, filtered) {
    container.className = 'space-y-6';
    const selectedDayObj = tracker.weekDays.find(d => d.key === tracker.selectedDateKey) || tracker.weekDays[0];
    const selectedDayOfWeek = selectedDayObj.dateObj.getDay();
    const isSelectedDayFuture = isFutureDateKey(tracker.selectedDateKey);

    // 4 Logical Groups:
    // 1. Scheduled Today - Not Done Yet
    // 2. Scheduled Today - Done
    // 3. Flexible This Week ('flexible')
    // 4. Not Scheduled Today (Rest Days - collapsed by default)
    const scheduledNotDone = [];
    const scheduledDone = [];
    const flexibleHabits = [];
    const unscheduledRestHabits = [];

    // Each card uses the settings in force on the selected day
    const dayHabits = filtered.map(h => habitOn(h, tracker.selectedDateKey));
    dayHabits.forEach(habit => {
        const isDone = !isSelectedDayFuture && !!(habit.history && habit.history[tracker.selectedDateKey]);
        if (habit.goalType === 'flexible') {
            flexibleHabits.push(habit);
        } else if (isHabitScheduledForDayOfWeek(habit, selectedDayOfWeek)) {
            if (isDone) {
                scheduledDone.push(habit);
            } else {
                scheduledNotDone.push(habit);
            }
        } else {
            unscheduledRestHabits.push(habit);
        }
    });

    // Cards are listed alphabetically by name, so a card never jumps while ticking habits off.
    const orderedScheduled = [...scheduledNotDone, ...scheduledDone].sort((x, y) => compareByName(x.name, y.name));
    flexibleHabits.sort((x, y) => compareByName(x.name, y.name));
    unscheduledRestHabits.sort((x, y) => compareByName(x.name, y.name));
    let sectionsHtml = '';

    // Day plan by time: when at least one habit of the day has a time, split into
    // morning / noon / evening / any time. A flexible habit with a time joins the plan
    // while its weekly quota isn't met yet, or when it was ticked on this day.
    // A habit done several times a day becomes one card per occurrence (its own time and mark)
    const expand = list =>
        list.flatMap(h =>
            h.slotTimes ? h.slotTimes.map((t, i) => ({ ...h, time: t, _slot: i, _slots: h.slotTimes.length })) : [h]
        );
    const itemKey = h => (h._slot !== undefined ? `${h.id}#${h._slot}` : h.id);
    const isDoneOnDay = h =>
        !isSelectedDayFuture &&
        (h._slot !== undefined
            ? isSlotDone(h, tracker.selectedDateKey, h._slot)
            : !!(h.history && h.history[tracker.selectedDateKey]));
    const flexInPlan = flexibleHabits.filter(
        h =>
            hasAnyTime(h) &&
            (isDoneOnDay(h) ||
                getWeeklyCountForHabit(h, tracker.weekDays) < Math.max(1, getWeeklyGoalForHabit(h, tracker.weekDays)))
    );
    const usePlan = orderedScheduled.some(h => hasAnyTime(h)) || flexInPlan.length > 0;

    if (usePlan) {
        const planItems = expand([...orderedScheduled, ...flexInPlan]);
        const timed = planItems
            .filter(h => h.time)
            .sort((x, y) => timeToMinutes(x.time) - timeToMinutes(y.time) || compareByName(x.name, y.name));
        // Live state for today's open items: now / next / past
        const status = new Map();
        if (tracker.selectedDateKey === getDateKeyDaysAgo(0)) {
            const nowD = new Date();
            const nowMin = nowD.getHours() * 60 + nowD.getMinutes();
            const open = timed.filter(h => !isDoneOnDay(h));
            open.forEach(h => {
                const start = timeToMinutes(h.time);
                const end = start + (h.duration || 0);
                if (h.duration > 0 && start <= nowMin && nowMin < end) status.set(itemKey(h), 'now');
                else if (h.duration > 0 ? nowMin >= end : nowMin > start) status.set(itemKey(h), 'past');
            });
            const upcoming = open.filter(h => timeToMinutes(h.time) > nowMin);
            if (upcoming.length) {
                const first = timeToMinutes(upcoming[0].time);
                upcoming.filter(h => timeToMinutes(h.time) === first).forEach(h => status.set(itemKey(h), 'next'));
            }
        }
        const groups = [
            ...DAY_PARTS.map(part => ({ label: part.label, items: timed.filter(h => dayPartOf(h.time) === part) })),
            { label: 'בכל שעה', items: planItems.filter(h => !h.time) }
        ].filter(g => g.items.length > 0);
        groups.forEach(g => {
            const doneCount = g.items.filter(isDoneOnDay).length;
            sectionsHtml += `
                <div class="space-y-3">
                    <div class="flex items-center gap-2 px-1">
                        <h3 class="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">${g.label}</h3>
                        <span class="text-xs font-semibold tabular-nums ${doneCount === g.items.length ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}">${doneCount}/${g.items.length}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        ${g.items.map(h => buildHabitFocusCardHtml(h, selectedDayObj, isSelectedDayFuture, status.get(itemKey(h)) || null)).join('')}
                    </div>
                </div>
            `;
        });
        // flexible habits that stay in their usual group
        const flexLeft = flexibleHabits.filter(h => !flexInPlan.includes(h));
        flexibleHabits.length = 0;
        flexibleHabits.push(...flexLeft);
    } else if (orderedScheduled.length > 0) {
        sectionsHtml += `
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                ${expand(orderedScheduled)
                    .map(h => buildHabitFocusCardHtml(h, selectedDayObj, isSelectedDayFuture))
                    .join('')}
            </div>
        `;
    }

    if (flexibleHabits.length > 0) {
        sectionsHtml += `
            <div class="space-y-3 pt-1">
                <div class="flex items-center justify-between px-1">
                    <h3 class="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">גמישים השבוע</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    ${expand(flexibleHabits)
                        .map(h => buildHabitFocusCardHtml(h, selectedDayObj, isSelectedDayFuture))
                        .join('')}
                </div>
            </div>
        `;
    }

    if (unscheduledRestHabits.length > 0) {
        sectionsHtml += `
            <div class="pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
                <button type="button" id="restGroupToggle" data-action="toggleRestGroup" aria-expanded="${tracker.restGroupExpanded}" aria-controls="restGroupReveal" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-200/60 dark:bg-slate-900/80 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
                    <div class="flex items-center gap-2">
                        <span>לא מתוכננים היום (ימי מנוחה)</span>
                        <span class="px-2 py-0.5 rounded-full bg-slate-300/70 dark:bg-slate-800 text-xs font-semibold">${unscheduledRestHabits.length}</span>
                    </div>
                    <span class="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        <span class="inline-flex items-center gap-1"><span data-toggle-text>${tracker.restGroupExpanded ? 'הסתר' : 'הצג הכל'}</span>${icon('chevronDown', 'w-4 h-4 transition-transform' + (tracker.restGroupExpanded ? ' rotate-180' : ''))}</span>
                    </span>
                </button>
                <div id="restGroupReveal" class="reveal ${tracker.restGroupExpanded ? 'is-open' : ''}" ${tracker.restGroupExpanded ? '' : 'inert'}>
                    <div>
                        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-3">
                            ${unscheduledRestHabits.map((h, i) => `<div class="stagger-item grid" style="--i:${Math.min(i, 5)}">${buildHabitFocusCardHtml(h, selectedDayObj, isSelectedDayFuture)}</div>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    patchHTML(container, sectionsHtml);
}
