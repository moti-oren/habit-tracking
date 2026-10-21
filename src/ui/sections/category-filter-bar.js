// The category pills above the tracker list and the manage grid, with their counts.

import { UNCATEGORIZED_LABEL } from '../../config/categories.js';
import { manage } from '../../state/manage.js';
import { tracker } from '../../state/tracker.js';
import { getLiveHabits } from '../../store/selectors.js';
import { Store } from '../../store/store.js';
import { scheduleScrollFades } from '../components/scroll-fades.js';
import { escapeHtml } from '../dom/html.js';
import { patchHTML } from '../dom/patch.js';

export function renderCategoryFilterBar(context = 'tracker') {
    const hasUncategorized = Store.habits.some(h => !(h.category || '').trim());
    const allFilterCategories = ['הכל', ...Store.categories];
    if (hasUncategorized) {
        allFilterCategories.push(UNCATEGORIZED_LABEL);
    }

    if (!allFilterCategories.includes(tracker.selectedCategory)) {
        tracker.selectedCategory = 'הכל';
    }
    if (!allFilterCategories.includes(manage.selectedCategory)) {
        manage.selectedCategory = 'הכל';
    }

    const live = getLiveHabits();
    const countFor = cat => {
        if (cat === 'הכל') return live.length;
        if (cat === UNCATEGORIZED_LABEL) return live.filter(h => !(h.category || '').trim()).length;
        return live.filter(h => h.category === cat).length;
    };
    const buildPills = (activeCat, ctx) =>
        allFilterCategories
            .map(cat => {
                const active = cat === activeCat;
                const n = countFor(cat);
                const badge =
                    n > 0
                        ? `<span class="min-w-[1.25rem] h-5 px-1 rounded-full text-xs leading-5 text-center font-semibold ${
                              active
                                  ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
                                  : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300'
                          }">${n}</span>`
                        : '';
                return `
            <button type="button" aria-pressed="${active}" aria-label="${escapeHtml(cat)}${n > 0 ? `, ${n} הרגלים` : ''}" data-action="setCategoryFilter" data-cat="${escapeHtml(cat)}" data-ctx="${ctx}" class="tap-44 h-10 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition inline-flex items-center gap-1.5 ${
                active
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
            }">
                <span>${escapeHtml(cat)}</span>${badge}
            </button>
        `;
            })
            .join('');

    if (context === 'manage') {
        const manageBar = document.getElementById('manageCategoryFilterBar');
        if (manageBar) patchHTML(manageBar, buildPills(manage.selectedCategory, 'manage'));
        scheduleScrollFades();
        return;
    }
    const bar = document.getElementById('categoryFilterBar');
    if (bar) patchHTML(bar, buildPills(tracker.selectedCategory, 'tracker'));
    scheduleScrollFades();

    const indicator = document.getElementById('trackerActiveFilterIndicator');
    if (indicator) {
        if (tracker.selectedCategory !== 'הכל') {
            indicator.classList.remove('hidden');
            indicator.innerHTML = `
                <span>מוצגים רק הרגלי <strong>${escapeHtml(tracker.selectedCategory)}</strong></span>
                <span>·</span>
                <button type="button" data-action="setCategoryFilter" data-cat="הכל" data-ctx="tracker" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">הצג הכל</button>
            `;
        } else {
            indicator.classList.add('hidden');
            indicator.innerHTML = '';
        }
    }
}
