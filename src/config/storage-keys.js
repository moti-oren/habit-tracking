// localStorage keys. Their names and formats must never change: existing user data is stored under them.
// The pre-paint theme script in index.html reads PREFS_STORAGE_KEY by its literal value.

export const STORAGE_KEY = 'habit_tracker_he_v2';

export const CATEGORIES_STORAGE_KEY = 'habit_tracker_categories_he_v2';

export const PREFS_STORAGE_KEY = 'habit_tracker_prefs_he_v2';

// Key of an earlier version of the app: read when the current one is missing (never written).
export const LEGACY_HABITS_KEY = 'pulse_habit_tracker_he_v2';
