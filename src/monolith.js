// Temporary: the original app script, moved here unchanged (minus the IIFE wrapper, which a
// module scope makes redundant). It is split into modules step by step; see docs/REFACTOR_PLAN.md.

import { suspendAudio } from './audio/feedback.js';
import { getDateKeyDaysAgo } from './core/dates.js';
import { habitOn, hasAnyTime } from './core/schedule.js';
import { app } from './state/app.js';
import { manage } from './state/manage.js';
import { tracker } from './state/tracker.js';
import { Store } from './store/store.js';
import { enhanceFormControls } from './ui/app/form-controls.js';
import { checkDayRollover, loadState } from './ui/app/lifecycle.js';
import { switchMainSection } from './ui/app/navigation.js';
import { prerenderHiddenSections } from './ui/app/render.js';
import { triggerToastUndo } from './ui/app/undo.js';
import { closeCustomSelect, isCustomSelectOpen, wireCustomSelectDismiss } from './ui/components/custom-select.js';
import { closeAllMenus, toggleMenu, wireMenus } from './ui/components/menus.js';
import { getVisibleFocusables, hideModal, nudgeModal, topModal } from './ui/components/modal.js';
import { scheduleScrollFades, updateScrollFades } from './ui/components/scroll-fades.js';
import { initSegPills } from './ui/components/segmented.js';
import { wireToastPause } from './ui/components/toast.js';
import { initTooltips } from './ui/components/tooltip.js';
import {
    closeFullCalendarModal,
    handleCalendarDayClick,
    jumpCalendarToCurrentMonth,
    openCalendarMonthFromYear,
    openFullCalendarModal,
    selectDateFromCalendar,
    shiftCalendarMonth,
    toggleCalendarYearView,
    wireRangePreview
} from './ui/dialogs/calendar/calendar.js';
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
} from './ui/dialogs/category-manager/actions.js';
import { closeConfirmModal, runConfirm } from './ui/dialogs/confirm.js';
import {
    handleCustomIconInput,
    selectModalColor,
    selectModalIcon,
    toggleCustomIconPanel
} from './ui/dialogs/habit-form/appearance.js';
import {
    syncHabitTimeFields,
    togglePerDayTimes,
    updateHabitSaveState
} from './ui/dialogs/habit-form/form-controller.js';
import { setModalGoalType, toggleModalFixedDay } from './ui/dialogs/habit-form/goal-type.js';
import {
    closeHabitModal,
    handleHabitFormEnter,
    openHabitModal,
    saveHabitForm
} from './ui/dialogs/habit-form/habit-form.js';
import { setScheduleScope } from './ui/dialogs/habit-form/schedule-scope.js';
import { toggleHabitSection } from './ui/dialogs/habit-form/sections.js';
import {
    copyDayTimesToAll,
    onTimeEditorChange,
    pickTimeDay,
    pickTimeSlot,
    setModalTimesPerDay
} from './ui/dialogs/habit-form/time-editor.js';
import {
    applyCustomAnalyticsRange,
    setAnalyticsFilter,
    setAnalyticsPreset,
    shiftAnalyticsRange
} from './ui/sections/analytics/actions.js';
import { renderAnalytics } from './ui/sections/analytics/analytics.js';
import { positionAvgLine } from './ui/sections/analytics/bar-chart.js';
import { setCategoryFilter } from './ui/sections/filters.js';
import {
    archiveHabitById,
    bulkArchiveSelectedHabits,
    bulkDeleteSelectedHabits,
    exitManageSelectMode,
    handleManageCardClick,
    openResetModal,
    promptDeleteHabitById,
    restoreHabitById,
    toggleArchiveSection,
    toggleManageSelectMode,
    toggleSelectAllManageHabits
} from './ui/sections/manage/actions.js';
import { wireHabitDrag } from './ui/sections/manage/drag-drop.js';
import {
    clearAllForSelectedDay,
    jumpToToday,
    markAllForSelectedDay,
    selectDay,
    setViewMode,
    shiftWeek,
    toggleHabitDay,
    toggleUnscheduledGroup
} from './ui/sections/tracker/actions.js';
import { renderHabitsList } from './ui/sections/tracker/habits-list.js';
import { toggleSound } from './ui/shell/sound.js';
import { initDeviceTheme, toggleTheme, wireSystemTheme } from './ui/shell/theme.js';

initDeviceTheme();

initSegPills();

const MODAL_CLOSERS = {
    habitModalBackdrop: () => closeHabitModal(),
    categoryModalBackdrop: () => closeCategoryManagerModal(),
    fullCalendarModalBackdrop: () => closeFullCalendarModal(),
    confirmModalBackdrop: () => closeConfirmModal()
};

export function wireModalKeyboard() {
    document.addEventListener('keydown', e => {
        const top = topModal();
        if (!top || manage.drag.active) return;
        if (e.key === 'Escape') {
            if (isCustomSelectOpen() || document.querySelector('[data-menu-panel]:not(.hidden):not(.is-closing)'))
                return; // the open list closes first
            e.preventDefault();
            (MODAL_CLOSERS[top.id] || (() => hideModal(top)))();
        } else if (e.key === 'Tab') {
            const items = getVisibleFocusables(top);
            if (items.length === 0) return;
            const first = items[0],
                last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || !top.contains(document.activeElement))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !top.contains(document.activeElement))) {
                e.preventDefault();
                first.focus();
            }
        }
    });
}
wireModalKeyboard();

wireRangePreview();

let lineChartResizeTimer = null;
let resizeFrame = 0;
export function wireResize() {
    window.addEventListener('resize', () => {
        if (!resizeFrame) {
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = 0;
                closeCustomSelect(false);
                updateScrollFades();
                positionAvgLine();
            });
        }
        clearTimeout(lineChartResizeTimer);
        lineChartResizeTimer = setTimeout(() => {
            if (
                app.currentMainSection === 'analytics' &&
                (!document.getElementById('lineChartWrap').classList.contains('hidden') ||
                    !document.getElementById('habitGridWrap').classList.contains('hidden'))
            )
                renderAnalytics();
        }, 150);
    });
}
wireResize();

initTooltips();

wireMenus();

wireHabitDrag();

wireToastPause();

wireSystemTheme();

wireCustomSelectDismiss();

// ===================================================================
// Events: no inline handlers. Markup names what should happen —
// data-action (click), data-change, data-input, data-keydown, data-submit —
// with its arguments in data-id / data-key / data-arg / data-cat / data-ctx / data-slot.
// One delegated listener per event type on <body> looks the name up in these tables.
// ===================================================================
const slotOf = el => (el.dataset.slot !== undefined ? Number(el.dataset.slot) : undefined);

const ClickActions = {
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

const ChangeActions = {
    analyticsFilter: el => setAnalyticsFilter(el.value),
    customRange: () => applyCustomAnalyticsRange(),
    habitFormChanged: () => updateHabitSaveState(),
    timesPerDay: el => setModalTimesPerDay(Number(el.value)),
    perDayTimes: el => togglePerDayTimes(el.checked),
    timeEditor: () => onTimeEditorChange(),
    syncTimeFields: () => syncHabitTimeFields()
};

const InputActions = {
    habitFormChanged: () => updateHabitSaveState(),
    customIcon: el => handleCustomIconInput(el)
};

const KeyActions = {
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

const SubmitActions = {
    saveHabit: (el, e) => saveHabitForm(e),
    addCategory: (el, e) => handleModalAddCategory(e)
};

// change / input / keydown / submit: every named element on the path runs, innermost first
// (the same order handlers on those elements had)
function runAlongPath(e, attr, table) {
    for (let el = e.target; el && el.nodeType === 1; el = el.parentElement) {
        const name = el.getAttribute(attr);
        if (name && table[name]) table[name](el, e);
    }
}

// click: the innermost element with an action handles it. An ancestor marked
// data-stop-propagation (an open menu panel) keeps the click from outer actions and
// from the document-level "close menus" listeners.
export function wireDelegatedEvents() {
    document.body.addEventListener('click', e => {
        let handled = false;
        for (let el = e.target; el && el !== document.body && el.nodeType === 1; el = el.parentElement) {
            if (el.hasAttribute('data-stop-propagation')) {
                e.stopPropagation();
                return;
            }
            if (!handled && el.dataset.action) {
                handled = true;
                const fn = ClickActions[el.dataset.action];
                if (fn && !el.disabled) fn(el, e);
            }
        }
    });
    document.body.addEventListener('change', e => runAlongPath(e, 'data-change', ChangeActions));
    document.body.addEventListener('input', e => runAlongPath(e, 'data-input', InputActions));
    document.body.addEventListener('submit', e => runAlongPath(e, 'data-submit', SubmitActions));
    document.body.addEventListener('keydown', e => {
        runAlongPath(e, 'data-keydown', KeyActions);
        // role="button" elements: Enter / Space act like a click on the element itself
        const el = e.target;
        if ((e.key === 'Enter' || e.key === ' ') && el.nodeType === 1 && el.hasAttribute('data-key-activate')) {
            const fn = ClickActions[el.dataset.action];
            if (!fn) return;
            e.preventDefault();
            fn(el, e);
        }
    });
}
wireDelegatedEvents();

// Keeps now / next / past current: refresh the daily list once a minute while it is on screen
export function startMinuteRefresh() {
    setInterval(() => {
        if (document.hidden) return;
        if (app.currentMainSection !== 'tracker' || tracker.viewMode !== 'focus') return;
        if (tracker.selectedDateKey !== getDateKeyDaysAgo(0)) return;
        const modal = document.getElementById('habitModalBackdrop');
        if (modal && !modal.classList.contains('hidden')) return;
        if (!Store.habits.some(h => hasAnyTime(habitOn(h, tracker.selectedDateKey)))) return;
        renderHabitsList();
    }, 60000);
}
startMinuteRefresh();

window.addEventListener('DOMContentLoaded', () => {
    enhanceFormControls();
    loadState();
    switchMainSection(app.currentMainSection);
    prerenderHiddenSections();

    document.querySelectorAll('.scroll-fade-x').forEach(el => {
        el.addEventListener('scroll', scheduleScrollFades, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkDayRollover();
        } else {
            suspendAudio();
        }
    });
    setInterval(checkDayRollover, 60000);

    const skeleton = document.getElementById('appSkeleton');
    const startedAt = performance.now();
    (function waitForStyles() {
        const nav = document.getElementById('dateNavigator');
        const styled = nav && getComputedStyle(nav).borderTopLeftRadius !== '0px';
        if (styled || performance.now() - startedAt > 2500) {
            skeleton.classList.add('is-done');
            setTimeout(() => skeleton.remove(), 250);
        } else {
            requestAnimationFrame(waitForStyles);
        }
    })();
});
