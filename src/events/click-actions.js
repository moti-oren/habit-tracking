// ===================================================================
// Events: no inline handlers. Markup names what should happen —
// data-action (click), data-change, data-input, data-keydown, data-submit —
// with its arguments in data-id / data-key / data-arg / data-cat / data-ctx / data-slot.
// One delegated listener per event type on <body> looks the name up in these tables.
// ===================================================================

import { switchMainSection } from '../ui/app/navigation.js';
import { triggerToastUndo } from '../ui/app/undo.js';
import { closeAllMenus, toggleMenu } from '../ui/components/menus.js';
import { nudgeModal } from '../ui/components/modal.js';
import {
    closeFullCalendarModal,
    handleCalendarDayClick,
    jumpCalendarToCurrentMonth,
    openCalendarMonthFromYear,
    openFullCalendarModal,
    selectDateFromCalendar,
    shiftCalendarMonth,
    toggleCalendarYearView
} from '../ui/dialogs/calendar/calendar.js';
import {
    bulkDeleteSelectedCategories,
    cancelCategoryRename,
    closeCategoryManagerModal,
    handleModalAddCategory,
    openCategoryManagerModal,
    promptDeleteCategory,
    saveCategoryRename,
    startCategoryRename,
    toggleCategorySelectMode,
    toggleCategorySelected,
    toggleSelectAllCategories
} from '../ui/dialogs/category-manager/actions.js';
import { closeConfirmModal, runConfirm } from '../ui/dialogs/confirm.js';
import { selectModalColor, selectModalIcon, toggleCustomIconPanel } from '../ui/dialogs/habit-form/appearance.js';
import { setModalGoalType, toggleModalFixedDay } from '../ui/dialogs/habit-form/goal-type.js';
import { closeHabitModal, openHabitModal, saveHabitForm } from '../ui/dialogs/habit-form/habit-form.js';
import { setScheduleScope } from '../ui/dialogs/habit-form/schedule-scope.js';
import { toggleHabitSection } from '../ui/dialogs/habit-form/sections.js';
import { copyDayTimesToAll, pickTimeDay, pickTimeSlot } from '../ui/dialogs/habit-form/time-editor.js';
import { setAnalyticsPreset, shiftAnalyticsRange } from '../ui/sections/analytics/actions.js';
import { setCategoryFilter } from '../ui/sections/filters.js';
import {
    archiveHabitById,
    bulkArchiveSelectedHabits,
    bulkDeleteSelectedHabits,
    exitManageSelectMode,
    exportBackup,
    handleManageCardClick,
    importBackup,
    loadSampleData,
    openResetModal,
    promptDeleteHabitById,
    restoreHabitById,
    toggleArchiveSection,
    toggleManageSelectMode,
    toggleSelectAllManageHabits
} from '../ui/sections/manage/actions.js';
import {
    clearAllForSelectedDay,
    jumpToToday,
    markAllForSelectedDay,
    selectDay,
    setViewMode,
    shiftWeek,
    toggleHabitDay,
    toggleUnscheduledGroup
} from '../ui/sections/tracker/actions.js';
import { toggleSound } from '../ui/shell/sound.js';
import { toggleTheme } from '../ui/shell/theme.js';
import { MODAL_CLOSERS } from './modal-closers.js';

const slotOf = el => (el.dataset.slot !== undefined ? Number(el.dataset.slot) : undefined);

export const ClickActions = {
    switchSection: el => switchMainSection(el.dataset.arg),
    toggleSound: () => toggleSound(),
    toggleTheme: () => toggleTheme(),
    openCalendar: () => openFullCalendarModal(),
    shiftWeek: el => shiftWeek(Number(el.dataset.arg)),
    jumpToToday: () => jumpToToday(),
    setViewMode: el => setViewMode(el.dataset.arg),
    toggleMenu: (el, e) => toggleMenu(e, el.dataset.arg, el),
    markAll: () => {
        closeAllMenus();
        markAllForSelectedDay();
    },
    clearAll: () => {
        closeAllMenus();
        clearAllForSelectedDay();
    },
    shiftRange: el => shiftAnalyticsRange(Number(el.dataset.arg)),
    newHabit: () => openHabitModal(),
    resetData: () => {
        closeAllMenus();
        openResetModal();
    },
    // from the first-run screen: nothing to lose, so no confirmation
    loadSampleData: () => loadSampleData('נתוני הדוגמה נטענו'),
    exportBackup: () => exportBackup(),
    importBackup: () => importBackup(),
    toggleSelectMode: () => toggleManageSelectMode(),
    openCategories: () => openCategoryManagerModal(),
    selectAllHabits: () => toggleSelectAllManageHabits(),
    bulkArchive: () => bulkArchiveSelectedHabits(),
    bulkDelete: () => bulkDeleteSelectedHabits(),
    exitSelectMode: () => exitManageSelectMode(),
    // only a click on the dimmed area itself, not one that bubbled up from the panel
    backdropClose: (el, e) => {
        if (e.target === el && MODAL_CLOSERS[el.id]) MODAL_CLOSERS[el.id]();
    },
    backdropNudge: (el, e) => {
        if (e.target === el) nudgeModal(el);
    },
    closeHabitModal: () => closeHabitModal(),
    toggleHabitSection: el => toggleHabitSection(el.dataset.arg),
    setGoalType: el => setModalGoalType(el.dataset.arg),
    copyDayTimes: () => copyDayTimesToAll(),
    setScheduleScope: el => setScheduleScope(el.dataset.arg),
    saveHabit: () => saveHabitForm({ preventDefault() {} }),
    closeCategories: () => closeCategoryManagerModal(),
    addCategory: () => handleModalAddCategory({ preventDefault() {} }),
    selectAllCategories: () => toggleSelectAllCategories(),
    toggleCategorySelect: () => toggleCategorySelectMode(),
    bulkDeleteCategories: () => bulkDeleteSelectedCategories(),
    closeCalendar: () => closeFullCalendarModal(),
    shiftCalendar: el => shiftCalendarMonth(Number(el.dataset.arg)),
    toggleYearView: () => toggleCalendarYearView(),
    calendarToday: () => jumpCalendarToCurrentMonth(),
    closeConfirm: () => closeConfirmModal(),
    confirmAccept: () => runConfirm('onConfirm'),
    confirmAlt: () => runConfirm('onAlt'),
    undo: () => triggerToastUndo(),
    toggleCategorySelected: el => toggleCategorySelected(el.dataset.catSelect),
    saveCategoryRename: el => saveCategoryRename(el.dataset.cat),
    cancelCategoryRename: () => cancelCategoryRename(),
    startCategoryRename: el => startCategoryRename(el.dataset.cat),
    deleteCategory: el => promptDeleteCategory(el.dataset.cat),
    openMonthFromYear: el => openCalendarMonthFromYear(Number(el.dataset.arg)),
    calendarDay: el => handleCalendarDayClick(el.dataset.calKey),
    selectDay: el => selectDay(el.dataset.key),
    setPreset: el => setAnalyticsPreset(el.dataset.arg),
    barSelectDay: el => selectDateFromCalendar(el.dataset.key),
    setCategoryFilter: el => setCategoryFilter(el.dataset.cat, el.dataset.ctx),
    // the card body toggles too, except where a button inside it was the target
    toggleCardBody: (el, e) => {
        if (!e.target.closest('button')) toggleHabitDay(el.dataset.id, el.dataset.key, slotOf(el));
    },
    toggleDay: el => toggleHabitDay(el.dataset.id, el.dataset.key, slotOf(el)),
    toggleRestGroup: () => toggleUnscheduledGroup(),
    manageCard: el => handleManageCardClick(el.dataset.id),
    menuEdit: el => {
        closeAllMenus();
        openHabitModal(el.dataset.id);
    },
    menuArchive: el => {
        closeAllMenus();
        archiveHabitById(el.dataset.id);
    },
    menuDelete: el => {
        closeAllMenus();
        promptDeleteHabitById(el.dataset.id);
    },
    pickTimeDay: el => pickTimeDay(Number(el.dataset.arg)),
    pickTimeSlot: el => pickTimeSlot(Number(el.dataset.arg)),
    toggleFixedDay: el => toggleModalFixedDay(Number(el.dataset.arg)),
    selectIcon: el => selectModalIcon(el.textContent.trim()),
    toggleCustomIcons: () => toggleCustomIconPanel(),
    selectColor: el => selectModalColor(el.dataset.arg),
    restoreHabit: el => restoreHabitById(el.dataset.id),
    deleteHabit: el => promptDeleteHabitById(el.dataset.id),
    toggleArchive: () => toggleArchiveSection()
};
