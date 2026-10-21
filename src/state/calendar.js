// The full calendar dialog's state: the month (or year) shown, and what it is picking.

export const calendar = Object.seal({
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    /** 'month' | 'year' */
    viewMode: 'month',
    /**
     * null: the calendar navigates the tracker to the tapped day.
     * Otherwise it picks a date for a form field: { value, min, max, title, onPick, returnFocus },
     * or a range: { start, end, focusKey, max, onRangePick, range: true, anchor, returnFocus }.
     */
    picker: null
});
