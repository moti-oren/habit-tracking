// How each dialog closes (Escape, and a click on its dimmed backdrop).

import { closeFullCalendarModal } from '../ui/dialogs/calendar/calendar.js';
import { closeCategoryManagerModal } from '../ui/dialogs/category-manager/actions.js';
import { closeConfirmModal } from '../ui/dialogs/confirm.js';
import { closeHabitModal } from '../ui/dialogs/habit-form/habit-form.js';

export const MODAL_CLOSERS = {
    habitModalBackdrop: () => closeHabitModal(),
    categoryModalBackdrop: () => closeCategoryManagerModal(),
    fullCalendarModalBackdrop: () => closeFullCalendarModal(),
    confirmModalBackdrop: () => closeConfirmModal()
};
