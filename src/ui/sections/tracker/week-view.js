// The tracker's weekly table.

import { getColorMeta } from '../../../config/colors.js';
import { isFutureDateKey } from '../../../core/dates.js';
import { formatStartDateLabel, getHabitGoalLabel } from '../../../core/format.js';
import { getHabitCategoryDisplay, isHabitActiveOnKey } from '../../../core/habit.js';
import { isFlexibleOnKey, isHabitScheduledOnKey } from '../../../core/schedule.js';
import { getWeeklyCountForHabit, getWeeklyGoalForHabit } from '../../../core/stats.js';
import { motion } from '../../../state/motion.js';
import { tracker } from '../../../state/tracker.js';
import { getHabitStreakLongText, getHabitStreakText } from '../../../store/selectors.js';
import { escapeHtml } from '../../dom/html.js';
import { icon } from '../../dom/icons.js';
import { patchHTML } from '../../dom/patch.js';

// The weekly table: a desktop table and, on phones, one card per habit
export function renderWeekView(container, filtered) {
    // Weekly Matrix Table (focused purely on logging across the week)
    container.className = 'space-y-3';

    const desktopHeaders = tracker.weekDays
        .map(d => {
            const isSelected = d.key === tracker.selectedDateKey;
            return `
            <th scope="col" ${isSelected ? 'aria-current="date"' : ''} class="p-1 text-center ${isSelected ? 'bg-indigo-50/80 dark:bg-indigo-950/40' : ''}">
                <button type="button" ${d.isFuture ? 'disabled' : `data-action="selectDay" data-key="${d.key}"`} title="${d.isFuture ? 'תאריך עתידי — לא ניתן לבחור' : `בחירת ${d.dayFull}`}" aria-pressed="${isSelected}" class="w-full min-h-[44px] py-1.5 px-1 rounded-lg transition ${
                    d.isFuture
                        ? 'text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'text-indigo-700 dark:text-indigo-300'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }">
                    <span class="block text-xs font-semibold">${d.dayShort}</span>
                    <span class="block text-xs font-normal">${d.dayNum}/${d.dateObj.getMonth() + 1}</span>
                </button>
            </th>
        `;
        })
        .join('');

    const desktopRows = filtered
        .map(habit => {
            const colorMeta = getColorMeta(habit.color);
            const streakText = getHabitStreakText(habit);
            const weeklyCount = getWeeklyCountForHabit(habit, tracker.weekDays);
            const weeklyGoal = getWeeklyGoalForHabit(habit, tracker.weekDays);
            const goalLabel = getHabitGoalLabel(habit);

            const dayCells = tracker.weekDays
                .map(d => {
                    const isDayFuture = d.isFuture || isFutureDateKey(d.key);
                    const checked = !isDayFuture && !!(habit.history && habit.history[d.key]);
                    const isSelected = d.key === tracker.selectedDateKey;
                    const isDayScheduled = isHabitScheduledOnKey(habit, d.key, d.dateObj.getDay());
                    const isDayFlexible = isFlexibleOnKey(habit, d.key);
                    const isBeforeStart = !isHabitActiveOnKey(habit, d.key);
                    if (isBeforeStart) {
                        return `
                <td class="p-2 text-center ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''}">
                    <span title="לפני תחילת ההרגל (${formatStartDateLabel(habit.startDate)})" class="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-slate-300 dark:text-slate-700 select-none">·</span>
                </td>
                `;
                    }
                    return `
                <td class="p-2 text-center ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''}">
                    <button type="button" ${isDayFuture ? 'disabled' : `data-action="toggleDay" data-id="${escapeHtml(habit.id)}" data-key="${d.key}"`} data-cell-pop="${motion.lastToggle && motion.lastToggle.on && motion.lastToggle.id === habit.id && motion.lastToggle.key === d.key ? '1' : ''}" title="${isDayFuture ? 'תאריך עתידי - לא ניתן לסמן' : isDayFlexible ? 'גמיש השבוע' : isDayScheduled ? 'יום מתוכנן' : 'יום מנוחה'}" aria-label="סמן ${escapeHtml(habit.name)} ב${d.dayFull}" class="w-10 h-10 mx-auto rounded-xl border flex items-center justify-center transition ${
                        isDayFuture
                            ? 'bg-transparent border-transparent cursor-not-allowed pointer-events-none'
                            : checked
                              ? `${colorMeta.bg} text-white border-transparent shadow-sm`
                              : isDayScheduled || isDayFlexible
                                ? 'bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                : 'bg-transparent text-slate-300 dark:text-slate-700 border-dashed border-slate-200 dark:border-slate-800 opacity-55 hover:opacity-100'
                    }">
                        ${isDayFuture ? '' : checked ? icon('check', 'w-5 h-5', 3) : isDayScheduled || isDayFlexible ? '–' : '•'}
                    </button>
                </td>
            `;
                })
                .join('');

            return `
            <tr class="border-t border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                <td class="py-3.5 px-4">
                    <div class="flex items-center gap-3">
                        <span class="w-10 h-10 rounded-xl ${colorMeta.softBg} flex items-center justify-center text-lg shrink-0">${escapeHtml(habit.icon)}</span>
                        <div class="min-w-0">
                            <div class="text-sm font-bold text-slate-900 dark:text-white truncate">${escapeHtml(habit.name)}</div>
                            <div class="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                <span>${escapeHtml(getHabitCategoryDisplay(habit))}</span>
                                <span>•</span>
                                <span>${escapeHtml(goalLabel)}</span>
                                ${streakText ? `<span>•</span><span>${streakText}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </td>
                ${dayCells}
                <td class="py-3.5 px-4 text-center">
                    <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        weeklyGoal > 0 && weeklyCount >= weeklyGoal
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }">${weeklyCount}/${weeklyGoal}</span>
                </td>
            </tr>
        `;
        })
        .join('');

    const mobileGridCards = filtered
        .map(habit => {
            const colorMeta = getColorMeta(habit.color);
            const streakLongText = getHabitStreakLongText(habit);
            const weeklyCount = getWeeklyCountForHabit(habit, tracker.weekDays);
            const weeklyGoal = getWeeklyGoalForHabit(habit, tracker.weekDays);

            const gridButtons = tracker.weekDays
                .map(d => {
                    const isDayFuture = d.isFuture || isFutureDateKey(d.key);
                    const checked = !isDayFuture && !!(habit.history && habit.history[d.key]);
                    const isSelected = d.key === tracker.selectedDateKey;
                    if (!isHabitActiveOnKey(habit, d.key)) {
                        return `
                <span title="לפני תחילת ההרגל" class="flex flex-col items-center py-2 rounded-xl border border-transparent text-slate-300 dark:text-slate-700 select-none">
                    <span class="text-xs font-semibold">${d.dayLetter}</span>
                    <span class="text-xs font-semibold mt-0.5">·</span>
                </span>
                `;
                    }
                    return `
                <button type="button" ${isDayFuture ? 'disabled' : `data-action="toggleDay" data-id="${escapeHtml(habit.id)}" data-key="${d.key}"`} data-cell-pop="${motion.lastToggle && motion.lastToggle.on && motion.lastToggle.id === habit.id && motion.lastToggle.key === d.key ? '1' : ''}" class="min-h-[44px] flex flex-col items-center justify-center py-2 rounded-xl border transition ${
                    isDayFuture
                        ? 'bg-transparent border-transparent cursor-not-allowed pointer-events-none'
                        : checked
                          ? `${colorMeta.bg} text-white border-transparent shadow-sm`
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200/70 dark:border-slate-700/70'
                } ${isSelected ? 'ring-2 ring-indigo-500/50' : ''}">
                    <span class="text-xs font-semibold ${checked ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}">${d.dayLetter}</span>
                    <span class="text-xs font-semibold mt-0.5 h-4 flex items-center">${isDayFuture ? '&nbsp;' : checked ? icon('check', 'w-4 h-4', 3) : '–'}</span>
                </button>
            `;
                })
                .join('');

            return `
            <div class="md:hidden bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-9 h-9 rounded-xl ${colorMeta.softBg} flex items-center justify-center text-lg shrink-0">${escapeHtml(habit.icon)}</span>
                        <div class="min-w-0">
                            <h3 class="text-sm font-bold text-slate-900 dark:text-white truncate">${escapeHtml(habit.name)}</h3>
                            <div class="flex items-center flex-wrap gap-2 text-xs">
                                ${streakLongText ? `<span class="text-slate-500 dark:text-slate-400">${streakLongText}</span><span class="text-slate-500 dark:text-slate-400">•</span>` : ''}
                                <span class="text-slate-500 dark:text-slate-400">${weeklyCount}/${weeklyGoal} השבוע</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-7 gap-1.5">
                    ${gridButtons}
                </div>
            </div>
        `;
        })
        .join('');

    patchHTML(
        container,
        `
        <div class="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-right border-collapse">
                    <thead>
                        <tr class="bg-slate-50/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs">
                            <th scope="col" class="py-3.5 px-4 font-bold">הרגל</th>
                            ${desktopHeaders}
                            <th scope="col" class="py-3.5 px-4 text-center font-bold">יעד שבועי</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${desktopRows}
                    </tbody>
                </table>
            </div>
        </div>
        ${mobileGridCards}
    `
    );
}
