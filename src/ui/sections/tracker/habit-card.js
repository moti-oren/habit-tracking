// A habit card of the daily list.

import { getColorMeta } from '../../../config/colors.js';
import { isFutureDateKey } from '../../../core/dates.js';
import { getHabitCategoryDisplay, isHabitActiveOnKey, isSlotDone } from '../../../core/habit.js';
import { isFlexibleOnKey, isHabitScheduledForDayOfWeek, isHabitScheduledOnKey } from '../../../core/schedule.js';
import { getWeeklyCountForHabit, getWeeklyGoalForHabit } from '../../../core/stats.js';
import { motion } from '../../../state/motion.js';
import { tracker } from '../../../state/tracker.js';
import { getHabitStreakLongText } from '../../../store/selectors.js';
import { flashClassFor } from '../../dom/flip.js';
import { escapeHtml, timeRangeHtml } from '../../dom/html.js';
import { icon } from '../../dom/icons.js';

// Time (or time range) of a card, plus its live state today: now / next / past
function timeChipsHtml(habit, timeStatus) {
    const past = timeStatus === 'past';
    const timeHtml = timeRangeHtml(
        habit.time,
        habit.duration,
        `text-xs font-semibold ${past ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`
    );
    const statusHtml =
        timeStatus === 'now'
            ? '<span class="text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-600 text-white">עכשיו</span>'
            : timeStatus === 'next'
              ? '<span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">הבא</span>'
              : past
                ? '<span class="text-xs font-normal text-slate-500 dark:text-slate-400">עבר</span>'
                : '';
    return `${timeHtml}${statusHtml}`;
}

export function buildHabitFocusCardHtml(habit, selectedDayObj, isSelectedDayFuture, timeStatus = null) {
    const colorMeta = getColorMeta(habit.color);
    const selectedDayOfWeek = selectedDayObj.dateObj.getDay();
    const isFlexible = habit.goalType === 'flexible';
    const isSlot = habit._slot !== undefined;
    const isDoneSelectedDay =
        !isSelectedDayFuture &&
        (isSlot
            ? isSlotDone(habit, tracker.selectedDateKey, habit._slot)
            : !!(habit.history && habit.history[tracker.selectedDateKey]));
    const slotAttr = isSlot ? ` data-slot="${habit._slot}"` : '';
    const isScheduledToday = isHabitScheduledForDayOfWeek(habit, selectedDayOfWeek);
    const streakLongText = getHabitStreakLongText(habit);
    const weeklyCount = getWeeklyCountForHabit(habit, tracker.weekDays);
    const weeklyGoal = getWeeklyGoalForHabit(habit, tracker.weekDays);
    const justToggled =
        motion.lastToggle && motion.lastToggle.id === habit.id && (!isSlot || motion.lastToggle.slot === habit._slot)
            ? motion.lastToggle
            : null;

    const miniPips = tracker.weekDays
        .map(d => {
            const isDayFuture = d.isFuture || isFutureDateKey(d.key);
            const checked = !isDayFuture && !!(habit.history && habit.history[d.key]);
            const isCurrent = d.key === tracker.selectedDateKey;
            const isDayScheduled = isHabitScheduledOnKey(habit, d.key, d.dateObj.getDay());
            const isDayFlexible = isFlexibleOnKey(habit, d.key);
            const isBeforeStart = !isHabitActiveOnKey(habit, d.key);
            return `
            <div data-tip="${d.dayFull}${isBeforeStart ? ' (לפני תחילת ההרגל)' : isDayFuture ? ' (תאריך עתידי — טרם הגיע)' : isDayFlexible ? ' (גמיש השבוע)' : isDayScheduled ? ' (מתוכנן)' : ' (יום חופשי)'}" class="flex flex-col items-center gap-0.5 p-1 rounded-lg select-none pointer-events-none ${isDayFuture || isBeforeStart ? 'opacity-30' : !isDayScheduled && !isDayFlexible && !checked ? 'opacity-40' : ''}">
                <span class="text-xs font-semibold ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}">${d.dayLetter}</span>
                <span class="w-2.5 h-2.5 rounded-full transition-all ${
                    isDayFuture || isBeforeStart
                        ? 'border border-dashed border-slate-400 dark:border-slate-600 bg-transparent'
                        : checked
                          ? colorMeta.bg
                          : isDayScheduled || isDayFlexible
                            ? 'bg-slate-200 dark:bg-slate-700'
                            : 'border border-dashed border-slate-400 dark:border-slate-600 bg-transparent'
                } ${isCurrent ? 'ring-2 ring-offset-1 ring-indigo-400 dark:ring-offset-slate-900' : ''} ${justToggled && justToggled.key === d.key && checked ? 'pip-pop' : ''}"></span>
            </div>
        `;
        })
        .join('');

    return `
        <div data-flip-key="t-${escapeHtml(habit.id)}${isSlot ? `-${habit._slot}` : ''}" ${isSelectedDayFuture ? '' : `data-action="toggleCardBody" data-id="${escapeHtml(habit.id)}" data-key="${tracker.selectedDateKey}"${slotAttr}`} class="${flashClassFor(habit.id)} ${isSelectedDayFuture ? 'cursor-not-allowed' : 'cursor-pointer'} select-none bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border ${timeStatus === 'now' ? 'border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500/40' : 'border-slate-200/70 dark:border-slate-800'} transition-all duration-300 flex flex-col justify-between ${
            !isScheduledToday && !isFlexible ? 'opacity-85' : 'hover:border-slate-300 dark:hover:border-slate-700'
        }">
            <div class="flex items-start gap-3.5">
                <!-- Large Touch Checkbox Button -->
                <button type="button" ${isSelectedDayFuture ? 'disabled' : `data-action="toggleDay" data-id="${escapeHtml(habit.id)}" data-key="${tracker.selectedDateKey}"${slotAttr}`} data-tip="${isSelectedDayFuture ? 'לא ניתן לסמן הרגלים בתאריך עתידי' : ''}" aria-label="סמן את ${escapeHtml(habit.name)}${isSlot ? `, פעם ${habit._slot + 1} מתוך ${habit._slots}` : ''}" aria-pressed="${isDoneSelectedDay ? 'true' : 'false'}" class="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-xl transition-all ${
                    isSelectedDayFuture
                        ? 'bg-slate-100 dark:bg-slate-800/70 text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 cursor-not-allowed pointer-events-none opacity-60'
                        : isDoneSelectedDay
                          ? `${colorMeta.bg} text-white ${habit.id === motion.lastToggledHabitId && (!isSlot || justToggled) ? 'animate-pop' : ''}`
                          : `${colorMeta.softBg} ${colorMeta.text} border border-slate-200 dark:border-slate-700`
                }">
                    ${
                        isDoneSelectedDay
                            ? `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" aria-hidden="true"><path class="${justToggled ? 'check-draw' : ''}" pathLength="1" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`
                            : `<span class="${justToggled ? 'fade-in-quick' : ''}">${escapeHtml(habit.icon)}</span>`
                    }
                </button>

                <!-- Habit Title & Metadata -->
                <div class="flex-1 min-w-0">
                    <div class="flex items-center flex-wrap gap-1.5">
                        ${habit.time ? timeChipsHtml(habit, timeStatus) : ''}
                        ${isSlot ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">פעם ${habit._slot + 1} מתוך ${habit._slots}</span>` : ''}
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            ${escapeHtml(getHabitCategoryDisplay(habit))}
                        </span>
                        ${isSelectedDayFuture ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">טרם הגיע</span>` : !isScheduledToday && !isFlexible ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400">${isDoneSelectedDay ? 'בונוס יומי' : 'יום מנוחה'}</span>` : ''}
                        ${streakLongText ? `<span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${streakLongText}</span>` : ''}
                    </div>
                    <h3 class="text-sm sm:text-base font-bold mt-1 truncate ${
                        isDoneSelectedDay ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'
                    } ${justToggled ? (isDoneSelectedDay ? 'title-dim' : 'title-undim') : ''}">
                        ${escapeHtml(habit.name)}
                    </h3>
                    ${habit.note ? `<p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">${escapeHtml(habit.note)}</p>` : ''}
                </div>
            </div>

            <!-- Bottom Bar: Mini 7-Day Pips + Weekly Target Progress -->
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                <div class="flex items-center gap-0.5">
                    ${miniPips}
                </div>
                <span data-tip="יעד שבועי" class="shrink-0 text-xs font-semibold ${weeklyGoal > 0 && weeklyCount >= weeklyGoal ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}">
                    <span class="inline-flex items-center gap-1 ${justToggled ? (justToggled.on ? 'count-up' : 'count-down') : ''}">${weeklyGoal > 0 && weeklyCount >= weeklyGoal ? icon('check', 'w-3.5 h-3.5') : ''}${weeklyCount}/${weeklyGoal} השבוע</span>
                </span>
            </div>
        </div>
    `;
}
