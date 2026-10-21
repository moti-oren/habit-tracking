// What change / input / keydown / submit events do, by the name in data-change, data-input, data-keydown, data-submit.

import {
    cancelCategoryRename,
    handleModalAddCategory,
    saveCategoryRename
} from '../ui/dialogs/category-manager/actions.js';
import { handleCustomIconInput } from '../ui/dialogs/habit-form/appearance.js';
import {
    syncHabitTimeFields,
    togglePerDayTimes,
    updateHabitSaveState
} from '../ui/dialogs/habit-form/form-controller.js';
import { handleHabitFormEnter, saveHabitForm } from '../ui/dialogs/habit-form/habit-form.js';
import { onTimeEditorChange, setModalTimesPerDay } from '../ui/dialogs/habit-form/time-editor.js';
import { applyCustomAnalyticsRange, setAnalyticsFilter } from '../ui/sections/analytics/actions.js';

export const ChangeActions = {
    analyticsFilter: el => setAnalyticsFilter(el.value),
    customRange: () => applyCustomAnalyticsRange(),
    habitFormChanged: () => updateHabitSaveState(),
    timesPerDay: el => setModalTimesPerDay(Number(el.value)),
    perDayTimes: el => togglePerDayTimes(el.checked),
    timeEditor: () => onTimeEditorChange(),
    syncTimeFields: () => syncHabitTimeFields()
};

export const InputActions = {
    habitFormChanged: () => updateHabitSaveState(),
    customIcon: el => handleCustomIconInput(el)
};

export const KeyActions = {
    habitFormEnter: (el, e) => handleHabitFormEnter(e),
    addCategoryEnter: (el, e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        handleModalAddCategory({ preventDefault() {} });
    },
    categoryRename: (el, e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveCategoryRename(el.dataset.cat);
        } else if (e.key === 'Escape') cancelCategoryRename();
    }
};

export const SubmitActions = {
    saveHabit: (el, e) => saveHabitForm(e),
    addCategory: (el, e) => handleModalAddCategory(e)
};
