// The habits the tracker shows for the selected day (category filter + active that day).

import { getHabitCategoryDisplay, isHabitActiveOnKey } from '../../../core/habit.js';
import { tracker } from '../../../state/tracker.js';
import { Store } from '../../../store/store.js';

export function getTrackerVisibleHabits() {
    const byCategory =
        tracker.selectedCategory === 'הכל'
            ? Store.habits
            : Store.habits.filter(h => getHabitCategoryDisplay(h) === tracker.selectedCategory);
    return byCategory.filter(h => isHabitActiveOnKey(h, tracker.selectedDateKey));
}
