// The tracker list: filtering, empty states, then the daily list or the weekly table.

import {
    getHabitCategoryDisplay,
    isHabitActiveInDays,
    isHabitActiveOnKey,
    isHabitArchived
} from '../../../core/habit.js';
import { tracker } from '../../../state/tracker.js';
import { Store } from '../../../store/store.js';
import { emptyStateHtml, firstRunHtml } from '../../components/empty-state.js';
import { escapeHtml } from '../../dom/html.js';
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

    if (filtered.length === 0 && categoryFiltered.length > 0 && Store.habits.every(isHabitArchived)) {
        container.className = '';
        patchHTML(
            container,
            emptyStateHtml({
                icon: 'sparkles',
                title: 'כל ההרגלים בארכיון',
                text: 'אפשר לשחזר הרגל מהארכיון במסך הניהול, עם כל ההיסטוריה שלו, או להתחיל הרגל חדש.',
                actions: [
                    { label: '+ הרגל חדש', action: 'newHabit', primary: true },
                    { label: 'לארכיון', action: 'switchSection', attrs: 'data-arg="manage"' }
                ]
            })
        );
        return;
    }

    if (filtered.length === 0 && categoryFiltered.length > 0) {
        container.className = '';
        patchHTML(
            container,
            emptyStateHtml({
                icon: 'calendar',
                title: tracker.viewMode === 'focus' ? 'אין הרגלים פעילים ביום הזה' : 'אין הרגלים פעילים בשבוע הזה',
                text: 'כל הרגל מופיע מתאריך ההתחלה שלו ועד שהועבר לארכיון. אפשר לשנות את תאריך ההתחלה בעריכת ההרגל.',
                actions: [{ label: 'חזרה להיום', action: 'jumpToToday', primary: true }]
            })
        );
        return;
    }

    if (filtered.length === 0) {
        container.className = '';
        patchHTML(
            container,
            Store.habits.length === 0
                ? firstRunHtml()
                : emptyStateHtml({
                      icon: 'tag',
                      title: `אין הרגלים בקטגוריה „${escapeHtml(tracker.selectedCategory)}”`,
                      text: 'נסו קטגוריה אחרת, או הוסיפו לקטגוריה הזו הרגל חדש.',
                      actions: [
                          { label: '+ הוספת הרגל', action: 'newHabit', primary: true },
                          {
                              label: 'כל ההרגלים',
                              action: 'setCategoryFilter',
                              attrs: 'data-cat="הכל" data-ctx="tracker"'
                          }
                      ]
                  })
        );
        return;
    }

    if (tracker.viewMode === 'focus') {
        renderFocusView(container, filtered);
    } else {
        renderWeekView(container, filtered);
    }
}
