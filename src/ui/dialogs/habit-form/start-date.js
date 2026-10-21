// The habit's start date field.

import { getDateKeyDaysAgo, isValidDateKey } from '../../../core/dates.js';
import { formatStartDateLabel } from '../../../core/format.js';
import { getEarliestCheckedKey } from '../../../core/habit.js';

// The start date can't be in the future, and can't be later than the habit's first check mark
// (otherwise existing marks would silently disappear from the stats)
function getMaxStartDateKey(habit) {
    const today = getDateKeyDaysAgo(0);
    const firstCheck = habit ? getEarliestCheckedKey(habit) : null;
    return firstCheck && firstCheck < today ? firstCheck : today;
}

export function setupStartDateInput(value, habit) {
    const input = document.getElementById('habitStartDateInput');
    const hint = document.getElementById('habitStartDateHint');
    if (!input) return;
    const maxKey = getMaxStartDateKey(habit);
    input.max = maxKey;
    input.value = value && value <= maxKey ? value : maxKey;
    if (hint) {
        const limited = habit && maxKey < getDateKeyDaysAgo(0);
        hint.textContent = limited ? `לא ניתן לאחר מעבר ל-${formatStartDateLabel(maxKey)}, היום של הסימון הראשון.` : '';
        hint.classList.toggle('hidden', !limited);
    }
}

export function readStartDateInput(habit) {
    const input = document.getElementById('habitStartDateInput');
    const maxKey = getMaxStartDateKey(habit);
    const value = input && isValidDateKey(input.value) ? input.value : maxKey;
    return value > maxKey ? maxKey : value;
}
