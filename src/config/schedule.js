// Scheduling constants.

export const MAX_SLOTS = 4;

export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const DAY_PARTS = [
    { id: 'morning', label: 'בוקר', inLabel: 'בבוקר', until: 12 * 60 },
    { id: 'noon', label: 'צהריים', inLabel: 'בצהריים', until: 17 * 60 },
    { id: 'evening', label: 'ערב', inLabel: 'בערב', until: 24 * 60 }
];
