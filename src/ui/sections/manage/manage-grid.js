// The manage section: the grid of habit cards.

import { getColorMeta } from '../../../config/colors.js';
import { HEBREW_DAYS_SHORT } from '../../../config/hebrew.js';
import {
    formatStartDateLabel,
    getHabitGoalLabel,
    getHabitStreakUnit,
    scheduleTimeSummary
} from '../../../core/format.js';
import { getHabitCategoryDisplay } from '../../../core/habit.js';
import { isHabitScheduledForDayOfWeek } from '../../../core/schedule.js';
import { manage } from '../../../state/manage.js';
import { motion } from '../../../state/motion.js';
import { calculateStreak, getLiveHabits } from '../../../store/selectors.js';
import { flashClassFor } from '../../dom/flip.js';
import { escapeHtml, timeRangeHtml } from '../../dom/html.js';
import { patchHTML } from '../../dom/patch.js';
import { renderArchiveSection } from './archive.js';
import { updateManageBulkBar } from './bulk-bar.js';

export function renderManageSection() {
    const grid = document.getElementById('manageHabitsGrid');
    const subtitle = document.getElementById('manageHabitsSubtitle');
    if (!grid) return;

    const liveHabits = getLiveHabits();
    const filtered =
        manage.selectedCategory === 'הכל'
            ? liveHabits
            : liveHabits.filter(h => getHabitCategoryDisplay(h) === manage.selectedCategory);

    if (subtitle) {
        subtitle.textContent = `מוצגים ${filtered.length} מתוך ${liveHabits.length} הרגלים`;
    }
    renderArchiveSection();
    manage.visibleHabitIds = filtered.map(h => h.id);
    manage.selectedHabitIds.forEach(id => {
        if (!manage.visibleHabitIds.includes(id)) manage.selectedHabitIds.delete(id);
    });
    updateManageBulkBar();

    if (filtered.length === 0) {
        patchHTML(
            grid,
            `
            <div class="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700">
                <p class="text-sm font-bold text-slate-700 dark:text-slate-200">לא נמצאו הרגלים בקטגוריה זו</p>
                <button data-action="newHabit" class="mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">
                    + הוספת הרגל חדש
                </button>
            </div>
        `
        );
        return;
    }

    patchHTML(
        grid,
        filtered
            .map(habit => {
                const colorMeta = getColorMeta(habit.color);
                const goalLabel = getHabitGoalLabel(habit);
                const streak = calculateStreak(habit);
                const streakUnit = getHabitStreakUnit(habit);
                const totalHistoryChecks = habit.history ? Object.values(habit.history).filter(Boolean).length : 0;
                const menuId = escapeHtml(`habitMenu_${habit.id}`);
                const isSelected = manage.selectMode && manage.selectedHabitIds.has(habit.id);

                const daysBadges = HEBREW_DAYS_SHORT.map((dLabel, idx) => {
                    const active = habit.goalType === 'flexible' || isHabitScheduledForDayOfWeek(habit, idx);
                    return `
                <span class="w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center ${
                    active
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        : 'text-slate-300 dark:text-slate-600'
                }">${dLabel}</span>
            `;
                }).join('');

                return `
            <div role="button" tabindex="0" data-habit-card="${escapeHtml(habit.id)}" data-flip-key="m-${escapeHtml(habit.id)}" data-action="manageCard" data-id="${escapeHtml(habit.id)}" data-key-activate ${manage.selectMode ? `aria-pressed="${isSelected}"` : ''} aria-label="${manage.selectMode ? 'בחירת' : 'עריכת'} ${escapeHtml(habit.name)}" class="${flashClassFor(habit.id)} habit-drag-card group cursor-pointer bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border flex flex-col justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition ${
                isSelected
                    ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                    : 'border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }">
                <div class="flex items-stretch justify-between gap-3">
                    <div class="flex items-start gap-3.5 min-w-0">
                        <div class="w-12 h-12 rounded-xl ${colorMeta.softBg} flex items-center justify-center text-2xl shrink-0">
                            ${escapeHtml(habit.icon)}
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center flex-wrap gap-1.5">
                                <span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                    ${escapeHtml(getHabitCategoryDisplay(habit))}
                                </span>
                                <span class="text-xs font-normal text-slate-500 dark:text-slate-400">
                                    ${escapeHtml(goalLabel)}
                                </span>
                                ${
                                    habit.time
                                        ? timeRangeHtml(
                                              habit.time,
                                              habit.duration,
                                              'text-xs font-semibold text-slate-600 dark:text-slate-300'
                                          )
                                        : habit.slotTimes
                                          ? habit.slotTimes.some(Boolean)
                                              ? `<span dir="ltr" class="tabular-nums text-xs font-semibold text-slate-600 dark:text-slate-300">${habit.slotTimes.filter(Boolean).join(' · ')}</span>`
                                              : ''
                                          : habit.dayTimes
                                            ? `<span data-tip="${escapeHtml(scheduleTimeSummary(habit))}" data-tip-touch class="text-xs font-semibold text-slate-600 dark:text-slate-300 underline decoration-dotted underline-offset-2">שעות משתנות</span>`
                                            : ''
                                }
                            </div>
                            <h3 class="text-base font-bold text-slate-900 dark:text-white mt-1.5 truncate">
                                ${escapeHtml(habit.name)}
                            </h3>
                            ${habit.note ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(habit.note)}</p>` : ''}
                        </div>
                    </div>

                    ${
                        manage.selectMode
                            ? `
                    <span class="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${habit.id === motion.lastSelectToggledId && isSelected ? 'pip-pop' : ''} ${motion.selectModeJustChanged ? 'fade-in-quick' : ''} ${
                        isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                    }" aria-hidden="true">${isSelected ? '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}</span>
                    `
                            : `
                    <div class="flex flex-col items-center shrink-0 -mt-1 -ml-1">
                    <!-- Overflow menu: edit / archive / delete -->
                    <div class="relative">
                        <button type="button" data-action="toggleMenu" data-arg="${menuId}" aria-haspopup="menu" aria-expanded="false" aria-label="פעולות עבור ${escapeHtml(habit.name)}" title="פעולות" class="tap-44 w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
                        </button>
                        <div id="${menuId}" data-menu-panel role="menu" data-stop-propagation class="hidden absolute top-full mt-1.5 left-0 z-30 min-w-[12rem] p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg">
                            <button type="button" role="menuitem" data-action="menuEdit" data-id="${escapeHtml(habit.id)}" class="w-full text-right px-3 py-2 rounded-lg text-sm font-normal text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">עריכה</button>
                            <button type="button" role="menuitem" data-action="menuArchive" data-id="${escapeHtml(habit.id)}" class="w-full text-right px-3 py-2 rounded-lg text-sm font-normal text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">העברה לארכיון</button>
                            <button type="button" role="menuitem" data-action="menuDelete" data-id="${escapeHtml(habit.id)}" class="w-full text-right px-3 py-2 rounded-lg text-sm font-normal text-rose-600 dark:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">מחיקה</button>
                        </div>
                    </div>
                    <!-- Drag handle (under the menu, centred in the remaining height): makes "drag to another category" discoverable -->
                    <span data-tip="גררו להעברה לקטגוריה אחרת" aria-hidden="true" class="self-end -ml-[2px] w-5 flex-1 min-h-8 flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-grab group-hover:text-slate-700 dark:group-hover:text-slate-200 transition"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span>
                    </div>
                    `
                    }
                </div>

                <!-- Scheduled Days & Stats -->
                <div class="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-1" title="ימי פעילות בשבוע">
                        ${daysBadges}
                    </div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                        ${streak > 0 ? `<span>רצף ${streak} ${streakUnit}</span><span class="mx-1 text-slate-300 dark:text-slate-600">·</span>` : ''}
                        <span>${totalHistoryChecks} סימונים</span>
                        <span class="block mt-0.5 text-xs text-slate-500 dark:text-slate-400">החל מ-${formatStartDateLabel(habit.startDate)}</span>
                    </div>
                </div>
            </div>
        `;
            })
            .join('')
    );
}
