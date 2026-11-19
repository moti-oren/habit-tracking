// The collapsible archive under the manage grid.

import { getColorMeta } from '../../../config/colors.js';
import { formatDateKey } from '../../../core/dates.js';
import { formatStartDateLabel } from '../../../core/format.js';
import { getHabitCategoryDisplay, isHabitArchived } from '../../../core/habit.js';
import { manage } from '../../../state/manage.js';
import { Store } from '../../../store/store.js';
import { escapeHtml } from '../../dom/html.js';
import { icon } from '../../dom/icons.js';
import { patchHTML } from '../../dom/patch.js';

export function renderArchiveSection() {
    const section = document.getElementById('manageArchiveSection');
    if (!section) return;
    const archived = Store.habits.filter(isHabitArchived);
    if (archived.length === 0) {
        section.classList.add('hidden');
        section.innerHTML = '';
        return;
    }
    section.classList.remove('hidden');
    const items = archived
        .map(habit => {
            const colorMeta = getColorMeta(habit.color);
            const totalChecks = habit.history ? Object.values(habit.history).filter(Boolean).length : 0;
            const lastActiveKey = (() => {
                const p = habit.archivedSince.split('-').map(Number);
                return formatDateKey(new Date(p[0], p[1] - 1, p[2] - 1));
            })();
            const rangeText =
                lastActiveKey < habit.startDate
                    ? 'לא היה פעיל'
                    : `${formatStartDateLabel(habit.startDate)} – ${formatStartDateLabel(lastActiveKey)}`;
            return `
            <div data-flip-key="a-${escapeHtml(habit.id)}" class="p-3.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="w-10 h-10 rounded-xl ${colorMeta.softBg} flex items-center justify-center text-lg shrink-0 grayscale-[40%]">${escapeHtml(habit.icon)}</span>
                    <div class="min-w-0">
                        <div class="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">${escapeHtml(habit.name)}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 truncate">${escapeHtml(getHabitCategoryDisplay(habit))} · ${rangeText} · ${totalChecks} סימונים</div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button data-action="restoreHabit" data-id="${escapeHtml(habit.id)}" class="h-9 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold transition flex items-center gap-1.5">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5"/></svg>
                        <span>שחזור</span>
                    </button>
                    <button data-action="deleteHabit" data-id="${escapeHtml(habit.id)}" data-tip="מחיקה לצמיתות" aria-label="מחיקת ${escapeHtml(habit.name)} לצמיתות" class="tap-44 w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center justify-center transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </div>
        `;
        })
        .join('');
    patchHTML(
        section,
        `
        <button type="button" id="archiveToggle" data-action="toggleArchive" aria-expanded="${manage.archiveExpanded}" aria-controls="archiveReveal" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-200/60 dark:bg-slate-900/80 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                <span>ארכיון</span>
                <span class="px-2 py-0.5 rounded-full bg-slate-300/70 dark:bg-slate-800 text-xs font-semibold">${archived.length}</span>
            </div>
            <span class="text-xs font-semibold text-indigo-600 dark:text-indigo-400"><span class="inline-flex items-center gap-1"><span data-toggle-text>${manage.archiveExpanded ? 'הסתר' : 'הצג'}</span>${icon('chevronDown', 'w-4 h-4 transition-transform' + (manage.archiveExpanded ? ' rotate-180' : ''))}</span></span>
        </button>
        <div id="archiveReveal" class="reveal ${manage.archiveExpanded ? 'is-open' : ''}" ${manage.archiveExpanded ? '' : 'inert'}>
            <div>
                <p class="text-xs text-slate-500 dark:text-slate-400 px-1 pt-3 mb-2">הרגלים בארכיון לא מופיעים במעקב מהיום שהועברו, אבל ההיסטוריה שלהם נשמרת בסטטיסטיקה של הימים הקודמים.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">${items}</div>
            </div>
        </div>
    `
    );
}
