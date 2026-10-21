// Temporary: the original app script, moved here unchanged (minus the IIFE wrapper, which a
// module scope makes redundant). It is split into modules step by step; see docs/REFACTOR_PLAN.md.
/* eslint-disable no-unused-vars -- dead locals are removed when each area is extracted */

import { playFeedbackSound, suspendAudio } from './audio/feedback.js';
import { MAX_RANGE_DAYS } from './config/analytics.js';
import { UNCATEGORIZED_LABEL } from './config/categories.js';
import { COLOR_OPTIONS } from './config/colors.js';
import { HEBREW_DAYS_FULL, HEBREW_DAYS_SHORT, HEBREW_MONTHS_FULL } from './config/hebrew.js';
import { ICON_OPTIONS, MORE_ICONS } from './config/icons.js';
import { MAX_SLOTS } from './config/schedule.js';
import { getPresetRange } from './core/analytics-range.js';
import {
    addDaysToKey,
    dayNumOf,
    dayObjForKey,
    daysBetweenKeys,
    dowOfDayNum,
    formatDateKey,
    getDateKeyDaysAgo,
    isFutureDateKey,
    isValidDateKey,
    parseDateKeyLocal,
    todayDayNum
} from './core/dates.js';
import {
    describeScheduleVersion,
    formatDateCompactLabel,
    formatDateTriggerLabel,
    formatDaySet,
    formatStartDateLabel,
    habitCountLabel,
    scheduleTimeSummary
} from './core/format.js';
import {
    getEarliestCheckedKey,
    getHabitCategoryDisplay,
    hasAnyMarkOnDay,
    isHabitActiveOnKey,
    isHabitArchived
} from './core/habit.js';
import {
    getScheduleVersion,
    habitOn,
    hasAnyTime,
    isHabitScheduledOnKey,
    normalizeScheduleFields,
    sameScheduleFields,
    scheduleWeekdays,
    slotCount
} from './core/schedule.js';
import { getGraphemes } from './core/text.js';
import { dayPartOf, timeRangeText } from './core/time.js';
import { analytics, ensureAnalyticsRange, restoreAnalyticsRange } from './state/analytics.js';
import { app } from './state/app.js';
import { calendar } from './state/calendar.js';
import { categoryManager } from './state/categories.js';
import { habitForm } from './state/habit-form.js';
import { manage } from './state/manage.js';
import { motion } from './state/motion.js';
import { currentPrefs, savePrefs } from './state/prefs.js';
import { setWeek, tracker } from './state/tracker.js';
import { createUndoSnapshot, undo } from './state/undo.js';
import { getDefaultHabits } from './store/sample-habits.js';
import { findTimeOverlaps, getDayStats } from './store/selectors.js';
import { Store } from './store/store.js';
import { switchMainSection } from './ui/app/navigation.js';
import { prerenderHiddenSections, renderAll } from './ui/app/render.js';
import {
    closeCustomSelect,
    enhanceSelect,
    fireChange,
    isCustomSelectOpen,
    relabel,
    watchValue,
    wireCustomSelectDismiss
} from './ui/components/custom-select.js';
import { closeAllMenus, toggleMenu, wireMenus } from './ui/components/menus.js';
import { getVisibleFocusables, hideModal, nudgeModal, showModal, topModal } from './ui/components/modal.js';
import { setRevealOpen } from './ui/components/reveal.js';
import { scheduleScrollFades, updateScrollFades } from './ui/components/scroll-fades.js';
import { initSegPills, updateSegPill } from './ui/components/segmented.js';
import { showToast, wireToastPause } from './ui/components/toast.js';
import { initTooltips } from './ui/components/tooltip.js';
import { prefersReducedMotion, restartAnimationClass, restartAnimationClasses, shakeField } from './ui/dom/animate.js';
import { animateOut, flashHabits, withFlip } from './ui/dom/flip.js';
import { escapeHtml } from './ui/dom/html.js';
import { CALENDAR_SVG, icon } from './ui/dom/icons.js';
import { patchHTML } from './ui/dom/patch.js';
import { renderAnalytics } from './ui/sections/analytics/analytics.js';
import { positionAvgLine } from './ui/sections/analytics/bar-chart.js';
import { renderLeaderboard } from './ui/sections/analytics/leaderboard.js';
import { renderCategoryFilterBar } from './ui/sections/category-filter-bar.js';
import { renderArchiveSection } from './ui/sections/manage/archive.js';
import { renderManageSection } from './ui/sections/manage/manage-grid.js';
import { renderHabitsList } from './ui/sections/tracker/habits-list.js';
import { renderTrackerSummary } from './ui/sections/tracker/summary.js';
import { applyViewModeButtonsUI } from './ui/sections/tracker/view-mode.js';
import { getTrackerVisibleHabits } from './ui/sections/tracker/visible-habits.js';
import { applySoundUI, toggleSound } from './ui/shell/sound.js';
import { applyThemeUI, initDeviceTheme, toggleTheme, wireSystemTheme } from './ui/shell/theme.js';

initDeviceTheme();

initSegPills();

// Storage can be full or blocked (private mode, quota). The data stays in memory for this
// session, and the warning is shown after the action's own message so it isn't overwritten.
function handlePersistError(kind) {
    queueMicrotask(() =>
        showToast(
            kind === 'quota'
                ? 'האחסון בדפדפן מלא — השינויים נשמרים רק עד לסגירת הדף'
                : 'לא ניתן לשמור בדפדפן הזה — השינויים נשמרים רק עד לסגירת הדף'
        )
    );
}

function loadState() {
    Store.configure({ prefsProvider: currentPrefs, onPersistError: handlePersistError });
    const prefs = Store.loadPrefs();
    if (prefs) {
        if (typeof prefs.isDarkMode === 'boolean') {
            app.isDarkMode = prefs.isDarkMode;
            app.themeChosenByUser = true;
        }
        if (typeof prefs.soundEnabled === 'boolean') app.soundEnabled = prefs.soundEnabled;
        if (prefs.currentViewMode === 'focus' || prefs.currentViewMode === 'grid') {
            tracker.viewMode = prefs.currentViewMode;
        }
        if (['tracker', 'analytics', 'manage'].includes(prefs.currentMainSection)) {
            app.currentMainSection = prefs.currentMainSection;
        }
        restoreAnalyticsRange(prefs.analyticsRange);
        if (typeof prefs.analyticsFilter === 'string') analytics.filter = prefs.analyticsFilter;
    }

    // Always open on Today (reset weekOffset & selectedDateKey, and reset filters to 'הכל')
    setWeek(0);
    tracker.selectedDateKey = getDateKeyDaysAgo(0);
    tracker.lastKnownTodayKey = tracker.selectedDateKey;
    tracker.selectedCategory = 'הכל';
    manage.selectedCategory = 'הכל';

    ensureAnalyticsRange(); // concrete dates from the start, even before analytics is first drawn

    applyThemeUI(app.isDarkMode);
    applySoundUI(app.soundEnabled);
    applyViewModeButtonsUI(tracker.viewMode);

    Store.load(getDefaultHabits);
}

function triggerToastUndo() {
    if (!undo.snapshot) return;
    const snap = undo.snapshot;
    undo.snapshot = null;
    tracker.selectedCategory = snap.trackerSelectedCategory || 'הכל';
    manage.selectedCategory = snap.manageSelectedCategory || 'הכל';
    Store.restore(snap.data);
    populateCategorySelectDropdown();
    withFlip(() => renderAll());
    renderCategoryManagerItems();
    showToast('הפעולה בוטלה והמצב הקודם שוחזר');
}

function checkDayRollover() {
    const nowTodayKey = getDateKeyDaysAgo(0);
    if (nowTodayKey !== tracker.lastKnownTodayKey) {
        tracker.lastKnownTodayKey = nowTodayKey;
        setWeek(0);
        tracker.selectedDateKey = nowTodayKey;
        Store.stripFuture(nowTodayKey);
        renderAll();
    }
}

function populateCategorySelectDropdown(selectedValue = null) {
    const selectEl = document.getElementById('habitCategoryInput');
    if (!selectEl) return;
    const currentVal = selectedValue !== null ? selectedValue : (selectEl.value ?? '');
    const optionsHtml = [
        `<option value="">${UNCATEGORIZED_LABEL}</option>`,
        ...Store.categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
    ].join('');
    selectEl.innerHTML = optionsHtml;
    if (currentVal && Store.categories.includes(currentVal)) {
        selectEl.value = currentVal;
    } else {
        selectEl.value = '';
    }
}

function addCategory(rawName) {
    const name = String(rawName || '').trim();
    if (!name) return false;
    if (name === 'הכל' || name === UNCATEGORIZED_LABEL) {
        showToast(`השם "${name}" שמור למערכת`);
        return false;
    }
    if (Store.categories.includes(name)) {
        showToast('קטגוריה בשם זה כבר קיימת');
        return false;
    }
    Store.addCategory(name);
    populateCategorySelectDropdown(name);
    renderAll();
    renderCategoryManagerItems();
    showToast(`הקטגוריה "${name}" נוספה בהצלחה!`);
    return true;
}

function handleModalAddCategory(event) {
    event.preventDefault();
    const input = document.getElementById('modalNewCategoryInput');
    if (!input) return;
    if (addCategory(input.value)) {
        input.value = '';
    } else {
        shakeField(input, !!input.value.trim());
    }
}

function startCategoryRename(catName) {
    categoryManager.editingName = catName;
    renderManageSection();
    renderCategoryManagerItems();
    setTimeout(() => {
        const input = document.getElementById('activeCategoryRenameInput');
        if (input) {
            input.focus();
            input.select();
        }
    }, 30);
}

function cancelCategoryRename() {
    categoryManager.editingName = null;
    renderManageSection();
    renderCategoryManagerItems();
}

function saveCategoryRename(oldName) {
    const input = document.getElementById('activeCategoryRenameInput');
    if (!input) return;
    const newName = input.value.trim();
    if (!newName || newName === oldName) {
        cancelCategoryRename();
        return;
    }
    if (newName === 'הכל' || newName === UNCATEGORIZED_LABEL) {
        showToast(`השם "${newName}" שמור למערכת`);
        shakeField(input);
        return;
    }
    if (Store.categories.includes(newName)) {
        showToast('קטגוריה בשם זה כבר קיימת');
        shakeField(input);
        return;
    }

    if (tracker.selectedCategory === oldName) {
        tracker.selectedCategory = newName;
    }
    if (manage.selectedCategory === oldName) {
        manage.selectedCategory = newName;
    }
    categoryManager.editingName = null;
    Store.renameCategory(oldName, newName);
    populateCategorySelectDropdown(newName);
    renderAll();
    renderCategoryManagerItems();
    showToast(`שם הקטגוריה עודכן ל-"${newName}"`);
}

function promptDeleteCategory(catName) {
    const affectedHabits = Store.habits.filter(h => (h.category || '').trim() === catName);

    const msg =
        affectedHabits.length > 0
            ? `לקטגוריה "${catName}" משויכים ${affectedHabits.length} הרגלים. מחיקתה תגדיר אותם כחסרי קטגוריה ("${UNCATEGORIZED_LABEL}"). האם להמשיך?`
            : `האם למחוק את הקטגוריה "${catName}" מהמערכת?`;

    openConfirmModal('מחיקת קטגוריה?', msg, () => {
        const snapshot = createUndoSnapshot();
        if (tracker.selectedCategory === catName) {
            tracker.selectedCategory = 'הכל';
        }
        if (manage.selectedCategory === catName) {
            manage.selectedCategory = 'הכל';
        }
        categoryManager.editingName = null;
        Store.deleteCategories([catName]);
        populateCategorySelectDropdown();
        renderAll();
        renderCategoryManagerItems();
        showToast(`הקטגוריה "${catName}" נמחקה`, snapshot);
    });
}

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

function openCategoryManagerModal() {
    categoryManager.editingName = null;
    categoryManager.selectMode = false;
    categoryManager.selected.clear();
    renderCategoryManagerItems();
    showModal(document.getElementById('categoryModalBackdrop'));
}

function closeCategoryManagerModal() {
    categoryManager.editingName = null;
    categoryManager.selectMode = false;
    categoryManager.selected.clear();
    hideModal(document.getElementById('categoryModalBackdrop'));
    renderAll();
}

function buildCategoryItemRowHtml(cat) {
    const count = Store.habits.filter(h => h.category === cat).length;
    const isEditing = categoryManager.editingName === cat;

    if (categoryManager.selectMode) {
        const sel = categoryManager.selected.has(cat);
        return `
            <button type="button" data-cat-select="${escapeHtml(cat)}" data-action="toggleCategorySelected" aria-pressed="${sel}" class="w-full text-right p-3 rounded-xl border flex items-center gap-3 transition ${
                sel
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-700'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-800'
            }">
                <span class="shrink-0 w-5 h-5 rounded-lg border-2 flex items-center justify-center ${sel ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}" aria-hidden="true">${sel ? '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}</span>
                <span class="flex-1 min-w-0 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(cat)}</span>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">${count} הרגלים</span>
            </button>
        `;
    }

    if (isEditing) {
        return `
            <div class="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700 flex items-center gap-2">
                <input id="activeCategoryRenameInput" type="text" maxlength="25" value="${escapeHtml(cat)}" data-keydown="categoryRename" data-cat="${escapeHtml(cat)}" class="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-base sm:text-xs font-bold focus:outline-none">
                <button type="button" data-action="saveCategoryRename" data-cat="${escapeHtml(cat)}" class="tap-44 h-10 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">שמור</button>
                <button type="button" data-action="cancelCategoryRename" class="tap-44 h-10 px-3 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold">ביטול</button>
            </div>
        `;
    }

    return `
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
                <span class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(cat)}</span>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">${count} הרגלים</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" data-action="startCategoryRename" data-cat="${escapeHtml(cat)}" title="עריכת שם הקטגוריה" aria-label="עריכת הקטגוריה ${escapeHtml(cat)}" class="tap-44 w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                <button type="button" data-action="deleteCategory" data-cat="${escapeHtml(cat)}" title="מחיקת הקטגוריה" aria-label="מחיקת הקטגוריה ${escapeHtml(cat)}" class="tap-44 w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
            </div>
        </div>
    `;
}

function renderCategoryManagerItems() {
    const listEl = document.getElementById('modalCategoriesList');
    if (!listEl) return;
    categoryManager.selected.forEach(c => {
        if (!Store.categories.includes(c)) categoryManager.selected.delete(c);
    });
    updateCategorySelectUi();
    if (Store.categories.length === 0) {
        patchHTML(
            listEl,
            `<p class="text-xs text-slate-500 dark:text-slate-400 text-center py-6">אין קטגוריות מוגדרות כרגע. כל ההרגלים משויכים ל"${UNCATEGORIZED_LABEL}".</p>`
        );
        return;
    }
    patchHTML(listEl, Store.categories.map(cat => buildCategoryItemRowHtml(cat)).join(''));
}

function selectDay(dateKey, jumpToTracker = false) {
    if (isFutureDateKey(dateKey)) {
        showToast('לא ניתן לבחור תאריך שעוד לא הגיע');
        return;
    }
    tracker.selectedDateKey = dateKey;
    if (jumpToTracker && app.currentMainSection !== 'tracker') {
        switchMainSection('tracker');
        showToast('עברתם לסימון הרגלים עבור היום שנבחר');
        return;
    }
    renderAll();
}

function setViewMode(mode) {
    tracker.viewMode = mode;
    applyViewModeButtonsUI(mode);
    savePrefs();
    renderHabitsList();
}

function shiftWeek(delta) {
    const nextOffset = tracker.weekOffset + delta;
    if (nextOffset > 0) return;
    motion.pendingWeekSlide = delta < 0 ? 'prev' : 'next';
    setWeek(nextOffset);
    const todayMatch = tracker.weekDays.find(d => d.isToday);
    tracker.selectedDateKey = todayMatch ? todayMatch.key : tracker.weekDays[0].key;
    renderAll();
}

function jumpToToday() {
    if (tracker.weekOffset < 0) motion.pendingWeekSlide = 'next';
    setWeek(0);
    tracker.selectedDateKey = getDateKeyDaysAgo(0);
    renderAll();
    showToast('חזרתם לשבוע הנוכחי (היום)');
}

function openFullCalendarModal() {
    calendar.picker = null;
    applyCalendarModeChrome();
    const parts = tracker.selectedDateKey.split('-').map(Number);
    if (parts.length === 3) {
        calendar.viewYear = parts[0];
        calendar.viewMonth = parts[1] - 1;
    } else {
        const now = new Date();
        calendar.viewYear = now.getFullYear();
        calendar.viewMonth = now.getMonth();
    }
    calendar.viewMode = 'month';
    renderFullCalendarGrid();
    showModal(document.getElementById('fullCalendarModalBackdrop'));
}

function closeFullCalendarModal() {
    hideModal(document.getElementById('fullCalendarModalBackdrop'));
    if (calendar.picker) {
        calendar.picker = null;
        // keep the picker header until the closing animation ends, so it doesn't swap mid-fade
        setTimeout(() => {
            if (!calendar.picker) applyCalendarModeChrome();
        }, 200);
    }
}

const calendarChromeDefaults = {};

function calendarMaxKey() {
    return calendar.picker ? calendar.picker.max || null : getDateKeyDaysAgo(0);
}
function calendarMinKey() {
    return calendar.picker ? calendar.picker.min || null : null;
}
function isCalendarKeyAllowed(key) {
    const max = calendarMaxKey(),
        min = calendarMinKey();
    return (!max || key <= max) && (!min || key >= min);
}

function applyCalendarModeChrome() {
    const title = document.getElementById('calendarTitleText');
    const sub = document.getElementById('calendarSubtitleText');
    const footer = document.getElementById('calendarFooter');
    const panel = document.querySelector('#fullCalendarModalBackdrop > div');
    if (!('title' in calendarChromeDefaults)) {
        calendarChromeDefaults.title = title.innerHTML;
        calendarChromeDefaults.sub = sub.innerHTML;
    }
    if (calendar.picker && calendar.picker.range) {
        const a = calendar.picker.anchor;
        title.textContent = a ? 'בחרו תאריך סיום' : 'בחרו תאריך התחלה';
        sub.textContent = a
            ? `מ-${formatDateTriggerLabel(a)} · הקישו על היום האחרון בטווח (יום מוקדם יותר יהפוך להתחלה)`
            : 'הקישו על היום הראשון בטווח, ואחר כך על היום האחרון';
        footer.classList.add('hidden');
    } else if (calendar.picker) {
        title.textContent = calendar.picker.title || 'בחירת תאריך';
        sub.textContent = 'הקישו על יום כדי לבחור אותו';
        footer.classList.add('hidden');
    } else {
        title.innerHTML = calendarChromeDefaults.title;
        sub.innerHTML = calendarChromeDefaults.sub;
        footer.classList.remove('hidden');
    }
}

function openDatePicker(opts) {
    calendar.picker = { ...opts, returnFocus: document.activeElement };
    const base = isValidDateKey(opts.value)
        ? opts.value
        : opts.max && opts.max < getDateKeyDaysAgo(0)
          ? opts.max
          : getDateKeyDaysAgo(0);
    const [y, m] = base.split('-').map(Number);
    calendar.viewYear = y;
    calendar.viewMonth = m - 1;
    calendar.viewMode = 'month';
    applyCalendarModeChrome();
    renderFullCalendarGrid();
    showModal(document.getElementById('fullCalendarModalBackdrop'));
}

// Range mode: first tap sets the start, hovering previews the span, second tap sets the end.
function openRangePicker(opts) {
    calendar.picker = { ...opts, range: true, anchor: null, returnFocus: document.activeElement };
    const base = isValidDateKey(opts.focusKey)
        ? opts.focusKey
        : isValidDateKey(opts.end)
          ? opts.end
          : getDateKeyDaysAgo(0);
    const [y, m] = base.split('-').map(Number);
    calendar.viewYear = y;
    calendar.viewMonth = m - 1;
    calendar.viewMode = 'month';
    applyCalendarModeChrome();
    renderFullCalendarGrid();
    showModal(document.getElementById('fullCalendarModalBackdrop'));
}

function paintRangePreview(hoverKey) {
    const grid = document.getElementById('fullCalendarGrid');
    const p = calendar.picker;
    if (!grid || !p || !p.range || !p.anchor) return;
    const a = p.anchor;
    const active = hoverKey && hoverKey > a;
    grid.querySelectorAll('[data-cal-key]').forEach(btn => {
        const k = btn.dataset.calKey;
        btn.classList.toggle('cal-in-range', !!active && k > a && k < hoverKey);
        btn.classList.toggle('cal-range-end', !!active && k === hoverKey);
    });
}

export function wireRangePreview() {
    const grid = document.getElementById('fullCalendarGrid');
    if (!grid) return;
    const keyFrom = e => {
        const btn = e.target.closest && e.target.closest('[data-cal-key]');
        return btn && !btn.disabled ? btn.dataset.calKey : null;
    };
    grid.addEventListener('mouseover', e => paintRangePreview(keyFrom(e)));
    grid.addEventListener('focusin', e => paintRangePreview(keyFrom(e)));
    grid.addEventListener('mouseleave', () => paintRangePreview(null));
}
wireRangePreview();

function handleCalendarDayClick(dateKey) {
    if (calendar.picker && calendar.picker.range) {
        if (!isCalendarKeyAllowed(dateKey)) return;
        const p = calendar.picker;
        if (!p.anchor || dateKey < p.anchor) {
            // first tap — or a day before the current start, which becomes the new start
            p.anchor = dateKey;
            applyCalendarModeChrome();
            renderFullCalendarGrid();
            const btn = document.querySelector(`#fullCalendarGrid [data-cal-key="${dateKey}"]`);
            if (btn && document.activeElement && document.activeElement.closest('#fullCalendarGrid')) btn.focus();
            return;
        }
        const start = p.anchor,
            pick = p.onRangePick;
        closeFullCalendarModal();
        pick(start, dateKey);
        return;
    }
    if (calendar.picker) {
        if (!isCalendarKeyAllowed(dateKey)) return;
        const pick = calendar.picker.onPick;
        closeFullCalendarModal();
        pick(dateKey);
        return;
    }
    selectDateFromCalendar(dateKey);
}

function isCalendarViewAtCurrentMonth() {
    const max = calendarMaxKey();
    if (!max) return false;
    const [my, mm] = max.split('-').map(Number);
    return calendar.viewYear > my || (calendar.viewYear === my && calendar.viewMonth >= mm - 1);
}

function shiftCalendarMonth(delta) {
    motion.pendingCalSlide = delta < 0 ? 'prev' : 'next';
    if (calendar.viewMode === 'year') {
        if (delta > 0 && calendarMaxKey() && calendar.viewYear >= Number(calendarMaxKey().slice(0, 4))) return;
        calendar.viewYear += delta;
        renderFullCalendarGrid();
        return;
    }
    if (delta > 0 && isCalendarViewAtCurrentMonth()) return;
    calendar.viewMonth += delta;
    if (calendar.viewMonth > 11) {
        calendar.viewMonth = 0;
        calendar.viewYear++;
    } else if (calendar.viewMonth < 0) {
        calendar.viewMonth = 11;
        calendar.viewYear--;
    }
    renderFullCalendarGrid();
}

function toggleCalendarYearView() {
    motion.pendingCalSlide = calendar.viewMode === 'month' ? 'zoom-out' : 'zoom-in';
    if (calendar.viewMode === 'month') {
        calendar.viewMode = 'year';
    } else {
        // Back to month view; clamp to the current month if the shown year is the current one
        const max = calendarMaxKey();
        if (max) {
            const [my, mm] = max.split('-').map(Number);
            if (calendar.viewYear === my && calendar.viewMonth > mm - 1) calendar.viewMonth = mm - 1;
        }
        calendar.viewMode = 'month';
    }
    renderFullCalendarGrid();
}

function openCalendarMonthFromYear(monthIdx) {
    motion.pendingCalSlide = 'zoom-in';
    calendar.viewMonth = monthIdx;
    calendar.viewMode = 'month';
    renderFullCalendarGrid();
}

function renderCalendarYearView() {
    const yearGrid = document.getElementById('fullCalendarYearGrid');
    const summaryEl = document.getElementById('calendarMonthlySummaryText');
    if (!yearGrid) return;

    const now = new Date();
    const todayIso = getDateKeyDaysAgo(0);
    const weekdayLetters = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    let perfectDaysInYear = 0;
    let html = '';

    for (let m = 0; m < 12; m++) {
        const monthFirstKey = formatDateKey(new Date(calendar.viewYear, m, 1));
        const monthLastKey = formatDateKey(new Date(calendar.viewYear, m + 1, 0));
        const isFutureMonth =
            (calendarMaxKey() && monthFirstKey > calendarMaxKey()) ||
            (calendarMinKey() && monthLastKey < calendarMinKey());
        const isCurrentMonth = calendar.viewYear === now.getFullYear() && m === now.getMonth();
        const startWeekday = new Date(calendar.viewYear, m, 1).getDay();
        const daysInMonth = new Date(calendar.viewYear, m + 1, 0).getDate();

        let perfectInMonth = 0;
        let daysHtml = '';
        for (let i = 0; i < startWeekday; i++) daysHtml += '<span></span>';

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(calendar.viewYear, m, d);
            const dateKey = formatDateKey(dateObj);
            const isFuture = dateKey > todayIso;
            const isToday = dateKey === todayIso;
            let tone;
            if (isFuture) {
                tone = 'text-slate-300 dark:text-slate-700';
            } else {
                const stats = getDayStats({ key: dateKey, dateObj });
                if (stats.totalScheduled === 0) {
                    tone = 'text-slate-500 dark:text-slate-400';
                } else if (stats.allDone) {
                    perfectInMonth++;
                    tone = 'bg-emerald-700 text-white';
                } else if (stats.pct > 0) {
                    tone = 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/70 dark:text-indigo-200';
                } else {
                    tone = 'text-slate-700 dark:text-slate-300';
                }
            }
            daysHtml += `<span class="aspect-square flex items-center justify-center rounded-full text-xs font-semibold leading-none ${tone} ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-white dark:ring-offset-slate-900' : ''}">${d}</span>`;
        }
        perfectDaysInYear += perfectInMonth;

        html += `
            <button type="button" ${isFutureMonth ? 'disabled' : `data-action="openMonthFromYear" data-arg="${m}"`} data-current-month="${isCurrentMonth ? '1' : ''}" aria-label="${HEBREW_MONTHS_FULL[m]} ${calendar.viewYear}" class="flex flex-col justify-start text-right p-2.5 sm:p-3 rounded-xl border transition ${
                isFutureMonth
                    ? 'bg-slate-50/40 dark:bg-slate-900/30 border-dashed border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                    : isCurrentMonth
                      ? 'bg-white dark:bg-slate-900 border-indigo-400 dark:border-indigo-600 hover:shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 hover:shadow-md'
            }">
                <div class="flex items-center justify-between gap-1 mb-1.5">
                    <span class="text-sm sm:text-base font-bold ${isCurrentMonth ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-900 dark:text-white'}">${HEBREW_MONTHS_FULL[m]}</span>
                    ${perfectInMonth > 0 ? `<span class="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap" title="ימים מושלמים">${icon('star', 'w-3.5 h-3.5', 2)} ${perfectInMonth}</span>` : ''}
                </div>
                <div class="grid grid-cols-7 gap-0.5 text-center">
                    ${weekdayLetters.map(l => `<span class="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 pb-0.5">${l}</span>`).join('')}
                    ${daysHtml}
                </div>
            </button>
        `;
    }

    yearGrid.innerHTML = html;
    yearGrid.scrollTop = 0;
    const currentCard = yearGrid.querySelector('[data-current-month="1"]');
    if (currentCard) requestAnimationFrame(() => currentCard.scrollIntoView({ block: 'nearest' }));
    if (summaryEl) {
        summaryEl.textContent =
            calendar.viewYear > now.getFullYear()
                ? 'שנה עתידית'
                : `${perfectDaysInYear} ימים מושלמים ב-${calendar.viewYear}`;
    }
}

function jumpCalendarToCurrentMonth() {
    calendar.viewMode = 'month';
    const now = new Date();
    calendar.viewYear = now.getFullYear();
    calendar.viewMonth = now.getMonth();
    renderFullCalendarGrid();
}

function selectDateFromCalendar(dateKey) {
    if (isFutureDateKey(dateKey)) {
        showToast('לא ניתן לבחור תאריך שעוד לא הגיע');
        return;
    }
    const target = dayNumOf(dateKey);
    const t = todayDayNum();
    const diffDays = target - dowOfDayNum(target) - (t - dowOfDayNum(t));
    const newOffset = Math.min(0, Math.round(diffDays / 7));
    if (newOffset !== tracker.weekOffset) motion.pendingWeekSlide = newOffset < tracker.weekOffset ? 'prev' : 'next';
    setWeek(newOffset);
    tracker.selectedDateKey = dateKey;
    closeFullCalendarModal();
    if (app.currentMainSection !== 'tracker') {
        switchMainSection('tracker');
    } else {
        renderAll();
    }
}

function renderFullCalendarGrid() {
    const calSlide = motion.pendingCalSlide;
    motion.pendingCalSlide = null;
    const playCalSlide = () => {
        if (!calSlide) return;
        const target =
            calendar.viewMode === 'year'
                ? document.getElementById('fullCalendarYearGrid')
                : document.getElementById('fullCalendarGrid');
        const cls = { prev: 'slide-from-prev', next: 'slide-from-next', 'zoom-in': 'zoom-in', 'zoom-out': 'zoom-out' }[
            calSlide
        ];
        restartAnimationClasses([
            [target, cls],
            [document.getElementById('calendarMonthYearTitle'), 'fade-in-quick']
        ]);
    };
    const titleEl = document.getElementById('calendarMonthYearTitle');
    const gridEl = document.getElementById('fullCalendarGrid');
    const summaryEl = document.getElementById('calendarMonthlySummaryText');
    if (!titleEl || !gridEl) return;

    const isYear = calendar.viewMode === 'year';
    const yearGrid = document.getElementById('fullCalendarYearGrid');
    const weekdayHeader = document.getElementById('calendarWeekdayHeader');
    gridEl.classList.toggle('hidden', isYear);
    if (weekdayHeader) weekdayHeader.classList.toggle('hidden', isYear);
    if (yearGrid) yearGrid.classList.toggle('hidden', !isYear);

    const chevron = document.getElementById('calendarTitleChevron');
    if (chevron) chevron.classList.toggle('rotate-180', isYear);
    const titleBtn = document.getElementById('calendarTitleBtn');
    if (titleBtn) titleBtn.setAttribute('aria-label', isYear ? 'חזרה לתצוגה חודשית' : 'מעבר לתצוגה שנתית');

    const prevLabel = document.getElementById('calendarPrevLabel');
    const nextLabel = document.getElementById('calendarNextLabel');
    const prevBtn = document.getElementById('calendarPrevBtn');
    const nextBtn = document.getElementById('calendarNextMonthBtn');
    if (prevLabel) prevLabel.textContent = isYear ? 'שנה קודמת' : 'חודש קודם';
    if (nextLabel) nextLabel.textContent = isYear ? 'שנה הבאה' : 'חודש הבא';
    if (prevBtn) prevBtn.setAttribute('aria-label', isYear ? 'שנה קודמת' : 'חודש קודם');
    if (nextBtn) nextBtn.setAttribute('aria-label', isYear ? 'שנה הבאה' : 'חודש הבא');

    if (isYear) {
        titleEl.textContent = `${calendar.viewYear}`;
        if (nextBtn) nextBtn.disabled = !!calendarMaxKey() && calendar.viewYear >= Number(calendarMaxKey().slice(0, 4));
        renderCalendarYearView();
        playCalSlide();
        return;
    }

    titleEl.textContent = `${HEBREW_MONTHS_FULL[calendar.viewMonth]} ${calendar.viewYear}`;
    if (nextBtn) nextBtn.disabled = isCalendarViewAtCurrentMonth();

    const firstDay = new Date(calendar.viewYear, calendar.viewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(calendar.viewYear, calendar.viewMonth + 1, 0).getDate();
    const todayIso = getDateKeyDaysAgo(0);

    let cellsHtml = '';
    for (let i = 0; i < startWeekday; i++) {
        cellsHtml += `<div class="h-16 sm:h-20 rounded-xl bg-slate-50/40 dark:bg-slate-800/20 border border-transparent"></div>`;
    }

    let perfectDaysInMonth = 0;
    let elapsedDaysInMonth = 0;

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dateObj = new Date(calendar.viewYear, calendar.viewMonth, dayNum);
        const dateKey = formatDateKey(dateObj);
        const isToday = dateKey === todayIso;
        const rp = calendar.picker && calendar.picker.range ? calendar.picker : null;
        const isSelected = rp
            ? rp.anchor
                ? dateKey === rp.anchor
                : dateKey === rp.start || dateKey === rp.end
            : dateKey === (calendar.picker ? calendar.picker.value : tracker.selectedDateKey);
        const isInRange = !!rp && !rp.anchor && !!rp.start && !!rp.end && dateKey > rp.start && dateKey < rp.end;
        const isFuture = !isCalendarKeyAllowed(dateKey);

        const stats = getDayStats({ key: dateKey, dateObj });
        const isRestDay = stats.totalScheduled === 0;
        if (!isFuture && !isRestDay) {
            elapsedDaysInMonth++;
            if (stats.allDone) perfectDaysInMonth++;
        }

        cellsHtml += `
            <button type="button" data-cal-key="${dateKey}" ${isFuture ? 'disabled' : `data-action="calendarDay"`} aria-pressed="${isSelected ? 'true' : 'false'}" ${isToday ? 'aria-current="date"' : ''} aria-label="${HEBREW_DAYS_FULL[dateObj.getDay()]}, ${dayNum} ב${HEBREW_MONTHS_FULL[calendar.viewMonth]}${isFuture ? ', לא זמין' : isRestDay ? ', אין יעדים' : `, ${stats.doneScheduled} מתוך ${stats.totalScheduled} הושלמו`}" class="h-14 sm:h-20 p-1.5 sm:p-2 rounded-xl border flex flex-col justify-between text-right transition relative ${isInRange && !isFuture ? 'cal-in-range' : ''} ${
                isFuture
                    ? 'bg-slate-50/40 dark:bg-slate-900/30 text-slate-400 dark:text-slate-600 border-dashed border-slate-200 dark:border-slate-800 opacity-45 cursor-not-allowed select-none'
                    : isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md scale-[1.02]'
                      : isToday
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-2 border-indigo-500'
                        : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 hover:border-indigo-400'
            }">
                <div class="flex items-center justify-between w-full">
                    <span class="text-xs sm:text-sm font-semibold">${dayNum}</span>
                    ${!isFuture && stats.allDone ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>' : ''}
                </div>
                <div class="w-full space-y-1">
                    <div class="hidden sm:flex items-center justify-between text-xs font-semibold ${isSelected ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}">
                        <span>${isFuture ? 'עתידי' : isRestDay ? 'מנוחה' : `${stats.doneScheduled}/${stats.totalScheduled}`}</span>
                        <span>${isFuture || isRestDay ? '' : `${stats.pct}%`}</span>
                    </div>
                    <div class="w-full h-1.5 rounded-full overflow-hidden ${isSelected ? 'bg-indigo-800/70' : 'bg-slate-100 dark:bg-slate-800'}">
                        <div class="h-full rounded-full ${stats.allDone ? (isSelected ? 'bg-emerald-300' : 'bg-emerald-500') : isSelected ? 'bg-white' : 'bg-indigo-500'}" style="width: ${isFuture ? 0 : stats.pct}%"></div>
                    </div>
                </div>
            </button>
        `;
    }

    gridEl.innerHTML = cellsHtml;
    playCalSlide();
    if (summaryEl) {
        summaryEl.textContent =
            elapsedDaysInMonth > 0
                ? `${perfectDaysInMonth} ימים מושלמים החודש (מתוך ${elapsedDaysInMonth} ימים עם יעדים שחלפו)`
                : 'חודש עתידי';
    }
}

function setCategoryFilter(category, context = null) {
    const targetContext = context || (app.currentMainSection === 'manage' ? 'manage' : 'tracker');
    if (targetContext === 'manage') {
        manage.selectedCategory = category;
    } else {
        tracker.selectedCategory = category;
    }
    // only the list the filter belongs to changes
    if (targetContext === 'manage') {
        renderCategoryFilterBar('manage');
        renderManageSection();
    } else {
        renderTrackerSummary();
        renderCategoryFilterBar('tracker');
        renderHabitsList();
    }
}

function setAnalyticsPreset(preset) {
    motion.analyticsEntryAnim = true;
    if (preset === 'custom') {
        ensureAnalyticsRange();
        const todayKey = getDateKeyDaysAgo(0);
        const end = analytics.range.end > todayKey ? todayKey : analytics.range.end;
        const start = analytics.range.start > end ? end : analytics.range.start;
        analytics.range = { preset: 'custom', start, end };
    } else {
        analytics.range = { preset, ...getPresetRange(preset) };
    }
    savePrefs();
    renderAnalytics();
    renderLeaderboard();
}

function applyCustomAnalyticsRange() {
    motion.analyticsEntryAnim = true;
    const startEl = document.getElementById('analyticsRangeStart');
    const endEl = document.getElementById('analyticsRangeEnd');
    let start = startEl.value;
    let end = endEl.value;
    if (!isValidDateKey(start) || !isValidDateKey(end)) return;
    if (start > end) [start, end] = [end, start];
    if (daysBetweenKeys(start, end) + 1 > MAX_RANGE_DAYS) {
        start = addDaysToKey(end, -(MAX_RANGE_DAYS - 1));
        showToast('הטווח המקסימלי הוא שנה');
    }
    analytics.range = { preset: 'custom', start, end };
    savePrefs();
    renderAnalytics();
    renderLeaderboard();
}

function openAnalyticsRangePicker(fromInput) {
    const startEl = document.getElementById('analyticsRangeStart');
    const endEl = document.getElementById('analyticsRangeEnd');
    openRangePicker({
        start: startEl.value,
        end: endEl.value,
        focusKey: fromInput ? fromInput.value : endEl.value,
        max: getDateKeyDaysAgo(0),
        onRangePick: (start, end) => {
            startEl.value = start;
            endEl.value = end;
            applyCustomAnalyticsRange();
        }
    });
}

function shiftAnalyticsRange(dir) {
    motion.analyticsEntryAnim = true;
    ensureAnalyticsRange();
    const { preset, start, end } = analytics.range;
    let ns, ne;
    if (preset === 'month') {
        const s0 = parseDateKeyLocal(start);
        const first = new Date(s0.getFullYear(), s0.getMonth() + dir, 1);
        const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
        ns = formatDateKey(first);
        ne = formatDateKey(last);
    } else {
        const len = daysBetweenKeys(start, end) + 1;
        ns = addDaysToKey(start, dir * len);
        ne = addDaysToKey(end, dir * len);
    }
    if (dir > 0 && ns > getDateKeyDaysAgo(0)) return;
    analytics.range = { preset, start: ns, end: ne };
    savePrefs();
    renderAnalytics();
    renderLeaderboard();
}

function setAnalyticsFilter(value) {
    motion.analyticsEntryAnim = true;
    analytics.filter = value || 'all';
    savePrefs();
    renderAnalytics();
    renderLeaderboard();
}

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

function toggleUnscheduledGroup() {
    tracker.restGroupExpanded = !tracker.restGroupExpanded;
    if (
        !setRevealOpen(
            document.getElementById('restGroupReveal'),
            document.getElementById('restGroupToggle'),
            tracker.restGroupExpanded,
            'הסתר',
            'הצג הכל'
        )
    ) {
        renderHabitsList();
    }
}

initTooltips();

wireMenus();

function handleManageCardClick(id) {
    if (manage.suppressNextCardClick) {
        manage.suppressNextCardClick = false;
        return;
    }
    if (manage.selectMode) {
        if (manage.selectedHabitIds.has(id)) manage.selectedHabitIds.delete(id);
        else manage.selectedHabitIds.add(id);
        motion.lastSelectToggledId = id;
        renderManageSection();
        motion.lastSelectToggledId = null;
    } else {
        openHabitModal(id);
    }
}

function toggleManageSelectMode() {
    if (manage.selectMode) exitManageSelectMode();
    else {
        manage.selectMode = true;
        closeAllMenus();
        motion.selectModeJustChanged = true;
        renderManageSection();
        motion.selectModeJustChanged = false;
    }
}

function exitManageSelectMode() {
    manage.selectMode = false;
    manage.selectedHabitIds.clear();
    renderManageSection();
}

function toggleSelectAllManageHabits() {
    const allSelected =
        manage.visibleHabitIds.length > 0 && manage.visibleHabitIds.every(id => manage.selectedHabitIds.has(id));
    if (allSelected) manage.selectedHabitIds.clear();
    else manage.visibleHabitIds.forEach(id => manage.selectedHabitIds.add(id));
    renderManageSection();
}

function archiveHabitsByIds(ids) {
    animateOut(ids, () => archiveHabitsByIdsNow(ids));
}

function archiveHabitsByIdsNow(ids) {
    const snapshot = createUndoSnapshot();
    const count = Store.archiveHabits(ids, getDateKeyDaysAgo(0), getDateKeyDaysAgo(-1));
    if (!count) return;
    manage.selectMode = false;
    manage.selectedHabitIds.clear();
    showToast(`${habitCountLabel(count)} הועברו לארכיון`, snapshot);
    renderAll();
}

function bulkArchiveSelectedHabits() {
    if (manage.selectedHabitIds.size === 0) return;
    archiveHabitsByIds([...manage.selectedHabitIds]);
}

function bulkDeleteSelectedHabits() {
    const ids = [...manage.selectedHabitIds];
    if (ids.length === 0) return;
    const label = habitCountLabel(ids.length);
    openConfirmModal(
        `מחיקת ${label}?`,
        `${ids.length === 1 ? 'ההרגל שנבחר וכל ההיסטוריה שלו יימחקו' : `${label} וכל ההיסטוריה שלהם יימחקו`} גם מהימים הקודמים. אם רק הפסקתם לעקוב, עדיף להעביר לארכיון: ההיסטוריה נשמרת ואפשר לשחזר.`,
        () =>
            animateOut(ids, () => {
                const snapshot = createUndoSnapshot();
                manage.selectMode = false;
                manage.selectedHabitIds.clear();
                Store.deleteHabits(ids);
                showToast(`${label} נמחקו`, snapshot);
                renderAll();
            }),
        {
            confirmLabel: 'מחיקה לצמיתות',
            altLabel: 'העברה לארכיון במקום',
            onAlt: () => archiveHabitsByIds(ids)
        }
    );
}

function moveHabitsToCategory(ids, targetCat) {
    const newCat = targetCat === UNCATEGORIZED_LABEL ? '' : targetCat;
    const toMove = Store.habits.filter(h => ids.includes(h.id) && (h.category || '').trim() !== newCat);
    if (toMove.length === 0) return;
    const apply = () => {
        const snapshot = createUndoSnapshot();
        Store.moveHabits(
            toMove.map(h => h.id),
            newCat
        );
        const what = toMove.length === 1 ? `"${toMove[0].name}" הועבר` : `${toMove.length} הרגלים הועברו`;
        showToast(`${what} ל"${targetCat}"`, snapshot);
        flashHabits(toMove.map(h => h.id));
        renderAll();
    };
    // If the current filter will hide them, let them leave; otherwise they stay and glow
    const staysVisible = manage.selectedCategory === 'הכל' || manage.selectedCategory === targetCat;
    if (staysVisible) withFlip(apply);
    else
        animateOut(
            toMove.map(h => h.id),
            apply
        );
}

// --- Drag & drop (mouse: drag after a small move; touch: long-press then drag) ---
function renderDropTray() {
    const list = document.getElementById('habitDropTrayList');
    const title = document.getElementById('habitDropTrayTitle');
    const dragged = Store.habits.filter(h => manage.drag.ids.includes(h.id));
    const currentCats = new Set(dragged.map(h => getHabitCategoryDisplay(h)));
    const singleCurrent = currentCats.size === 1 ? [...currentCats][0] : null;
    title.textContent = dragged.length > 1 ? `העברת ${dragged.length} הרגלים — שחררו על קטגוריה` : 'שחררו על קטגוריה';
    list.innerHTML = [...Store.categories, UNCATEGORIZED_LABEL]
        .map(cat => {
            const isCurrent = cat === singleCurrent;
            return `<span data-drop-category="${escapeHtml(cat)}" data-current="${isCurrent}" class="drop-chip px-3.5 py-2 rounded-xl text-sm font-bold transition ${
                isCurrent
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }">${escapeHtml(cat)}${isCurrent ? ' · כאן כעת' : ''}</span>`;
        })
        .join('');
}

function setDropTarget(el) {
    if (manage.drag.target === el) return;
    if (manage.drag.target) {
        manage.drag.target.classList.remove('bg-indigo-600', 'text-white', 'dark:text-white', 'scale-105');
    }
    manage.drag.target = el;
    if (el) el.classList.add('bg-indigo-600', 'text-white', 'dark:text-white', 'scale-105');
}

function moveGhost(x, y) {
    const ghost = document.getElementById('habitDragGhost');
    ghost.style.transform = `translate(${x + 12}px, ${y + 12}px) rotate(-2deg)`;
}

function startHabitDrag(x, y) {
    const p = manage.drag.pending;
    if (!p) return;
    const ids = manage.selectMode && manage.selectedHabitIds.has(p.id) ? [...manage.selectedHabitIds] : [p.id];
    manage.drag.active = true;
    manage.drag.ids = ids;
    closeAllMenus();
    const first = Store.habits.find(h => h.id === p.id);
    const ghost = document.getElementById('habitDragGhost');
    ghost.textContent = ids.length > 1 ? `${ids.length} הרגלים` : `${first.icon} ${first.name}`;
    ghost.classList.remove('hidden');
    moveGhost(x, y);
    renderDropTray();
    document.getElementById('habitDropTray').classList.remove('hidden');
    document.body.classList.add('is-dragging-habit');
    if (p.pointerType !== 'mouse' && navigator.vibrate) {
        try {
            navigator.vibrate(15);
        } catch (e) {}
    }
    // Dim the dragged cards in place (no re-render: the touch target must stay in the DOM).
    document.querySelectorAll('[data-habit-card]').forEach(el => {
        if (ids.includes(el.dataset.habitCard)) el.classList.add('opacity-40');
    });
}

function endHabitDrag(drop) {
    const p = manage.drag.pending;
    if (p && p.timer) clearTimeout(p.timer);
    manage.drag.pending = null;
    detachDragListeners();
    if (dragFrame) {
        cancelAnimationFrame(dragFrame);
        dragFrame = 0;
    }
    // the drop target follows the last pointer position, even if its frame hadn't run yet
    if (manage.drag.active && dragPoint) updateDragPosition(dragPoint[0], dragPoint[1]);
    dragPoint = null;
    if (!manage.drag.active) return;
    const target = manage.drag.target;
    const ids = manage.drag.ids;
    setDropTarget(null);
    manage.drag.active = false;
    manage.drag.ids = [];
    document.getElementById('habitDragGhost').classList.add('hidden');
    document.getElementById('habitDropTray').classList.add('hidden');
    document.body.classList.remove('is-dragging-habit');
    manage.suppressNextCardClick = true;
    setTimeout(() => {
        manage.suppressNextCardClick = false;
    }, 400);
    if (drop && target && target.dataset.current !== 'true') {
        if (manage.selectMode) {
            manage.selectMode = false;
            manage.selectedHabitIds.clear();
        }
        moveHabitsToCategory(ids, target.dataset.dropCategory);
    } else {
        renderManageSection();
    }
}

// Only pointerdown listens all the time. The move / up / touch / Escape listeners exist only
// between pressing a card and the end of that press or drag, and are removed right after.
function onDragPointerMove(e) {
    const p = manage.drag.pending;
    if (!p) return;
    if (!manage.drag.active) {
        const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        if (p.pointerType === 'mouse') {
            if (moved > 6) startHabitDrag(e.clientX, e.clientY);
            else return;
        } else {
            if (moved > 10) {
                clearTimeout(p.timer);
                manage.drag.pending = null;
                detachDragListeners();
            }
            return;
        }
    }
    scheduleDragPosition(e.clientX, e.clientY);
}
function onDragPointerUp() {
    endHabitDrag(true);
}
function onDragPointerCancel() {
    // On touch, the browser cancels the pointer once the finger moves; the drag continues via touch events.
    const p = manage.drag.pending;
    if (manage.drag.active && p && p.pointerType !== 'mouse') return;
    endHabitDrag(false);
}
function onDragTouchMove(e) {
    if (!manage.drag.active) return;
    e.preventDefault();
    const t = e.touches[0];
    if (t) scheduleDragPosition(t.clientX, t.clientY);
}
function onDragTouchEnd() {
    if (manage.drag.active) endHabitDrag(true);
}
function onDragTouchCancel() {
    if (manage.drag.active) endHabitDrag(false);
}
function onDragContextMenu(e) {
    if (manage.drag.pending || manage.drag.active) e.preventDefault();
}
function onDragKeydown(e) {
    if (e.key === 'Escape' && manage.drag.active) endHabitDrag(false);
}

const DRAG_LISTENERS = [
    ['pointermove', onDragPointerMove, { passive: true }],
    ['pointerup', onDragPointerUp, undefined],
    ['pointercancel', onDragPointerCancel, undefined],
    ['touchmove', onDragTouchMove, { passive: false }],
    ['touchend', onDragTouchEnd, undefined],
    ['touchcancel', onDragTouchCancel, undefined],
    ['contextmenu', onDragContextMenu, undefined],
    ['keydown', onDragKeydown, undefined]
];
let dragListenersAttached = false;
function attachDragListeners() {
    if (dragListenersAttached) return;
    dragListenersAttached = true;
    DRAG_LISTENERS.forEach(([type, fn, opts]) => document.addEventListener(type, fn, opts));
}
function detachDragListeners() {
    if (!dragListenersAttached) return;
    dragListenersAttached = false;
    DRAG_LISTENERS.forEach(([type, fn, opts]) => document.removeEventListener(type, fn, opts));
}

export function wireHabitDrag() {
    document.addEventListener('pointerdown', e => {
        manage.suppressNextCardClick = false;
        const card = e.target.closest('[data-habit-card]');
        if (!card || app.currentMainSection !== 'manage') return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target.closest('[aria-haspopup], [data-menu-panel]')) return;
        const p = { id: card.dataset.habitCard, x: e.clientX, y: e.clientY, pointerType: e.pointerType, timer: null };
        if (e.pointerType !== 'mouse') {
            p.timer = setTimeout(() => startHabitDrag(p.x, p.y), 380);
        }
        manage.drag.pending = p;
        attachDragListeners();
    });
}
wireHabitDrag();

// The ghost follows the pointer once per frame, however many move events arrive
let dragFrame = 0;
let dragPoint = null;
function scheduleDragPosition(x, y) {
    dragPoint = [x, y];
    if (dragFrame) return;
    dragFrame = requestAnimationFrame(() => {
        dragFrame = 0;
        if (manage.drag.active && dragPoint) updateDragPosition(dragPoint[0], dragPoint[1]);
    });
}

function updateDragPosition(x, y) {
    moveGhost(x, y);
    const el = document.elementFromPoint(x, y);
    setDropTarget(el ? el.closest('[data-drop-category]') : null);
}

// --- Categories: multi-select delete (inside the category manager) ---
function updateCategorySelectUi() {
    const toggle = document.getElementById('categorySelectToggleBtn');
    const allBtn = document.getElementById('categorySelectAllBtn');
    const info = document.getElementById('categorySelectInfo');
    const delBtn = document.getElementById('categoryBulkDeleteBtn');
    const toolbar = document.getElementById('categorySelectToolbar');
    if (!toggle) return;
    if (Store.categories.length === 0 && categoryManager.selectMode) categoryManager.selectMode = false;
    toolbar.classList.toggle('hidden', Store.categories.length === 0);
    toggle.textContent = categoryManager.selectMode ? 'ביטול' : 'בחירה';
    allBtn.classList.toggle('hidden', !categoryManager.selectMode);
    const allSelected = Store.categories.length > 0 && Store.categories.every(c => categoryManager.selected.has(c));
    allBtn.textContent = allSelected ? 'ניקוי בחירה' : 'בחירת הכל';
    info.textContent = categoryManager.selectMode
        ? `נבחרו ${categoryManager.selected.size}`
        : `${Store.categories.length} קטגוריות`;
    delBtn.classList.toggle('hidden', !categoryManager.selectMode);
    delBtn.disabled = categoryManager.selected.size === 0;
    delBtn.textContent =
        categoryManager.selected.size > 1 ? `מחיקת ${categoryManager.selected.size} קטגוריות` : 'מחיקת הקטגוריה שנבחרה';
}

function toggleCategorySelectMode() {
    categoryManager.selectMode = !categoryManager.selectMode;
    categoryManager.selected.clear();
    categoryManager.editingName = null;
    renderCategoryManagerItems();
}

function toggleCategorySelected(cat) {
    if (categoryManager.selected.has(cat)) categoryManager.selected.delete(cat);
    else categoryManager.selected.add(cat);
    renderCategoryManagerItems();
}

function toggleSelectAllCategories() {
    const allSelected = Store.categories.every(c => categoryManager.selected.has(c));
    if (allSelected) categoryManager.selected.clear();
    else Store.categories.forEach(c => categoryManager.selected.add(c));
    renderCategoryManagerItems();
}

function bulkDeleteSelectedCategories() {
    const cats = [...categoryManager.selected];
    if (cats.length === 0) return;
    const affected = Store.habits.filter(h => cats.includes((h.category || '').trim())).length;
    const what = cats.length === 1 ? `הקטגוריה "${cats[0]}"` : `${cats.length} קטגוריות`;
    const msg =
        affected > 0
            ? `${affected === 1 ? 'הרגל אחד משויך' : `${affected} הרגלים משויכים`} לקטגוריות שנבחרו. אחרי המחיקה ${affected === 1 ? 'הוא יוגדר' : 'הם יוגדרו'} כ"${UNCATEGORIZED_LABEL}".`
            : 'אין הרגלים שמשויכים לקטגוריות שנבחרו.';
    openConfirmModal(
        `מחיקת ${what}?`,
        msg,
        () => {
            const snapshot = createUndoSnapshot();
            if (cats.includes(tracker.selectedCategory)) tracker.selectedCategory = 'הכל';
            if (cats.includes(manage.selectedCategory)) manage.selectedCategory = 'הכל';
            categoryManager.selected.clear();
            categoryManager.selectMode = false;
            Store.deleteCategories(cats);
            populateCategorySelectDropdown();
            renderAll();
            renderCategoryManagerItems();
            showToast(`${cats.length === 1 ? 'הקטגוריה נמחקה' : `${cats.length} קטגוריות נמחקו`}`, snapshot);
        },
        { confirmLabel: 'מחיקה' }
    );
}

// slot: which occurrence, for a habit done several times a day (omit to toggle the whole day)
function toggleHabitDay(habitId, dateKey, slot) {
    if (isFutureDateKey(dateKey)) {
        showToast('לא ניתן לסמן הרגלים בתאריך שעוד לא הגיע');
        return;
    }
    const habit = Store.habits.find(h => h.id === habitId);
    if (!habit) return;
    if (!isHabitActiveOnKey(habit, dateKey)) {
        showToast(
            habit.startDate && dateKey < habit.startDate
                ? `ההרגל מתחיל רק ב-${formatStartDateLabel(habit.startDate)}`
                : 'ההרגל היה בארכיון בתאריך הזה'
        );
        return;
    }
    const dayObj = dayObjForKey(dateKey);
    const wasAllDone = getDayStats(dayObj).allDone;

    const result = Store.toggleDay(habitId, dateKey, slot);
    if (!result) return;
    const newState = result.on;

    const nowAllDone = getDayStats(dayObj).allDone;
    if (newState && !wasAllDone && nowAllDone) {
        playFeedbackSound('celebrate');
        showToast('כל היעדים להיום הושלמו. כל הכבוד!');
    } else {
        playFeedbackSound(newState ? 'check' : 'uncheck');
    }

    motion.lastToggledHabitId = newState ? habitId : null;
    motion.lastToggle = { id: habitId, key: dateKey, on: newState, slot: result.slot };
    if (newState && !wasAllDone && nowAllDone) motion.celebrateDayKey = dateKey;
    if (newState && navigator.vibrate && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        try {
            navigator.vibrate(10);
        } catch (e) {}
    }
    renderAll();
    motion.lastToggledHabitId = null;
    motion.lastToggle = null;
    motion.celebrateDayKey = null;
}

function markAllForSelectedDay() {
    if (isFutureDateKey(tracker.selectedDateKey)) {
        showToast('לא ניתן לסמן הרגלים בתאריך שעוד לא הגיע');
        return;
    }
    if (Store.habits.length === 0) return;
    const selectedDayObj = tracker.weekDays.find(d => d.key === tracker.selectedDateKey) || tracker.weekDays[0];
    const dayIdx = selectedDayObj.dateObj.getDay();
    // Only the habits the user can actually see (respects the category filter)
    const targetHabits = getTrackerVisibleHabits().filter(h =>
        isHabitScheduledOnKey(h, tracker.selectedDateKey, dayIdx)
    );
    if (targetHabits.length === 0) return;

    const snapshot = createUndoSnapshot();
    Store.markDay(
        targetHabits.map(h => h.id),
        tracker.selectedDateKey
    );
    playFeedbackSound('celebrate');
    const label = selectedDayObj.isToday ? 'היום' : selectedDayObj.dayFull;
    showToast(`כל ההרגלים המתוכננים ל${label} סומנו!`, snapshot);
    renderAll();
}

function clearAllForSelectedDay() {
    if (isFutureDateKey(tracker.selectedDateKey)) return;
    const visibleHabits = getTrackerVisibleHabits();
    const anyChecked = visibleHabits.some(h => hasAnyMarkOnDay(h, tracker.selectedDateKey));
    if (!anyChecked) return;

    const snapshot = createUndoSnapshot();
    Store.clearDay(
        visibleHabits.map(h => h.id),
        tracker.selectedDateKey
    );
    playFeedbackSound('uncheck');
    showToast('הסימונים ליום זה נוקו', snapshot);
    renderAll();
}

function getHabitFormState() {
    const goalType = habitForm.goalType;
    return JSON.stringify({
        name: (document.getElementById('habitNameInput')?.value || '').trim(),
        category: document.getElementById('habitCategoryInput')?.value || '',
        startDate: document.getElementById('habitStartDateInput')?.value || '',
        goalType,
        weeklyGoal: goalType === 'flexible' ? String(document.getElementById('habitGoalInput')?.value || '') : '',
        fixedDays: goalType === 'fixed_days' ? [...habitForm.fixedDays].sort((a, b) => a - b) : [],
        note: (document.getElementById('habitNoteInput')?.value || '').trim(),
        icon: habitForm.icon,
        color: habitForm.color,
        timing: (() => {
            const d = getModalScheduleDef();
            return [d.time, d.duration, d.dayTimes, d.slotTimes];
        })()
    });
}

function isPerDayTimesOn() {
    return !!document.getElementById('habitPerDayToggle')?.checked;
}

function modalSlotCount() {
    return Math.max(1, Math.min(MAX_SLOTS, Number(document.getElementById('habitTimesPerDay')?.value) || 1));
}

function modalActiveWeekdays() {
    return scheduleWeekdays({ goalType: habitForm.goalType, fixedDays: habitForm.fixedDays });
}

function timeModelRow(day) {
    return isPerDayTimesOn() ? habitForm.timeModel.cells[day] : habitForm.timeModel.uniform;
}

function readModalTime() {
    const n = modalSlotCount();
    const duration = Number(document.getElementById('habitDuration')?.value) || 0;
    if (isPerDayTimesOn())
        return { time: '', duration, slotTimes: null, dayTimes: habitForm.timeModel.cells.map(r => r.slice(0, n)) };
    if (n > 1) return { time: '', duration, dayTimes: null, slotTimes: habitForm.timeModel.uniform.slice(0, n) };
    const t = habitForm.timeModel.uniform[0] || '';
    return { time: t, duration: t ? duration : 0, dayTimes: null, slotTimes: null };
}

// Show the picked cell's time in the hour / minute fields
function loadEditorFromCell() {
    const t = timeModelRow(habitForm.timeModel.day)[habitForm.timeModel.slot] || '';
    const hourEl = document.getElementById('habitTimeHour');
    const minEl = document.getElementById('habitTimeMinute');
    if (t) {
        const [h, m] = t.split(':');
        hourEl.value = h;
        ensureSelectOption(minEl, m, m);
        minEl.value = m;
    } else {
        hourEl.value = '';
        minEl.value = '00';
    }
}

// Hour / minute changed: write the picked cell
function onTimeEditorChange() {
    const hour = document.getElementById('habitTimeHour').value;
    const minute = document.getElementById('habitTimeMinute').value || '00';
    timeModelRow(habitForm.timeModel.day)[habitForm.timeModel.slot] = hour ? `${hour}:${minute}` : '';
    syncHabitTimeFields();
}

function focusAfterRender(id) {
    const el = document.getElementById(id);
    if (el) el.focus({ preventScroll: true });
}

function pickTimeDay(d) {
    habitForm.timeModel.day = d;
    loadEditorFromCell();
    syncHabitTimeFields();
    focusAfterRender(`timeDayChip_${d}`);
}

function pickTimeSlot(i) {
    habitForm.timeModel.slot = i;
    loadEditorFromCell();
    syncHabitTimeFields();
    focusAfterRender(`timeSlotChip_${i}`);
}

// Switch on: every day starts from the shared times. Off: the first day with a time becomes the shared one.
function togglePerDayTimes(on) {
    const active = modalActiveWeekdays();
    if (on) {
        habitForm.timeModel.cells = Array.from({ length: 7 }, () => [...habitForm.timeModel.uniform]);
        if (!active.includes(habitForm.timeModel.day)) habitForm.timeModel.day = active[0];
    } else {
        const src = active.find(d => habitForm.timeModel.cells[d].some(Boolean));
        habitForm.timeModel.uniform = [...habitForm.timeModel.cells[src !== undefined ? src : active[0]]];
    }
    loadEditorFromCell();
    syncHabitTimeFields();
    updateHabitSaveState();
}

// Occurrences beyond the new count are cleared, so they don't come back unexpectedly
function setModalTimesPerDay(n) {
    for (let i = n; i < MAX_SLOTS; i++) {
        habitForm.timeModel.uniform[i] = '';
        habitForm.timeModel.cells.forEach(r => {
            r[i] = '';
        });
    }
    if (habitForm.timeModel.slot >= n) habitForm.timeModel.slot = 0;
    loadEditorFromCell();
    syncHabitTimeFields();
    updateHabitSaveState();
}

function copyDayTimesToAll() {
    const src = [...habitForm.timeModel.cells[habitForm.timeModel.day]];
    habitForm.timeModel.cells = habitForm.timeModel.cells.map(() => [...src]);
    syncHabitTimeFields();
    updateHabitSaveState();
}

function setSelectDisabled(id, disabled) {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = disabled;
    const trigger = document.getElementById(`${id}_trigger`);
    if (trigger) trigger.disabled = disabled;
}

function ensureSelectOption(select, value, label) {
    if (![...select.options].some(o => o.value === value)) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        const after = [...select.options].find(o => o.value !== '' && Number(o.value) > Number(value));
        select.insertBefore(opt, after || null);
    }
}

function setModalTime(time, duration, dayTimes = null, slotTimes = null) {
    const durEl = document.getElementById('habitDuration');
    if (!durEl) return;
    const n = dayTimes ? (Array.isArray(dayTimes[0]) ? dayTimes[0].length : 1) : slotTimes ? slotTimes.length : 1;
    document.getElementById('habitTimesPerDay').value = String(n);
    document.getElementById('habitPerDayToggle').checked = !!dayTimes;
    const pad = r => [...r, '', '', '', ''].slice(0, MAX_SLOTS);
    habitForm.timeModel.uniform = pad(slotTimes || [time || '']);
    habitForm.timeModel.cells = Array.from({ length: 7 }, (_, d) =>
        pad(dayTimes ? (Array.isArray(dayTimes[d]) ? dayTimes[d] : [dayTimes[d] || '']) : habitForm.timeModel.uniform)
    );
    habitForm.timeModel.day = modalActiveWeekdays()[0];
    habitForm.timeModel.slot = 0;
    const hasTime = !!time || !!dayTimes || !!slotTimes;
    ensureSelectOption(durEl, String(duration || 0), `${duration} דקות`);
    durEl.value = hasTime ? String(duration || 0) : '0';
    loadEditorFromCell();
    syncHabitTimeFields();
}

function timeChipHtml(id, actionAttrs, selected, label, time, ariaLabel, extraCls = '') {
    return `<button type="button" id="${id}" ${actionAttrs} aria-pressed="${selected}" aria-label="${ariaLabel}" class="${extraCls} min-w-0 min-h-[44px] py-1.5 px-1 rounded-xl border text-center transition ${
        selected
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
    }"><span class="block text-xs font-semibold">${label}</span><span dir="ltr" class="block text-xs tabular-nums ${selected ? 'text-indigo-100' : time ? 'text-slate-600 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}">${time || '—'}</span></button>`;
}

// Renders the chips, the caption and the field states from the model
function syncHabitTimeFields() {
    const dayChips = document.getElementById('timeDayChips');
    if (!dayChips) return;
    const active = modalActiveWeekdays();
    const n = modalSlotCount();
    // a different time per day only makes sense with 2+ active days
    const multiDay = active.length > 1;
    document.getElementById('habitPerDayToggleWrap').classList.toggle('hidden', !multiDay);
    if (!multiDay && isPerDayTimesOn()) {
        document.getElementById('habitPerDayToggle').checked = false;
        togglePerDayTimes(false); // the remaining day's times become the shared ones
        return;
    }
    const perDay = isPerDayTimesOn();
    let moved = false;
    if (perDay && !active.includes(habitForm.timeModel.day)) {
        habitForm.timeModel.day = active[0];
        moved = true;
    }
    if (habitForm.timeModel.slot >= n) {
        habitForm.timeModel.slot = 0;
        moved = true;
    }
    if (moved) loadEditorFromCell();

    dayChips.classList.toggle('hidden', !perDay);
    if (perDay) {
        dayChips.style.gridTemplateColumns = `repeat(${active.length}, minmax(0, 1fr))`;
        patchHTML(
            dayChips,
            active
                .map(d => {
                    const t = habitForm.timeModel.cells[d][habitForm.timeModel.slot] || '';
                    return timeChipHtml(
                        `timeDayChip_${d}`,
                        `data-action="pickTimeDay" data-arg="${d}"`,
                        d === habitForm.timeModel.day,
                        HEBREW_DAYS_SHORT[d],
                        t,
                        `${HEBREW_DAYS_FULL[d]}${n > 1 ? `, פעם ${habitForm.timeModel.slot + 1}` : ''}: ${t || 'ללא שעה'}`
                    );
                })
                .join('')
        );
    }
    const slotChips = document.getElementById('timeSlotChips');
    slotChips.classList.toggle('hidden', n < 2);
    if (n > 1) {
        const row = timeModelRow(habitForm.timeModel.day);
        patchHTML(
            slotChips,
            [...Array(n).keys()]
                .map(i =>
                    timeChipHtml(
                        `timeSlotChip_${i}`,
                        `data-action="pickTimeSlot" data-arg="${i}"`,
                        i === habitForm.timeModel.slot,
                        `פעם ${i + 1}`,
                        row[i] || '',
                        `פעם ${i + 1}${perDay ? `, ${HEBREW_DAYS_FULL[habitForm.timeModel.day]}` : ''}: ${row[i] || 'ללא שעה'}`,
                        'flex-1'
                    )
                )
                .join('')
        );
    }
    const caption = document.getElementById('timeEditCaption');
    caption.classList.toggle('hidden', !perDay && n < 2);
    caption.textContent = `השעה של ${[perDay ? HEBREW_DAYS_FULL[habitForm.timeModel.day] : '', n > 1 ? `פעם ${habitForm.timeModel.slot + 1}` : ''].filter(Boolean).join(', ')}:`;
    const copyBtn = document.getElementById('copyDayTimesBtn');
    copyBtn.classList.toggle('hidden', !perDay);
    copyBtn.textContent = `העתקת ${n > 1 ? 'השעות' : 'השעה'} של ${HEBREW_DAYS_FULL[habitForm.timeModel.day]} לכל הימים`;

    setSelectDisabled('habitTimeMinute', !document.getElementById('habitTimeHour').value);
    setSelectDisabled('habitDuration', !hasAnyTime(readModalTime()));
    document.getElementById('habitDurationEach').classList.toggle('hidden', n < 2);
    updateHabitTimeHint();
    updateHabitModalSummaries();
}

function getModalScheduleDef() {
    const goalType = habitForm.goalType;
    return normalizeScheduleFields({
        goalType,
        fixedDays: goalType === 'fixed_days' ? [...habitForm.fixedDays] : [],
        weeklyGoal: goalType === 'flexible' ? parseInt(document.getElementById('habitGoalInput')?.value, 10) || 4 : 7,
        ...readModalTime()
    });
}

function updateHabitTimeHint() {
    const hint = document.getElementById('habitTimeHint');
    if (!hint) return;
    const def = getModalScheduleDef();
    hint.classList.remove('text-amber-700', 'dark:text-amber-400', 'font-semibold');
    if (!hasAnyTime(def)) {
        hint.textContent =
            slotCount(def) > 1
                ? `${slotCount(def)} פעמים ביום, בלי שעות. כל פעם תופיע ככרטיס נפרד.`
                : 'בלי שעה, ההרגל יופיע בכל שעה של היום.';
        return;
    }
    const overlaps = findTimeOverlaps(def, document.getElementById('habitIdInput')?.value || '');
    if (overlaps.length) {
        hint.classList.add('text-amber-700', 'dark:text-amber-400', 'font-semibold');
        hint.textContent =
            'חופף ל: ' +
            overlaps
                .map(
                    ({ h, days, time }) =>
                        `${h.icon} ${h.name} (${timeRangeText(time, h.duration)}${days.length < 7 ? `, ${formatDaySet(days)}` : ''})`
                )
                .join(' · ');
        return;
    }
    hint.textContent =
        def.dayTimes || def.slotTimes
            ? `יופיע במסך המעקב: ${scheduleTimeSummary(def)}`
            : `יופיע במסך המעקב ${dayPartOf(def.time).inLabel}, ${timeRangeText(def.time, def.duration)}`;
}

function setScheduleScope(scope) {
    habitForm.scheduleScope = scope;
    updateScheduleScopeBox();
}

function updateScheduleScopeBox() {
    const box = document.getElementById('scheduleScopeBox');
    if (!box) return;
    const id = document.getElementById('habitIdInput')?.value;
    const habit = id ? Store.habits.find(h => h.id === id) : null;
    const todayKey = getDateKeyDaysAgo(0);
    const startKey = habit ? readStartDateInput(habit) : todayKey;
    let show = false,
        prev = null,
        def = null;
    if (habit && startKey < todayKey) {
        def = getModalScheduleDef();
        show = !sameScheduleFields(def, getScheduleVersion(habit, todayKey));
        prev = getScheduleVersion(habit, addDaysToKey(todayKey, -1));
    }
    const wasHidden = box.classList.contains('hidden');
    box.classList.toggle('hidden', !show);
    if (!show) return;
    if (wasHidden) {
        restartAnimationClass(box, 'fade-in-quick');
        requestAnimationFrame(() =>
            box.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
        );
    }
    ['forward', 'all'].forEach(sc => {
        const btn = document.getElementById(`scopeBtn_${sc}`);
        const on = habitForm.scheduleScope === sc;
        btn.setAttribute('aria-checked', String(on));
        btn.classList.toggle('bg-white', on);
        btn.classList.toggle('dark:bg-slate-900', on);
        btn.classList.toggle('border-amber-400', on);
        btn.classList.toggle('dark:border-amber-600', on);
        btn.classList.toggle('text-amber-900', on);
        btn.classList.toggle('dark:text-amber-100', on);
        btn.classList.toggle('shadow-sm', on);
        btn.classList.toggle('border-amber-200', !on);
        btn.classList.toggle('dark:border-amber-900/60', !on);
        btn.classList.toggle('text-amber-800/80', !on);
        btn.classList.toggle('dark:text-amber-300/70', !on);
    });
    document.getElementById('scheduleScopeText').textContent =
        habitForm.scheduleScope === 'forward'
            ? `הימים שעברו יישארו לפי ההגדרה הקודמת (${describeScheduleVersion(prev, hasAnyTime(def))}), כך שהסטטיסטיקה שלהם לא תשתנה.`
            : 'ההגדרה החדשה תחול גם על כל הימים שעברו, והסטטיסטיקה שלהם תחושב מחדש. מתאים לתיקון טעות.';
}

function isHabitFormSaveable() {
    const name = (document.getElementById('habitNameInput')?.value || '').trim();
    if (!name) return false;
    const isEditing = !!document.getElementById('habitIdInput')?.value;
    if (!isEditing) return true;
    return habitForm.initialState === null || getHabitFormState() !== habitForm.initialState;
}

// Enter saves when possible; with an empty name it points at the field instead of doing nothing
function handleHabitFormEnter(event) {
    if (event.key !== 'Enter' || event.target.tagName !== 'INPUT') return;
    event.preventDefault();
    if (!document.getElementById('saveHabitBtn').disabled) {
        saveHabitForm({ preventDefault() {} });
    } else if (!document.getElementById('habitNameInput').value.trim()) {
        const nameInput = document.getElementById('habitNameInput');
        shakeField(nameInput);
        nameInput.focus();
    }
}

function updateHabitSaveState() {
    const btn = document.getElementById('saveHabitBtn');
    if (btn) btn.disabled = !isHabitFormSaveable();
    syncHabitTimeFields();
    updateScheduleScopeBox();
}

function setModalGoalType(type) {
    habitForm.goalType = type;
    const types = ['daily', 'flexible', 'fixed_days'];
    types.forEach(t => {
        const btn = document.getElementById(`goalTypeBtn_${t}`);
        const panel = document.getElementById(`goalPanel_${t}`);
        if (btn) {
            btn.className =
                t === type
                    ? 'min-h-[44px] flex items-center justify-center text-center whitespace-nowrap py-2 px-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400'
                    : 'min-h-[44px] flex items-center justify-center text-center whitespace-nowrap py-2 px-1.5 rounded-lg text-xs font-semibold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
        }
        if (btn) btn.setAttribute('aria-pressed', String(t === type));
        if (panel) {
            panel.classList.toggle('hidden', t !== type);
        }
    });
    updateSegPill(document.getElementById('goalTypeBtn_daily').parentElement);
    renderFixedDaysPicker();
    updateHabitSaveState();
}

function toggleModalFixedDay(dayIdx) {
    if (habitForm.fixedDays.includes(dayIdx)) {
        if (habitForm.fixedDays.length > 1) {
            habitForm.fixedDays = habitForm.fixedDays.filter(d => d !== dayIdx);
        } else {
            showToast('יש לבחור לפחות יום קבוע אחד בשבוע');
            shakeField(document.getElementById('fixedDaysPickerGrid'), false);
            return;
        }
    } else {
        habitForm.fixedDays.push(dayIdx);
        habitForm.fixedDays.sort((a, b) => a - b);
        motion.justPicked = dayIdx;
    }
    renderFixedDaysPicker();
    motion.justPicked = null;
    updateHabitSaveState();
}

function renderFixedDaysPicker() {
    const grid = document.getElementById('fixedDaysPickerGrid');
    const badge = document.getElementById('fixedDaysCountBadge');
    if (!grid || !badge) return;

    const count = habitForm.fixedDays.length;
    badge.textContent = count === 1 ? 'יום אחד נבחר' : `${count} ימים נבחרו`;

    patchHTML(
        grid,
        HEBREW_DAYS_SHORT.map((label, idx) => {
            const active = habitForm.fixedDays.includes(idx);
            return `
            <button type="button" data-action="toggleFixedDay" data-arg="${idx}" aria-pressed="${active}" aria-label="${HEBREW_DAYS_FULL[idx]}" data-cell-pop="${active && motion.justPicked === idx ? '1' : ''}" class="min-w-0 min-h-[44px] py-2.5 rounded-xl font-semibold text-xs border transition-all ${
                active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
            }">
                ${label}
            </button>
        `;
        }).join('')
    );
}

function toggleCustomIconPanel() {
    const panel = document.getElementById('customIconPanel');
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    if (opening) {
        const moreList = [...new Set([...ICON_OPTIONS.slice(10).map(i => i.emoji), ...MORE_ICONS])];
        document.getElementById('moreIconsGrid').innerHTML = moreList
            .map(
                e =>
                    `<button type="button" data-action="selectIcon" class="h-9 rounded-lg text-lg flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-slate-700 transition">${e}</button>`
            )
            .join('');
    }
    renderModalPickers();
}

function handleCustomIconInput(input) {
    const chars = getGraphemes(input.value);
    if (chars.length === 0) return;
    // Keep only the last emoji typed or pasted.
    const last = chars[chars.length - 1];
    if (/^[\p{L}\p{N}\s]+$/u.test(last)) {
        input.value = '';
        return;
    } // letters/digits are not icons
    input.value = last;
    habitForm.icon = last;
    renderModalPickers();
    updateHabitSaveState();
}

function renderModalPickers() {
    const iconGrid = document.getElementById('iconPickerGrid');
    // 11 icons + the "+" tile fill two clean rows of 6. If the chosen icon is not among
    // them, it takes the last icon slot (the replaced one stays reachable from the "+" list).
    const iconList = ICON_OPTIONS.slice(0, 11).map(i => ({ emoji: i.emoji, label: i.label }));
    if (!iconList.some(i => i.emoji === habitForm.icon)) {
        const known = ICON_OPTIONS.find(i => i.emoji === habitForm.icon);
        iconList[10] = { emoji: habitForm.icon, label: known ? known.label : 'אייקון מותאם אישית' };
    }
    const panelOpen = !document.getElementById('customIconPanel').classList.contains('hidden');
    const plusTile = `
            <button type="button" data-action="toggleCustomIcons" title="אייקון אחר" aria-label="בחירת אייקון אחר" aria-expanded="${panelOpen}" class="h-11 rounded-xl flex items-center justify-center border border-dashed transition ${
                panelOpen
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10'
                    : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600'
            }"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m7-7H5"/></svg></button>`;
    patchHTML(
        iconGrid,
        iconList
            .map(item => {
                const active = item.emoji === habitForm.icon;
                return `
            <button type="button" data-action="selectIcon" title="${escapeHtml(item.label)}" aria-label="אייקון: ${escapeHtml(item.label)}" aria-pressed="${active}" data-cell-pop="${active && motion.justPicked === 'icon' ? '1' : ''}" class="h-11 rounded-xl text-xl flex items-center justify-center border transition ${
                active
                    ? 'border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/30'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700'
            }">
                ${escapeHtml(item.emoji)}
            </button>
        `;
            })
            .join('') + plusTile
    );

    const colorGrid = document.getElementById('colorPickerGrid');
    patchHTML(
        colorGrid,
        COLOR_OPTIONS.map(c => {
            const active = c.id === habitForm.color;
            return `
            <button type="button" data-action="selectColor" data-arg="${c.id}" title="${c.name}" aria-label="צבע ${c.name}" aria-pressed="${active}" data-cell-pop="${active && motion.justPicked === 'color' ? '1' : ''}" class="tap-44 w-10 h-10 shrink-0 rounded-full ${c.bg} flex items-center justify-center text-white text-sm font-bold transition ${
                active
                    ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900'
                    : 'opacity-75 hover:opacity-100'
            }">
                ${active ? icon('check', 'w-4 h-4', 3) : ''}
            </button>
        `;
        }).join('')
    );
    updateHabitPreview();
}

// ---- Habit modal: preview + collapsible sections ----
function updateHabitPreview() {
    const prev = document.getElementById('habitPreviewIcon');
    const btn = document.getElementById('habitAppearanceBtn');
    if (!prev || !btn) return;
    const c = COLOR_OPTIONS.find(x => x.id === habitForm.color) || COLOR_OPTIONS[0];
    prev.className = `w-12 h-12 rounded-xl flex items-center justify-center text-2xl border-2 ${c.softBg} ${c.border}`;
    prev.textContent = habitForm.icon;
    const known = ICON_OPTIONS.find(i => i.emoji === habitForm.icon);
    btn.setAttribute(
        'aria-label',
        `מראה ההרגל: ${known ? known.label : 'אייקון מותאם'}, צבע ${c.name}. שינוי אייקון וצבע`
    );
}

const HABIT_SECTIONS = {
    appearance: ['habitAppearanceBtn', 'habitAppearancePanel'],
    time: ['habitTimeToggle', 'habitTimePanel'],
    details: ['habitDetailsToggle', 'habitDetailsPanel']
};

function toggleHabitSection(name, force) {
    const [btnId, panelId] = HABIT_SECTIONS[name];
    const btn = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    if (!btn || !panel) return;
    const open = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', String(open));
    const chev = btn.querySelector('[data-chevron]');
    if (chev) chev.classList.toggle('rotate-180', open);
    if (open && typeof force !== 'boolean') {
        if (!prefersReducedMotion()) restartAnimationClass(panel, 'fade-in-quick');
        requestAnimationFrame(() =>
            panel.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
        );
    }
}

// One-line summaries on the collapsed rows, so nothing important is hidden
function updateHabitModalSummaries() {
    const timeEl = document.getElementById('habitTimeSummary');
    if (timeEl) {
        const def = getModalScheduleDef();
        const n = slotCount(def);
        let text,
            warn = false;
        if (hasAnyTime(def)) {
            text = def.dayTimes || def.slotTimes ? scheduleTimeSummary(def) : timeRangeText(def.time, def.duration);
            if (findTimeOverlaps(def, document.getElementById('habitIdInput')?.value || '').length) {
                text = `חופף להרגל אחר · ${text}`;
                warn = true;
            }
        } else {
            text = n > 1 ? `${n} פעמים ביום, בלי שעה` : 'בלי שעה';
        }
        timeEl.textContent = text;
        timeEl.classList.toggle('text-amber-700', warn);
        timeEl.classList.toggle('dark:text-amber-400', warn);
        timeEl.classList.toggle('font-semibold', warn);
        timeEl.classList.toggle('text-slate-500', !warn);
        timeEl.classList.toggle('dark:text-slate-400', !warn);
    }
    const detailsEl = document.getElementById('habitDetailsSummary');
    if (detailsEl) {
        const sel = document.getElementById('habitCategoryInput');
        const cat =
            sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : UNCATEGORIZED_LABEL;
        const note = (document.getElementById('habitNoteInput')?.value || '').trim();
        detailsEl.textContent = `${cat} · ${note || 'בלי הערה'}`;
    }
}

function selectModalIcon(emoji) {
    habitForm.icon = emoji;
    motion.justPicked = 'icon';
    renderModalPickers();
    motion.justPicked = null;
    updateHabitSaveState();
}

function selectModalColor(colorId) {
    habitForm.color = colorId;
    motion.justPicked = 'color';
    renderModalPickers();
    motion.justPicked = null;
    updateHabitSaveState();
}

function openHabitModal(habitId = null) {
    const modal = document.getElementById('habitModalBackdrop');
    const titleEl = document.getElementById('modalTitle');

    populateCategorySelectDropdown();
    Object.keys(HABIT_SECTIONS).forEach(name => toggleHabitSection(name, false));
    document.getElementById('customIconPanel').classList.add('hidden');
    document.getElementById('customIconInput').value = '';

    if (habitId) {
        const habit = Store.find(habitId);
        if (!habit) return;
        titleEl.textContent = 'עריכת הרגל';
        document.getElementById('habitIdInput').value = habit.id;
        document.getElementById('habitNameInput').value = habit.name;
        populateCategorySelectDropdown(habit.category || '');
        document.getElementById('habitGoalInput').value = String(Math.min(6, Math.max(1, habit.weeklyGoal || 4)));
        document.getElementById('habitNoteInput').value = habit.note || '';
        habitForm.icon = habit.icon || ICON_OPTIONS[0].emoji;
        habitForm.color = habit.color || COLOR_OPTIONS[0].id;
        habitForm.goalType = habit.goalType || 'daily';
        habitForm.fixedDays =
            Array.isArray(habit.fixedDays) && habit.fixedDays.length > 0 ? [...habit.fixedDays] : [0, 2, 4];
        setupStartDateInput(habit.startDate, habit);
        setModalTime(habit.time, habit.duration, habit.dayTimes, habit.slotTimes);
    } else {
        titleEl.textContent = 'הרגל חדש';
        document.getElementById('habitIdInput').value = '';
        document.getElementById('habitNameInput').value = '';
        const activeCat = app.currentMainSection === 'manage' ? manage.selectedCategory : tracker.selectedCategory;
        const defaultCat =
            activeCat !== 'הכל' && activeCat !== UNCATEGORIZED_LABEL ? activeCat : Store.categories[0] || '';
        populateCategorySelectDropdown(defaultCat);
        document.getElementById('habitGoalInput').value = '4';
        document.getElementById('habitNoteInput').value = '';
        habitForm.icon = ICON_OPTIONS[0].emoji;
        habitForm.color = COLOR_OPTIONS[0].id;
        habitForm.goalType = 'daily';
        habitForm.fixedDays = [0, 2, 4];
        setupStartDateInput(getDateKeyDaysAgo(0), null);
        setModalTime('', 0);
    }
    habitForm.scheduleScope = 'forward';

    setModalGoalType(habitForm.goalType);
    renderModalPickers();
    habitForm.initialState = getHabitFormState();
    updateHabitSaveState();
    updateHabitModalSummaries();
    showModal(modal);
    const modalScroller = modal.querySelector('.themed-scroll');
    if (modalScroller) modalScroller.scrollTop = 0;
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        setTimeout(() => document.getElementById('habitNameInput').focus(), 60);
    }
}

// The start date can't be in the future, and can't be later than the habit's first check mark
// (otherwise existing marks would silently disappear from the stats)
function getMaxStartDateKey(habit) {
    const today = getDateKeyDaysAgo(0);
    const firstCheck = habit ? getEarliestCheckedKey(habit) : null;
    return firstCheck && firstCheck < today ? firstCheck : today;
}

function setupStartDateInput(value, habit) {
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

function readStartDateInput(habit) {
    const input = document.getElementById('habitStartDateInput');
    const maxKey = getMaxStartDateKey(habit);
    const value = input && isValidDateKey(input.value) ? input.value : maxKey;
    return value > maxKey ? maxKey : value;
}

function closeHabitModal() {
    hideModal(document.getElementById('habitModalBackdrop'));
}

function saveHabitForm(event) {
    event.preventDefault();
    const id = document.getElementById('habitIdInput').value.trim();
    const name = document.getElementById('habitNameInput').value.trim();
    const category = document.getElementById('habitCategoryInput').value;
    const note = document.getElementById('habitNoteInput').value.trim();

    if (!name || !isHabitFormSaveable()) return;

    let weeklyGoal = 7;
    let fixedDays = [0, 1, 2, 3, 4, 5, 6];

    if (habitForm.goalType === 'daily') {
        weeklyGoal = 7;
        fixedDays = [0, 1, 2, 3, 4, 5, 6];
    } else if (habitForm.goalType === 'flexible') {
        weeklyGoal = parseInt(document.getElementById('habitGoalInput').value, 10) || 4;
        fixedDays = [];
    } else if (habitForm.goalType === 'fixed_days') {
        fixedDays = [...habitForm.fixedDays].sort((a, b) => a - b);
        weeklyGoal = fixedDays.length;
    }

    const { time, duration, dayTimes, slotTimes } = readModalTime();
    const scheduleDef = normalizeScheduleFields({
        goalType: habitForm.goalType,
        fixedDays,
        weeklyGoal,
        time,
        duration,
        dayTimes,
        slotTimes
    });

    if (id) {
        const existing = Store.find(id);
        if (existing) {
            Store.updateHabit(
                id,
                {
                    name,
                    category,
                    note,
                    icon: habitForm.icon,
                    color: habitForm.color,
                    startDate: readStartDateInput(existing)
                },
                scheduleDef,
                habitForm.scheduleScope
            );
        }
        showToast('ההרגל עודכן בהצלחה');
    } else {
        const newHabit = Store.addHabit({
            id: 'h_' + Date.now(),
            name,
            category,
            ...scheduleDef,
            note,
            icon: habitForm.icon,
            color: habitForm.color,
            startDate: readStartDateInput(null),
            history: {}
        });
        flashHabits([newHabit.id]);
        showToast('הרגל חדש נוסף למערכת!');
    }

    closeHabitModal();
    const isNew = !id;
    withFlip(() => renderAll());
    if (isNew) {
        const card = [...document.querySelectorAll('.flash-highlight')].find(el => el.getClientRects().length);
        if (card) card.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
}

function promptDeleteHabitById(id) {
    const habit = Store.habits.find(h => h.id === id);
    if (!habit) return;

    const archived = isHabitArchived(habit);
    openConfirmModal(
        archived ? 'מחיקה לצמיתות?' : 'מחיקת הרגל?',
        archived
            ? `"${habit.name}" וכל ההיסטוריה שלו יימחקו, והימים הקודמים יחושבו כאילו ההרגל לא היה קיים.`
            : `"${habit.name}" וכל ההיסטוריה שלו יימחקו גם מהימים הקודמים. אם רק הפסקתם לעקוב אחריו, עדיף להעביר לארכיון: ההיסטוריה נשמרת ואפשר לשחזר.`,
        () => {
            closeHabitModal();
            animateOut([id], () => {
                const snapshot = createUndoSnapshot();
                Store.deleteHabits([id]);
                showToast(`ההרגל "${habit.name}" נמחק`, snapshot);
                renderAll();
            });
        },
        archived
            ? {}
            : {
                  confirmLabel: 'מחיקה לצמיתות',
                  altLabel: 'העברה לארכיון במקום',
                  onAlt: () => {
                      closeHabitModal();
                      archiveHabitById(id);
                  }
              }
    );
}

// Archive: the habit stops appearing from today on (from tomorrow if it was already
// checked today), while all of its past history keeps counting.
function archiveHabitById(id) {
    const habit = Store.habits.find(h => h.id === id);
    if (!habit || isHabitArchived(habit)) return;
    animateOut([id], () => {
        const snapshot = createUndoSnapshot();
        Store.archiveHabits([id], getDateKeyDaysAgo(0), getDateKeyDaysAgo(-1));
        showToast(`"${habit.name}" הועבר לארכיון`, snapshot);
        renderAll();
    });
}

// Restore: the habit comes back from today on. The archived gap is remembered as a pause,
// so those days are not counted as missed.
function restoreHabitById(id) {
    const habit = Store.habits.find(h => h.id === id);
    if (!habit || !isHabitArchived(habit)) return;
    animateOut([id], () => {
        const snapshot = createUndoSnapshot();
        Store.restoreHabit(id, getDateKeyDaysAgo(1));
        showToast(`"${habit.name}" שוחזר מהארכיון`, snapshot);
        flashHabits([id]);
        renderAll();
    });
}

function toggleArchiveSection() {
    manage.archiveExpanded = !manage.archiveExpanded;
    if (
        !setRevealOpen(
            document.getElementById('archiveReveal'),
            document.getElementById('archiveToggle'),
            manage.archiveExpanded,
            'הסתר',
            'הצג'
        )
    ) {
        renderArchiveSection();
    }
}

function openResetModal() {
    openConfirmModal(
        'איפוס הרגלים לדוגמה?',
        'האם לשחזר את רשימת ההרגלים והקטגוריות לדוגמה ואת נתוני השבוע הנוכחי?',
        () => {
            setWeek(0);
            tracker.selectedCategory = 'הכל';
            manage.selectedCategory = 'הכל';
            tracker.selectedDateKey = getDateKeyDaysAgo(0);
            Store.resetToDefaults(getDefaultHabits);
            showToast('נתוני הדוגמה שוחזרו');
            renderAll();
        }
    );
}

function openConfirmModal(title, message, onConfirm, options = {}) {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalText').textContent = message;
    const actionBtn = document.getElementById('confirmModalActionBtn');
    actionBtn.textContent = options.confirmLabel || 'אישור';
    const hasAlt = !!(options.altLabel && typeof options.onAlt === 'function');
    confirmHandlers = { onConfirm, onAlt: hasAlt ? options.onAlt : null };
    const altBtn = document.getElementById('confirmModalAltBtn');
    if (altBtn) {
        if (hasAlt) {
            altBtn.textContent = options.altLabel;
            altBtn.classList.remove('hidden');
        } else {
            altBtn.classList.add('hidden');
        }
    }
    showModal(document.getElementById('confirmModalBackdrop'));
}

function closeConfirmModal() {
    hideModal(document.getElementById('confirmModalBackdrop'));
}

// A second click while the dialog closes can't run the action twice
let confirmHandlers = { onConfirm: null, onAlt: null };
function runConfirm(which) {
    const fn = confirmHandlers[which];
    if (!fn) return;
    confirmHandlers = { onConfirm: null, onAlt: null };
    closeConfirmModal();
    fn();
}

wireToastPause();

wireSystemTheme();

wireCustomSelectDismiss();

function enhanceDateInput(input, title, customOpen) {
    if (input.dataset.enhanced) return;
    input.dataset.enhanced = '1';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${input.id}_trigger`;
    trigger.className =
        input.className.replace('habit-date-input', '').replace(/\bblock\b/, '') +
        ' flex items-center justify-between gap-2 text-right';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.innerHTML = `<span class="truncate min-w-0" data-label></span>${CALENDAR_SVG}`;
    input.classList.add('hidden');
    input.tabIndex = -1;
    input.after(trigger);
    relabel(input.id, trigger.id);

    const sync = () => {
        const label = input.dataset.compact ? formatDateCompactLabel(input.value) : formatDateTriggerLabel(input.value);
        const el = trigger.querySelector('[data-label]');
        el.textContent = label || 'בחירת תאריך';
        el.classList.toggle('text-slate-500', !label);
        el.classList.toggle('dark:text-slate-400', !label);
    };
    watchValue(input, sync);
    input.addEventListener('change', sync);
    sync();

    trigger.addEventListener('click', e => {
        e.stopPropagation();
        closeCustomSelect(false);
        if (customOpen) {
            customOpen(input);
            return;
        }
        openDatePicker({
            value: input.value,
            min: input.min || null,
            max: input.max || null,
            title,
            onPick: key => {
                if (input.value === key) return;
                input.value = key;
                fireChange(input);
            }
        });
    });
}

function enhanceFormControls() {
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
