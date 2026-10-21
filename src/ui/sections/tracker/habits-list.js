// The tracker list: filtering, empty states, then the daily list or the weekly table.

import { getHabitCategoryDisplay, isHabitActiveInDays, isHabitActiveOnKey } from '../../../core/habit.js';
import { tracker } from '../../../state/tracker.js';
import { Store } from '../../../store/store.js';
import { patchHTML } from '../../dom/patch.js';
import { renderFocusView } from './focus-view.js';
import { renderWeekView } from './week-view.js';

export function renderHabitsList() {
    const container = document.getElementById('habitsListContainer');

    const categoryFiltered =
        tracker.selectedCategory === 'הכל'
            ? Store.habits
            : Store.habits.filter(h => getHabitCategoryDisplay(h) === tracker.selectedCategory);
    // Habits only appear from their start date: the focus view checks the selected day,
    // the weekly table checks whether the habit started at some point during the visible week
    const filtered = categoryFiltered.filter(h =>
        tracker.viewMode === 'focus'
            ? isHabitActiveOnKey(h, tracker.selectedDateKey)
            : isHabitActiveInDays(h, tracker.weekDays)
    );

    if (filtered.length === 0 && categoryFiltered.length > 0) {
        container.className = '';
        patchHTML(
            container,
            `
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700">
                
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">${tracker.viewMode === 'focus' ? 'אין הרגלים פעילים ביום הזה' : 'אין הרגלים פעילים בשבוע הזה'}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">כל הרגל מופיע רק מתאריך ההתחלה שלו ועד שהועבר לארכיון. אפשר לשנות את תאריך ההתחלה בעריכת ההרגל.</p>
                <button data-action="jumpToToday" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition">חזרה להיום</button>
            </div>
        `
        );
        return;
    }

    if (filtered.length === 0) {
        container.className = '';
        patchHTML(
            container,
            `
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700">
                <div class="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
                    <svg class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></svg>
                </div>
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">${Store.habits.length === 0 ? 'עוד אין לכם הרגלים' : 'אין הרגלים בקטגוריה זו'}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">${Store.habits.length === 0 ? 'הוסיפו את ההרגל הראשון שלכם כדי להתחיל.' : 'נסו קטגוריה אחרת, או הוסיפו הרגל חדש לקטגוריה הזו.'}</p>
                <div class="flex flex-wrap items-center justify-center gap-2">
                    <button data-action="newHabit" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition">
                        + הוספת הרגל
                    </button>
                    ${
                        Store.habits.length > 0
                            ? `
                        <button data-action="setCategoryFilter" data-cat="הכל" data-ctx="tracker" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition">
                            הצג את כל ההרגלים
                        </button>
                    `
                            : ''
                    }
                </div>
            </div>
        `
        );
        return;
    }

    if (tracker.viewMode === 'focus') {
        renderFocusView(container, filtered);
    } else {
        renderWeekView(container, filtered);
    }
}
