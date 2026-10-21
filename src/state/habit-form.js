// The add/edit habit dialog's state (the values that are not read straight from its fields).

import { COLOR_OPTIONS } from '../config/colors.js';
import { ICON_OPTIONS } from '../config/icons.js';

export const habitForm = Object.seal({
    icon: ICON_OPTIONS[0].emoji,
    color: COLOR_OPTIONS[0].id,
    /** 'daily' | 'flexible' | 'fixed_days' */
    goalType: 'daily',
    fixedDays: [0, 2, 4],
    /** The form as it was when opened: when editing, Save is enabled only after a real change. */
    initialState: null,
    /** 'forward' | 'all': which days a schedule change applies to. */
    scheduleScope: 'forward',
    // ===== Time editor: once a day / several times a day / different times per day =====
    // The window keeps a small model; one hour + minute pair edits the cell picked with the chips.
    timeModel: {
        uniform: ['', '', '', ''], // every day the same
        cells: Array.from({ length: 7 }, () => ['', '', '', '']), // per weekday, when days differ
        day: 0,
        slot: 0
    }
});
