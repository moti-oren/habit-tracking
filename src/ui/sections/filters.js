// Category filter of the tracker or the manage section (only the list it belongs to re-renders).

import { app } from '../../state/app.js';
import { manage } from '../../state/manage.js';
import { tracker } from '../../state/tracker.js';
import { renderCategoryFilterBar } from './category-filter-bar.js';
import { renderManageSection } from './manage/manage-grid.js';
import { renderHabitsList } from './tracker/habits-list.js';
import { renderTrackerSummary } from './tracker/summary.js';

export function setCategoryFilter(category, context = null) {
    const targetContext = context || (app.currentMainSection === 'manage' ? 'manage' : 'tracker');
    if (targetContext === 'manage') {
        manage.selectedCategory = category;
    } else {
        tracker.selectedCategory = category;
    }
    // only the list the filter belongs to changes
    if (targetContext === 'manage') {
        renderCategoryFilterBar('manage');
        renderManageSection();
    } else {
        renderTrackerSummary();
        renderCategoryFilterBar('tracker');
        renderHabitsList();
    }
}
