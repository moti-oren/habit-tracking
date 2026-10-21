// Native <select> and date fields that get the custom controls.

import { enhanceSelect } from '../components/custom-select.js';
import { enhanceDateInput } from '../dialogs/calendar/date-input.js';
import { openAnalyticsRangePicker } from '../sections/analytics/actions.js';

export function enhanceFormControls() {
    [
        'habitCategoryInput',
        'habitGoalInput',
        'analyticsFilterSelect',
        'habitTimeHour',
        'habitTimeMinute',
        'habitDuration',
        'habitTimesPerDay'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) enhanceSelect(el);
    });
    const habitStart = document.getElementById('habitStartDateInput');
    if (habitStart) enhanceDateInput(habitStart, 'תאריך התחלה');
    // Both analytics fields open one calendar that picks the whole range
    [
        ['analyticsRangeStart', 'מתאריך'],
        ['analyticsRangeEnd', 'עד תאריך']
    ].forEach(([id, title]) => {
        const el = document.getElementById(id);
        if (el) enhanceDateInput(el, title, openAnalyticsRangePicker);
    });
}
