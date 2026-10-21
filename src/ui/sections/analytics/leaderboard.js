// The habit ranking of the analytics section.

import { formatRangeLabel } from '../../../core/analytics-range.js';
import { getHabitGoalLabel } from '../../../core/format.js';
import { isHabitActiveInDays } from '../../../core/habit.js';
import { analytics } from '../../../state/analytics.js';
import { motion } from '../../../state/motion.js';
import { calculateStreak, getHabitRangeProgress, getHabitStreakText } from '../../../store/selectors.js';
import { Store } from '../../../store/store.js';
import { escapeHtml } from '../../dom/html.js';
import { patchHTML } from '../../dom/patch.js';
import { getAnalyticsFilterInfo } from './filter.js';
import { getAnalyticsDays } from './range-controls.js';

const prevLeaderboardPct = {};

function widenFrom(id, pct, idx) {
    // memoised per render so the two calls above agree
    const key = `${id}|${pct}`;
    if (widenFrom.cache[key]) return widenFrom.cache[key];
    const from = motion.analyticsEntryAnim ? 0 : prevLeaderboardPct[id];
    const out =
        from === undefined || from === pct
            ? { cls: '', style: '' }
            : {
                  cls: 'bar-widen',
                  style: `--w-from:${from}%; animation-delay:${motion.analyticsEntryAnim ? Math.min(idx, 8) * 40 : 0}ms;`
              };
    widenFrom.cache[key] = out;
    return out;
}

widenFrom.cache = {};

export function renderLeaderboard() {
    widenFrom.cache = {};
    const container = document.getElementById('habitLeaderboardList');
    if (!container) return;

    const days = getAnalyticsDays();
    const isCurrentWeek = analytics.range.preset === 'week' && formatRangeLabel(analytics.range) === 'השבוע הנוכחי';
    const periodWord = isCurrentWeek ? 'השבוע' : 'בטווח';
    const progressOf = h => {
        const { target, done } = getHabitRangeProgress(h, days, false);
        return { goal: target, count: done, pct: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0 };
    };
    const weekHabits = getAnalyticsFilterInfo().list.filter(h => isHabitActiveInDays(h, days));
    if (weekHabits.length === 0) {
        patchHTML(
            container,
            `<p class="text-xs text-slate-500 dark:text-slate-400 text-center py-6">${Store.habits.length === 0 ? 'אין הרגלים להצגה בדירוג.' : 'אין הרגלים פעילים בטווח הזה.'}</p>`
        );
        motion.analyticsEntryAnim = false;
        return;
    }

    // Sort by weekly goal completion percentage first so flexible habits are compared fairly
    const rows = weekHabits.map(h => ({ h, progress: progressOf(h), streak: calculateStreak(h) }));
    rows.sort((a, b) => b.progress.pct - a.progress.pct || b.streak - a.streak);
    const sorted = rows.map(r => r.h);
    const progressById = new Map(rows.map(r => [r.h.id, r.progress]));

    patchHTML(
        container,
        sorted
            .map((habit, idx) => {
                const { count: weeklyCount, goal: weeklyGoal, pct } = progressById.get(habit.id);
                const goalLabel = getHabitGoalLabel(habit);
                const streakBadgeText = getHabitStreakText(habit);

                return `
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/80 space-y-2.5">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-6 h-6 rounded-full bg-slate-200/80 dark:bg-slate-700 text-xs font-semibold flex items-center justify-center shrink-0">${idx + 1}</span>
                        <span class="text-lg shrink-0">${escapeHtml(habit.icon)}</span>
                        <div class="min-w-0">
                            <span class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 block truncate">${escapeHtml(habit.name)}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400 block truncate">${escapeHtml(goalLabel)}</span>
                        </div>
                    </div>
                    <span class="hidden sm:inline-flex text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                        ${streakBadgeText}
                    </span>
                </div>
                <div class="flex items-center gap-3">
                    <div class="flex-1 bg-slate-200/80 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div class="${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'} h-full rounded-full ${widenFrom(habit.id, pct, idx).cls}" style="width: ${pct}%; ${widenFrom(habit.id, pct, idx).style}"></div>
                    </div>
                    <span class="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">${weeklyCount}/${weeklyGoal}<span class="hidden sm:inline"> ${periodWord} (${pct}%)</span></span>
                    <span class="sm:hidden text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">${streakBadgeText}</span>
                </div>
            </div>
        `;
            })
            .join('')
    );
    sorted.forEach(h => {
        prevLeaderboardPct[h.id] = progressById.get(h.id).pct;
    });
    motion.analyticsEntryAnim = false;
}
