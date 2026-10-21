// What analytics shows: every habit, one category or one habit (the filter select).

import { getHabitCategoryDisplay, isHabitArchived } from '../../../core/habit.js';
import { analytics } from '../../../state/analytics.js';
import { getLiveHabits } from '../../../store/selectors.js';
import { Store } from '../../../store/store.js';
import { escapeHtml } from '../../dom/html.js';

export function getAnalyticsFilterInfo() {
    if (analytics.filter.startsWith('habit:')) {
        const habit = Store.habits.find(h => h.id === analytics.filter.slice(6));
        if (habit) return { type: 'habit', habit, list: [habit] };
    } else if (analytics.filter.startsWith('cat:')) {
        const cat = analytics.filter.slice(4);
        const list = Store.habits.filter(h => getHabitCategoryDisplay(h) === cat);
        if (list.length) return { type: 'category', cat, list };
    }
    analytics.filter = 'all';
    return { type: 'all', list: Store.habits };
}

export function renderAnalyticsFilterSelect() {
    const sel = document.getElementById('analyticsFilterSelect');
    if (!sel) return;
    const cats = [...new Set(Store.habits.map(h => getHabitCategoryDisplay(h)))];
    const ordered = [
        ...Store.categories.filter(c => cats.includes(c)),
        ...cats.filter(c => !Store.categories.includes(c))
    ];
    const live = getLiveHabits();
    const archived = Store.habits.filter(h => isHabitArchived(h));
    const opt = (v, label) => `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`;
    sel.innerHTML =
        opt('all', 'כל ההרגלים') +
        (ordered.length > 1
            ? `<optgroup label="קטגוריה">${ordered.map(c => opt('cat:' + c, c)).join('')}</optgroup>`
            : '') +
        `<optgroup label="הרגל">${live.map(h => opt('habit:' + h.id, `${h.icon} ${h.name}`)).join('')}${archived.map(h => opt('habit:' + h.id, `${h.icon} ${h.name} (בארכיון)`)).join('')}</optgroup>`;
    sel.value = analytics.filter;
}
