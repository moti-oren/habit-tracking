// Temporary: the original app script, moved here unchanged (minus the IIFE wrapper, which a
// module scope makes redundant). It is split into modules step by step; see docs/REFACTOR_PLAN.md.
/* eslint-disable no-unused-vars -- dead locals are removed when each area is extracted */

import { ANALYTICS_PRESETS, MAX_RANGE_DAYS } from './config/analytics.js';
import { UNCATEGORIZED_LABEL } from './config/categories.js';
import { COLOR_OPTIONS, getColorMeta } from './config/colors.js';
import { HEBREW_DAYS_FULL, HEBREW_DAYS_SHORT, HEBREW_MONTHS, HEBREW_MONTHS_FULL } from './config/hebrew.js';
import { ICON_OPTIONS, MORE_ICONS } from './config/icons.js';
import { DAY_PARTS, MAX_SLOTS } from './config/schedule.js';
import { formatRangeLabel, getPresetRange, getPreviousRangeBounds } from './core/analytics-range.js';
import {
    addDaysToKey,
    buildDaysForRange,
    dayNumOf,
    dayObjForKey,
    daysBetweenKeys,
    dowOfDayNum,
    formatDateKey,
    getDateKeyDaysAgo,
    getWindow7Days,
    isFutureDateKey,
    isValidDateKey,
    parseDateKeyLocal,
    splitDaysIntoWeeks,
    todayDayNum
} from './core/dates.js';
import {
    describeScheduleVersion,
    formatDateCompactLabel,
    formatDateTriggerLabel,
    formatDaySet,
    formatStartDateLabel,
    formatWeekRangeText,
    getGreetingByHour,
    getHabitGoalLabel,
    getHabitStreakUnit,
    habitCountLabel,
    scheduleTimeSummary
} from './core/format.js';
import {
    getEarliestCheckedKey,
    getHabitCategoryDisplay,
    hasAnyMarkOnDay,
    isHabitActiveInDays,
    isHabitActiveOnKey,
    isHabitArchived,
    isSlotDone
} from './core/habit.js';
import {
    getScheduleVersion,
    habitOn,
    hasAnyTime,
    isFlexibleOnKey,
    isHabitScheduledForDayOfWeek,
    isHabitScheduledOnKey,
    normalizeScheduleFields,
    sameScheduleFields,
    scheduleWeekdays,
    slotCount
} from './core/schedule.js';
import { compareByName } from './core/sort.js';
import { getWeeklyCountForHabit, getWeeklyGoalForHabit } from './core/stats.js';
import { getGraphemes } from './core/text.js';
import { dayPartOf, timeRangeText, timeToMinutes } from './core/time.js';
import { getDefaultHabits } from './store/sample-habits.js';
import {
    calculateBestStreak,
    calculateStreak,
    findTimeOverlaps,
    getDayStats,
    getHabitRangeProgress,
    getHabitStreakLongText,
    getHabitStreakText,
    getLiveHabits
} from './store/selectors.js';
import { Store } from './store/store.js';
import { escapeHtml, timeRangeHtml } from './ui/dom/html.js';

// One icon language for the whole UI: 24px stroke SVGs (emoji are kept only for habit icons)
const ICON_PATHS = {
    check: 'M5 13l4 4L19 7',
    x: 'M6 18L18 6M6 6l12 12',
    chevronDown: 'M19 9l-7 7-7-7',
    arrowUp: 'M12 19V5m0 0l-6 6m6-6l6 6',
    arrowDown: 'M12 5v14m0 0l6-6m-6 6l-6-6',
    star: 'M11.48 3.5a.56.56 0 011.04 0l2.13 5.11 5.52.44c.5.04.7.66.32.98l-4.2 3.6 1.28 5.38a.56.56 0 01-.84.61L12 16.73l-4.73 2.89a.56.56 0 01-.84-.61l1.28-5.38-4.2-3.6a.56.56 0 01.32-.98l5.52-.44 2.13-5.11z'
};
function icon(name, cls = 'w-4 h-4', strokeWidth = 2.5) {
    return `<svg class="${cls} shrink-0 inline-block" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${ICON_PATHS[name]}"/></svg>`;
}

let soundEnabled = true;
const systemDarkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let isDarkMode = systemDarkQuery ? systemDarkQuery.matches : false;
let themeChosenByUser = false; // until the user toggles, the app follows the device theme
let audioCtx = null;
let weekOffset = 0;
let currentMainSection = 'tracker'; // 'tracker' | 'analytics' | 'manage'
let calendarViewYear = new Date().getFullYear();
let calendarViewMonth = new Date().getMonth();
let calendarViewMode = 'month'; // 'month' | 'year'

// The audio context is created on the first sound, suspended while the tab is hidden
// (no audio thread running in the background), and resumed by the next sound.
function suspendAudio() {
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend().catch(() => {});
}

function playFeedbackSound(type = 'check') {
    if (!soundEnabled) return;
    try {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContext();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'check') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.09);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'uncheck') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(260, now + 0.08);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'celebrate') {
            const notes = [523.25, 659.25, 783.99, 1046.5];
            notes.forEach((freq, idx) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.type = 'triangle';
                o.connect(g);
                g.connect(audioCtx.destination);
                o.frequency.setValueAtTime(freq, now + idx * 0.06);
                g.gain.setValueAtTime(0.1, now + idx * 0.06);
                g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);
                o.start(now + idx * 0.06);
                o.stop(now + idx * 0.06 + 0.19);
            });
        }
    } catch (e) {}
}

let weekDays = getWindow7Days(0);
let selectedDateKey = getDateKeyDaysAgo(0);
let lastKnownTodayKey = getDateKeyDaysAgo(0);
let currentViewMode = 'focus';
let trackerSelectedCategory = 'הכל';
let manageSelectedCategory = 'הכל';
let unscheduledSectionExpanded = false;
const focusOrderCache = { key: null, ids: [] };
let lastToggledHabitId = null;
// Motion hints for the next render only: what just changed, so only that animates
let lastToggle = null; // { id, key, on }
let celebrateDayKey = null; // a day that just became 100%
const prevRingPct = {}; // day key -> % shown in the day strip ring last time
let lastActionUndoSnapshot = null;
let selectedModalIcon = ICON_OPTIONS[0].emoji;
let selectedModalColor = COLOR_OPTIONS[0].id;
let selectedModalGoalType = 'daily';
let selectedModalFixedDays = [0, 2, 4];
let editingCategoryName = null;

function applyThemeUI(dark) {
    isDarkMode = !!dark;
    const html = document.documentElement;
    html.classList.toggle('dark', isDarkMode);
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
        themeBtn.setAttribute('aria-pressed', String(isDarkMode));
        themeBtn.setAttribute(
            'aria-label',
            isDarkMode ? 'מצב כהה פעיל. מעבר למצב בהיר' : 'מצב בהיר פעיל. מעבר למצב כהה'
        );
        themeBtn.title = isDarkMode ? 'מעבר למצב בהיר' : 'מעבר למצב כהה';
    }
    const container = document.getElementById('themeIconContainer');
    if (container) {
        container.className = isDarkMode ? 'text-amber-400' : 'text-slate-700';
        container.innerHTML = isDarkMode
            ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>';
    }
}

function applySoundUI(enabled) {
    soundEnabled = !!enabled;
    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
        soundBtn.setAttribute('aria-pressed', String(soundEnabled));
        soundBtn.setAttribute('aria-label', soundEnabled ? 'צלילי משוב פעילים. השתקה' : 'צלילי משוב מושתקים. הפעלה');
        soundBtn.title = soundEnabled ? 'השתקת צלילים' : 'הפעלת צלילים';
    }
    const container = document.getElementById('soundIconContainer');
    if (container) {
        container.className = soundEnabled
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-500 dark:text-slate-400';
        container.innerHTML = soundEnabled
            ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>';
    }
}

// ===== Sliding pill: one background that glides to the active option of a segmented control =====
// The active option is whichever child has aria-current="page", aria-selected="true" or aria-pressed="true".
// Several controls are measured together: all DOM writes that change layout first, then every
// read in one layout pass, then all the style writes (no read/write interleaving).
function updateSegPills(containers) {
    const items = [];
    Array.from(containers).forEach(container => {
        if (!container || !container.classList || !container.classList.contains('seg')) return;
        let pill = container._pill;
        if (!pill) {
            pill = document.createElement('span');
            pill.className = `seg-pill seg-pill--${container.dataset.seg || 'raised'}`;
            pill.setAttribute('aria-hidden', 'true');
            container._pill = pill;
        }
        if (pill.parentElement !== container) container.prepend(pill); // survives innerHTML re-renders
        items.push({
            container,
            pill,
            active: container.querySelector('[aria-current="page"], [aria-selected="true"], [aria-pressed="true"]')
        });
    });
    // read
    items.forEach(item => {
        item.visible = !!item.active && item.container.offsetWidth !== 0;
        if (item.visible) {
            const a = item.active;
            item.box = { w: a.offsetWidth, h: a.offsetHeight, x: a.offsetLeft, y: a.offsetTop };
        }
    });
    // write
    const firstPlacement = [];
    items.forEach(({ pill, visible, box }) => {
        if (!visible) {
            pill.style.opacity = '0';
            pill.dataset.ready = '';
            return;
        }
        // first placement (or after being hidden): jump into place, don't slide in from the corner
        if (!pill.dataset.ready) {
            pill.classList.add('no-anim');
            firstPlacement.push(pill);
        }
        pill.style.width = `${box.w}px`;
        pill.style.height = `${box.h}px`;
        pill.style.transform = `translate(${box.x}px, ${box.y}px)`;
        pill.style.opacity = '1';
    });
    if (firstPlacement.length) {
        void firstPlacement[0].offsetWidth; // one reflow for all of them
        firstPlacement.forEach(pill => {
            pill.classList.remove('no-anim');
            pill.dataset.ready = '1';
        });
    }
}

function updateSegPill(container) {
    updateSegPills([container]);
}

// Re-measure when a control appears (e.g. inside a modal that just opened) or the layout changes
const segResizeObserver =
    typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(entries => updateSegPills(entries.map(e => e.target)))
        : null;
document.addEventListener('DOMContentLoaded', () => {
    const segs = document.querySelectorAll('.seg');
    updateSegPills(segs);
    if (segResizeObserver) segs.forEach(el => segResizeObserver.observe(el));
});

function applyViewModeButtonsUI(mode) {
    const focusBtn = document.getElementById('viewModeFocusBtn');
    const gridBtn = document.getElementById('viewModeGridBtn');
    if (!focusBtn || !gridBtn) return;
    if (mode === 'focus') {
        focusBtn.className = 'tap-44 h-9 px-3.5 rounded-lg text-slate-900 dark:text-white flex items-center gap-1.5';
        gridBtn.className =
            'tap-44 h-9 px-3.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5';
    } else {
        gridBtn.className = 'tap-44 h-9 px-3.5 rounded-lg text-slate-900 dark:text-white flex items-center gap-1.5';
        focusBtn.className =
            'tap-44 h-9 px-3.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5';
    }
    focusBtn.setAttribute('aria-pressed', String(mode === 'focus'));
    gridBtn.setAttribute('aria-pressed', String(mode !== 'focus'));
    updateSegPill(focusBtn.parentElement);
}

// Preferences ride along with every data commit (as before) and are saved on their own for UI-only changes
function currentPrefs() {
    return {
        ...(themeChosenByUser ? { isDarkMode } : {}),
        soundEnabled,
        currentViewMode,
        currentMainSection,
        analyticsRange: analyticsRangeState,
        analyticsFilter
    };
}

function savePrefs() {
    Store.savePrefs(currentPrefs());
}

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
            isDarkMode = prefs.isDarkMode;
            themeChosenByUser = true;
        }
        if (typeof prefs.soundEnabled === 'boolean') soundEnabled = prefs.soundEnabled;
        if (prefs.currentViewMode === 'focus' || prefs.currentViewMode === 'grid') {
            currentViewMode = prefs.currentViewMode;
        }
        if (['tracker', 'analytics', 'manage'].includes(prefs.currentMainSection)) {
            currentMainSection = prefs.currentMainSection;
        }
        restoreAnalyticsRange(prefs.analyticsRange);
        if (typeof prefs.analyticsFilter === 'string') analyticsFilter = prefs.analyticsFilter;
    }

    // Always open on Today (reset weekOffset & selectedDateKey, and reset filters to 'הכל')
    weekOffset = 0;
    weekDays = getWindow7Days(0);
    selectedDateKey = getDateKeyDaysAgo(0);
    lastKnownTodayKey = selectedDateKey;
    trackerSelectedCategory = 'הכל';
    manageSelectedCategory = 'הכל';

    ensureAnalyticsRange(); // concrete dates from the start, even before analytics is first drawn

    applyThemeUI(isDarkMode);
    applySoundUI(soundEnabled);
    applyViewModeButtonsUI(currentViewMode);

    Store.load(getDefaultHabits);
}

function createUndoSnapshot() {
    return {
        data: Store.snapshot(),
        trackerSelectedCategory,
        manageSelectedCategory
    };
}
function triggerToastUndo() {
    if (!lastActionUndoSnapshot) return;
    const snap = lastActionUndoSnapshot;
    lastActionUndoSnapshot = null;
    trackerSelectedCategory = snap.trackerSelectedCategory || 'הכל';
    manageSelectedCategory = snap.manageSelectedCategory || 'הכל';
    Store.restore(snap.data);
    populateCategorySelectDropdown();
    withFlip(() => renderAll());
    renderCategoryManagerItems();
    showToast('הפעולה בוטלה והמצב הקודם שוחזר');
}

function checkDayRollover() {
    const nowTodayKey = getDateKeyDaysAgo(0);
    if (nowTodayKey !== lastKnownTodayKey) {
        lastKnownTodayKey = nowTodayKey;
        weekOffset = 0;
        weekDays = getWindow7Days(0);
        selectedDateKey = nowTodayKey;
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
    editingCategoryName = catName;
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
    editingCategoryName = null;
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

    if (trackerSelectedCategory === oldName) {
        trackerSelectedCategory = newName;
    }
    if (manageSelectedCategory === oldName) {
        manageSelectedCategory = newName;
    }
    editingCategoryName = null;
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
        if (trackerSelectedCategory === catName) {
            trackerSelectedCategory = 'הכל';
        }
        if (manageSelectedCategory === catName) {
            manageSelectedCategory = 'הכל';
        }
        editingCategoryName = null;
        Store.deleteCategories([catName]);
        populateCategorySelectDropdown();
        renderAll();
        renderCategoryManagerItems();
        showToast(`הקטגוריה "${catName}" נמחקה`, snapshot);
    });
}

// ===== Modals: animated open/close, focus in and back out, Escape, Tab stays inside =====
const openModalStack = [];
const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getVisibleFocusables(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length > 0 && !el.closest('.hidden'));
}

function showModal(el) {
    if (!el) return;
    clearTimeout(el._closeTimer);
    const wasOpen = el.classList.contains('flex') && !el.classList.contains('is-closing');
    el.classList.remove('is-closing', 'hidden');
    el.classList.add('flex');
    const idx = openModalStack.indexOf(el);
    if (idx !== -1) openModalStack.splice(idx, 1);
    openModalStack.push(el);
    if (!wasOpen && !el.contains(document.activeElement)) el._returnFocus = document.activeElement;
    requestAnimationFrame(() => {
        if (el.contains(document.activeElement)) return;
        const target = el.querySelector('[data-autofocus]') || getVisibleFocusables(el)[0];
        if (target) target.focus({ preventScroll: true });
    });
}

function hideModal(el) {
    if (!el || el.classList.contains('hidden') || el.classList.contains('is-closing')) return;
    const idx = openModalStack.indexOf(el);
    if (idx !== -1) openModalStack.splice(idx, 1);
    const focusWasInside = el.contains(document.activeElement) || document.activeElement === document.body;
    const finish = () => {
        el.classList.add('hidden');
        el.classList.remove('flex', 'is-closing');
    };
    if (prefersReducedMotion()) {
        finish();
    } else {
        el.classList.add('is-closing');
        el._closeTimer = setTimeout(finish, 180);
    }
    const back = el._returnFocus;
    el._returnFocus = null;
    if (focusWasInside && back && document.contains(back) && back.getClientRects().length) {
        back.focus({ preventScroll: true });
    }
}

// A click on the dimmed area of a decision dialog doesn't dismiss it; the panel shakes instead
function nudgeModal(el) {
    const panel = el && el.querySelector('.modal-panel');
    if (!panel || prefersReducedMotion()) return;
    panel.classList.remove('is-shaking');
    void panel.offsetWidth;
    panel.classList.add('is-shaking');
    setTimeout(() => panel.classList.remove('is-shaking'), 240);
}

const MODAL_CLOSERS = {
    habitModalBackdrop: () => closeHabitModal(),
    categoryModalBackdrop: () => closeCategoryManagerModal(),
    fullCalendarModalBackdrop: () => closeFullCalendarModal(),
    confirmModalBackdrop: () => closeConfirmModal()
};

document.addEventListener('keydown', e => {
    const top = openModalStack[openModalStack.length - 1];
    if (!top || habitDragState.active) return;
    if (e.key === 'Escape') {
        if (openSelectState || document.querySelector('[data-menu-panel]:not(.hidden):not(.is-closing)')) return; // the open list closes first
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

function openCategoryManagerModal() {
    editingCategoryName = null;
    categorySelectMode = false;
    selectedCategories.clear();
    renderCategoryManagerItems();
    showModal(document.getElementById('categoryModalBackdrop'));
}

function closeCategoryManagerModal() {
    editingCategoryName = null;
    categorySelectMode = false;
    selectedCategories.clear();
    hideModal(document.getElementById('categoryModalBackdrop'));
    renderAll();
}

function buildCategoryItemRowHtml(cat) {
    const count = Store.habits.filter(h => h.category === cat).length;
    const isEditing = editingCategoryName === cat;

    if (categorySelectMode) {
        const sel = selectedCategories.has(cat);
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
    selectedCategories.forEach(c => {
        if (!Store.categories.includes(c)) selectedCategories.delete(c);
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

function switchMainSection(section) {
    if (section !== 'manage' && manageSelectMode) {
        manageSelectMode = false;
        selectedHabitIds.clear();
    }
    currentMainSection = section;
    focusOrderCache.key = null;
    const sections = ['tracker', 'analytics', 'manage'];

    sections.forEach(s => {
        const sectionEl = document.getElementById(`section_${s}`);
        if (sectionEl) {
            sectionEl.classList.toggle('hidden', s !== section);
        }

        // Desktop Nav Button styling
        const navBtn = document.getElementById(`navTab_${s}`);
        if (navBtn) {
            if (s === section) navBtn.setAttribute('aria-current', 'page');
            else navBtn.removeAttribute('aria-current');
            if (s === section) {
                navBtn.className =
                    'h-10 px-4 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 text-indigo-700 dark:text-indigo-300';
            } else {
                navBtn.className =
                    'h-10 px-4 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-2';
            }
        }

        // Mobile Bottom Nav styling
        const mobileBtn = document.getElementById(`mobileNav_${s}`);
        if (mobileBtn) {
            if (s === section) mobileBtn.setAttribute('aria-current', 'page');
            else mobileBtn.removeAttribute('aria-current');
            if (s === section) {
                mobileBtn.className =
                    'flex flex-col items-center justify-center py-2 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition';
            } else {
                mobileBtn.className =
                    'flex flex-col items-center justify-center py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition';
            }
        }
    });

    if (section === 'analytics') analyticsEntryAnim = true;
    // restart the icon bounce: remove everywhere, one reflow, add everywhere
    const navIcons = [...document.querySelectorAll(`#navTab_${section} svg, #mobileNav_${section} svg`)];
    navIcons.forEach(svg => svg.classList.remove('nav-bounce'));
    if (navIcons.length) void navIcons[0].getBoundingClientRect();
    navIcons.forEach(svg => svg.classList.add('nav-bounce'));
    updateSegPills(document.querySelectorAll('.seg'));

    savePrefs();
    renderGreeting();
    renderSection(section, { force: true, entry: true });
}

function selectDay(dateKey, jumpToTracker = false) {
    if (isFutureDateKey(dateKey)) {
        showToast('לא ניתן לבחור תאריך שעוד לא הגיע');
        return;
    }
    selectedDateKey = dateKey;
    if (jumpToTracker && currentMainSection !== 'tracker') {
        switchMainSection('tracker');
        showToast('עברתם לסימון הרגלים עבור היום שנבחר');
        return;
    }
    renderAll();
}

function setViewMode(mode) {
    currentViewMode = mode;
    applyViewModeButtonsUI(mode);
    savePrefs();
    renderHabitsList();
}

let pendingWeekSlide = null; // 'prev' | 'next' for the next render of the day strip
let pendingCalSlide = null; // 'prev' | 'next' | 'zoom-in' | 'zoom-out' for the calendar grid

// Restart CSS animations on several elements with a single forced reflow
const RESTARTABLE_ANIMATIONS = ['slide-from-prev', 'slide-from-next', 'zoom-in', 'zoom-out', 'fade-in-quick'];
function restartAnimationClasses(pairs) {
    if (prefersReducedMotion()) return;
    const list = pairs.filter(([el]) => el);
    if (!list.length) return;
    list.forEach(([el]) => el.classList.remove(...RESTARTABLE_ANIMATIONS));
    void list[0][0].offsetWidth;
    list.forEach(([el, cls]) => el.classList.add(cls));
}

function restartAnimationClass(el, cls) {
    restartAnimationClasses([[el, cls]]);
}

function shiftWeek(delta) {
    const nextOffset = weekOffset + delta;
    if (nextOffset > 0) return;
    pendingWeekSlide = delta < 0 ? 'prev' : 'next';
    weekOffset = nextOffset;
    weekDays = getWindow7Days(weekOffset);
    const todayMatch = weekDays.find(d => d.isToday);
    selectedDateKey = todayMatch ? todayMatch.key : weekDays[0].key;
    renderAll();
}

function jumpToToday() {
    if (weekOffset < 0) pendingWeekSlide = 'next';
    weekOffset = 0;
    weekDays = getWindow7Days(0);
    selectedDateKey = getDateKeyDaysAgo(0);
    renderAll();
    showToast('חזרתם לשבוע הנוכחי (היום)');
}

function openFullCalendarModal() {
    calendarPicker = null;
    applyCalendarModeChrome();
    const parts = selectedDateKey.split('-').map(Number);
    if (parts.length === 3) {
        calendarViewYear = parts[0];
        calendarViewMonth = parts[1] - 1;
    } else {
        const now = new Date();
        calendarViewYear = now.getFullYear();
        calendarViewMonth = now.getMonth();
    }
    calendarViewMode = 'month';
    renderFullCalendarGrid();
    showModal(document.getElementById('fullCalendarModalBackdrop'));
}

function closeFullCalendarModal() {
    hideModal(document.getElementById('fullCalendarModalBackdrop'));
    if (calendarPicker) {
        calendarPicker = null;
        // keep the picker header until the closing animation ends, so it doesn't swap mid-fade
        setTimeout(() => {
            if (!calendarPicker) applyCalendarModeChrome();
        }, 200);
    }
}

// ---- Date-picker mode: the same calendar, used to pick a date for a form field ----
let calendarPicker = null; // { value, min, max, title, onPick, returnFocus }
const calendarChromeDefaults = {};

function calendarMaxKey() {
    return calendarPicker ? calendarPicker.max || null : getDateKeyDaysAgo(0);
}
function calendarMinKey() {
    return calendarPicker ? calendarPicker.min || null : null;
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
    if (calendarPicker && calendarPicker.range) {
        const a = calendarPicker.anchor;
        title.textContent = a ? 'בחרו תאריך סיום' : 'בחרו תאריך התחלה';
        sub.textContent = a
            ? `מ-${formatDateTriggerLabel(a)} · הקישו על היום האחרון בטווח (יום מוקדם יותר יהפוך להתחלה)`
            : 'הקישו על היום הראשון בטווח, ואחר כך על היום האחרון';
        footer.classList.add('hidden');
    } else if (calendarPicker) {
        title.textContent = calendarPicker.title || 'בחירת תאריך';
        sub.textContent = 'הקישו על יום כדי לבחור אותו';
        footer.classList.add('hidden');
    } else {
        title.innerHTML = calendarChromeDefaults.title;
        sub.innerHTML = calendarChromeDefaults.sub;
        footer.classList.remove('hidden');
    }
}

function openDatePicker(opts) {
    calendarPicker = { ...opts, returnFocus: document.activeElement };
    const base = isValidDateKey(opts.value)
        ? opts.value
        : opts.max && opts.max < getDateKeyDaysAgo(0)
          ? opts.max
          : getDateKeyDaysAgo(0);
    const [y, m] = base.split('-').map(Number);
    calendarViewYear = y;
    calendarViewMonth = m - 1;
    calendarViewMode = 'month';
    applyCalendarModeChrome();
    renderFullCalendarGrid();
    showModal(document.getElementById('fullCalendarModalBackdrop'));
}

// Range mode: first tap sets the start, hovering previews the span, second tap sets the end.
function openRangePicker(opts) {
    calendarPicker = { ...opts, range: true, anchor: null, returnFocus: document.activeElement };
    const base = isValidDateKey(opts.focusKey)
        ? opts.focusKey
        : isValidDateKey(opts.end)
          ? opts.end
          : getDateKeyDaysAgo(0);
    const [y, m] = base.split('-').map(Number);
    calendarViewYear = y;
    calendarViewMonth = m - 1;
    calendarViewMode = 'month';
    applyCalendarModeChrome();
    renderFullCalendarGrid();
    showModal(document.getElementById('fullCalendarModalBackdrop'));
}

function paintRangePreview(hoverKey) {
    const grid = document.getElementById('fullCalendarGrid');
    const p = calendarPicker;
    if (!grid || !p || !p.range || !p.anchor) return;
    const a = p.anchor;
    const active = hoverKey && hoverKey > a;
    grid.querySelectorAll('[data-cal-key]').forEach(btn => {
        const k = btn.dataset.calKey;
        btn.classList.toggle('cal-in-range', !!active && k > a && k < hoverKey);
        btn.classList.toggle('cal-range-end', !!active && k === hoverKey);
    });
}

(function wireRangePreview() {
    const grid = document.getElementById('fullCalendarGrid');
    if (!grid) return;
    const keyFrom = e => {
        const btn = e.target.closest && e.target.closest('[data-cal-key]');
        return btn && !btn.disabled ? btn.dataset.calKey : null;
    };
    grid.addEventListener('mouseover', e => paintRangePreview(keyFrom(e)));
    grid.addEventListener('focusin', e => paintRangePreview(keyFrom(e)));
    grid.addEventListener('mouseleave', () => paintRangePreview(null));
})();

function handleCalendarDayClick(dateKey) {
    if (calendarPicker && calendarPicker.range) {
        if (!isCalendarKeyAllowed(dateKey)) return;
        const p = calendarPicker;
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
    if (calendarPicker) {
        if (!isCalendarKeyAllowed(dateKey)) return;
        const pick = calendarPicker.onPick;
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
    return calendarViewYear > my || (calendarViewYear === my && calendarViewMonth >= mm - 1);
}

function shiftCalendarMonth(delta) {
    pendingCalSlide = delta < 0 ? 'prev' : 'next';
    if (calendarViewMode === 'year') {
        if (delta > 0 && calendarMaxKey() && calendarViewYear >= Number(calendarMaxKey().slice(0, 4))) return;
        calendarViewYear += delta;
        renderFullCalendarGrid();
        return;
    }
    if (delta > 0 && isCalendarViewAtCurrentMonth()) return;
    calendarViewMonth += delta;
    if (calendarViewMonth > 11) {
        calendarViewMonth = 0;
        calendarViewYear++;
    } else if (calendarViewMonth < 0) {
        calendarViewMonth = 11;
        calendarViewYear--;
    }
    renderFullCalendarGrid();
}

function toggleCalendarYearView() {
    pendingCalSlide = calendarViewMode === 'month' ? 'zoom-out' : 'zoom-in';
    if (calendarViewMode === 'month') {
        calendarViewMode = 'year';
    } else {
        // Back to month view; clamp to the current month if the shown year is the current one
        const max = calendarMaxKey();
        if (max) {
            const [my, mm] = max.split('-').map(Number);
            if (calendarViewYear === my && calendarViewMonth > mm - 1) calendarViewMonth = mm - 1;
        }
        calendarViewMode = 'month';
    }
    renderFullCalendarGrid();
}

function openCalendarMonthFromYear(monthIdx) {
    pendingCalSlide = 'zoom-in';
    calendarViewMonth = monthIdx;
    calendarViewMode = 'month';
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
        const monthFirstKey = formatDateKey(new Date(calendarViewYear, m, 1));
        const monthLastKey = formatDateKey(new Date(calendarViewYear, m + 1, 0));
        const isFutureMonth =
            (calendarMaxKey() && monthFirstKey > calendarMaxKey()) ||
            (calendarMinKey() && monthLastKey < calendarMinKey());
        const isCurrentMonth = calendarViewYear === now.getFullYear() && m === now.getMonth();
        const startWeekday = new Date(calendarViewYear, m, 1).getDay();
        const daysInMonth = new Date(calendarViewYear, m + 1, 0).getDate();

        let perfectInMonth = 0;
        let daysHtml = '';
        for (let i = 0; i < startWeekday; i++) daysHtml += '<span></span>';

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(calendarViewYear, m, d);
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
            <button type="button" ${isFutureMonth ? 'disabled' : `data-action="openMonthFromYear" data-arg="${m}"`} data-current-month="${isCurrentMonth ? '1' : ''}" aria-label="${HEBREW_MONTHS_FULL[m]} ${calendarViewYear}" class="flex flex-col justify-start text-right p-2.5 sm:p-3 rounded-xl border transition ${
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
            calendarViewYear > now.getFullYear()
                ? 'שנה עתידית'
                : `${perfectDaysInYear} ימים מושלמים ב-${calendarViewYear}`;
    }
}

function jumpCalendarToCurrentMonth() {
    calendarViewMode = 'month';
    const now = new Date();
    calendarViewYear = now.getFullYear();
    calendarViewMonth = now.getMonth();
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
    if (newOffset !== weekOffset) pendingWeekSlide = newOffset < weekOffset ? 'prev' : 'next';
    weekOffset = newOffset;
    weekDays = getWindow7Days(weekOffset);
    selectedDateKey = dateKey;
    closeFullCalendarModal();
    if (currentMainSection !== 'tracker') {
        switchMainSection('tracker');
    } else {
        renderAll();
    }
}

function renderFullCalendarGrid() {
    const calSlide = pendingCalSlide;
    pendingCalSlide = null;
    const playCalSlide = () => {
        if (!calSlide) return;
        const target =
            calendarViewMode === 'year'
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

    const isYear = calendarViewMode === 'year';
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
        titleEl.textContent = `${calendarViewYear}`;
        if (nextBtn) nextBtn.disabled = !!calendarMaxKey() && calendarViewYear >= Number(calendarMaxKey().slice(0, 4));
        renderCalendarYearView();
        playCalSlide();
        return;
    }

    titleEl.textContent = `${HEBREW_MONTHS_FULL[calendarViewMonth]} ${calendarViewYear}`;
    if (nextBtn) nextBtn.disabled = isCalendarViewAtCurrentMonth();

    const firstDay = new Date(calendarViewYear, calendarViewMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(calendarViewYear, calendarViewMonth + 1, 0).getDate();
    const todayIso = getDateKeyDaysAgo(0);

    let cellsHtml = '';
    for (let i = 0; i < startWeekday; i++) {
        cellsHtml += `<div class="h-16 sm:h-20 rounded-xl bg-slate-50/40 dark:bg-slate-800/20 border border-transparent"></div>`;
    }

    let perfectDaysInMonth = 0;
    let elapsedDaysInMonth = 0;

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
        const dateObj = new Date(calendarViewYear, calendarViewMonth, dayNum);
        const dateKey = formatDateKey(dateObj);
        const isToday = dateKey === todayIso;
        const rp = calendarPicker && calendarPicker.range ? calendarPicker : null;
        const isSelected = rp
            ? rp.anchor
                ? dateKey === rp.anchor
                : dateKey === rp.start || dateKey === rp.end
            : dateKey === (calendarPicker ? calendarPicker.value : selectedDateKey);
        const isInRange = !!rp && !rp.anchor && !!rp.start && !!rp.end && dateKey > rp.start && dateKey < rp.end;
        const isFuture = !isCalendarKeyAllowed(dateKey);

        const stats = getDayStats({ key: dateKey, dateObj });
        const isRestDay = stats.totalScheduled === 0;
        if (!isFuture && !isRestDay) {
            elapsedDaysInMonth++;
            if (stats.allDone) perfectDaysInMonth++;
        }

        cellsHtml += `
            <button type="button" data-cal-key="${dateKey}" ${isFuture ? 'disabled' : `data-action="calendarDay"`} aria-pressed="${isSelected ? 'true' : 'false'}" ${isToday ? 'aria-current="date"' : ''} aria-label="${HEBREW_DAYS_FULL[dateObj.getDay()]}, ${dayNum} ב${HEBREW_MONTHS_FULL[calendarViewMonth]}${isFuture ? ', לא זמין' : isRestDay ? ', אין יעדים' : `, ${stats.doneScheduled} מתוך ${stats.totalScheduled} הושלמו`}" class="h-14 sm:h-20 p-1.5 sm:p-2 rounded-xl border flex flex-col justify-between text-right transition relative ${isInRange && !isFuture ? 'cal-in-range' : ''} ${
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
    const targetContext = context || (currentMainSection === 'manage' ? 'manage' : 'tracker');
    if (targetContext === 'manage') {
        manageSelectedCategory = category;
    } else {
        trackerSelectedCategory = category;
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

function renderHeaderDateStrip() {
    renderGreeting();

    const first = weekDays[0];
    const last = weekDays[6];
    const formattedRange = formatWeekRangeText(first, last);

    const nextWeekBtn = document.getElementById('nextWeekBtn');
    if (nextWeekBtn) nextWeekBtn.disabled = weekOffset >= 0;
    const rangeLabel = document.getElementById('weekRangeLabel');
    if (rangeLabel) rangeLabel.textContent = weekOffset === 0 ? `השבוע · ${formattedRange}` : formattedRange;

    const strip = document.getElementById('daySelectorStrip');
    if (!strip) return;
    const weekSlide = pendingWeekSlide;
    pendingWeekSlide = null;

    patchHTML(
        strip,
        weekDays
            .map(day => {
                const isSelected = day.key === selectedDateKey;
                const { totalScheduled, pct, allDone } = getDayStats(day);
                const ringPct = day.isFuture || totalScheduled === 0 ? 0 : pct;
                const ringLen = 37.7; // 2 * PI * 6
                const prevPct = renderingEntry ? undefined : prevRingPct[day.key];
                prevRingPct[day.key] = ringPct;
                const ringAnim =
                    prevPct !== undefined && prevPct !== ringPct
                        ? `ring-fill" style="--ring-from:${(ringLen - (prevPct / 100) * ringLen).toFixed(2)}`
                        : '';
                const ringColor = isSelected
                    ? allDone
                        ? 'text-emerald-300'
                        : 'text-white'
                    : allDone
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-indigo-500';
                const trackColor = isSelected ? 'text-white/25' : 'text-slate-200 dark:text-slate-700';
                const ring = day.isFuture
                    ? '<span class="block w-3.5 h-3.5 sm:w-4 sm:h-4"></span>'
                    : `<svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 -rotate-90" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2.5" class="${trackColor}"></circle>
                    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="${ringLen}" stroke-dashoffset="${ringLen - (ringPct / 100) * ringLen}" class="${ringPct > 0 || (ringAnim && prevPct > 0) ? ringColor : 'text-transparent'} ${ringAnim}"></circle>
                </svg>`;

                return `
            <button type="button" ${day.isFuture ? 'disabled' : `data-action="selectDay" data-key="${day.key}"`} data-tip="${day.isFuture ? 'תאריך עתידי — לא ניתן לבחור' : `${day.dayFull} · ${totalScheduled > 0 ? `${pct}%` : 'אין יעדים מתוכננים'}`}" aria-pressed="${isSelected ? 'true' : 'false'}" ${day.isToday ? 'aria-current="date"' : ''} aria-label="${day.isToday ? 'היום, ' : ''}${day.dayFull}, ${day.dayNum} ב${HEBREW_MONTHS_FULL[day.dateObj.getMonth()]}${day.isFuture ? ', תאריך עתידי' : totalScheduled > 0 ? `, ${pct}% הושלמו` : ', אין יעדים'}" class="${day.key === celebrateDayKey ? 'day-celebrate' : ''} relative flex flex-col items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 rounded-xl transition-colors text-center ${
                isSelected
                    ? 'bg-indigo-600 text-white'
                    : day.isFuture
                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed select-none'
                      : day.isToday
                        ? 'text-slate-900 dark:text-white ring-1 ring-inset ring-indigo-500/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }">
                <span class="text-xs font-semibold ${isSelected ? 'text-indigo-100' : day.isFuture ? '' : 'text-slate-500 dark:text-slate-400'}">
                    <span class="sm:hidden">${day.dayShort}</span><span class="hidden sm:inline">${day.isToday ? 'היום' : day.dayFull}</span>
                </span>
                <span class="text-base sm:text-lg font-bold leading-none">${day.dayNum}</span>
                ${ring}
            </button>
        `;
            })
            .join('')
    );
    if (weekSlide) {
        // RTL: the previous week sits to the right, so it slides in from the right (and vice versa)
        restartAnimationClasses([
            [strip, weekSlide === 'prev' ? 'slide-from-prev' : 'slide-from-next'],
            [document.getElementById('weekRangeLabel'), 'fade-in-quick']
        ]);
    }
}

function renderTrackerSummary() {
    const totalHabits = getLiveHabits().length;
    const selectedDayObj = weekDays.find(d => d.key === selectedDateKey) || weekDays[0];
    const isSelectedFuture = isFutureDateKey(selectedDateKey);

    const dayStats = getDayStats(selectedDayObj);
    const selectedDone = dayStats.doneScheduled;
    const selectedTarget = dayStats.totalScheduled;
    const selectedBonus = dayStats.bonusDone;
    const selectedPct = dayStats.pct;
    const progressEl = document.getElementById('trackerDayProgress');
    if (progressEl) {
        if (totalHabits === 0) {
            progressEl.textContent = '';
        } else if (isSelectedFuture) {
            progressEl.textContent = `${selectedTarget} מתוכננים`;
        } else if (selectedTarget === 0) {
            progressEl.textContent = selectedBonus > 0 ? `${selectedBonus} בונוס` : 'אין יעדים ליום זה';
        } else {
            progressEl.innerHTML = `<span class="${selectedPct >= 100 ? 'text-emerald-700 dark:text-emerald-400' : ''} ${celebrateDayKey === selectedDateKey ? 'text-pop' : ''}">${selectedDone}/${selectedTarget} הושלמו</span>${selectedBonus > 0 ? ` · <bdi dir="ltr">+${selectedBonus}</bdi> בונוס` : ''}`;
        }
    }

    // Update Selected Day Banner (Amber warning when reporting on a past day)
    const bannerBox = document.getElementById('selectedDayBannerBox');
    const bannerTextEl = document.getElementById('selectedDayBannerText');
    const backToTodayBtn = document.getElementById('backToTodayBannerBtn');

    const bannerWrap = document.getElementById('selectedDayBannerWrap');
    const showBanner = !(selectedDayObj.isToday || isSelectedFuture);
    if (bannerWrap.classList.contains('is-open') !== showBanner) setRevealOpen(bannerWrap, null, showBanner);
    if (showBanner) {
        bannerTextEl.textContent = `מדווחים על ${selectedDayObj.dayFull}, ${selectedDayObj.dayNum} ב${selectedDayObj.monthShort}`;
    }

    // Separate "Mark All" & secondary "Clear Checks" buttons
    const visibleHabits = getTrackerVisibleHabits();
    const scheduledForSelected = visibleHabits.filter(h =>
        isHabitScheduledOnKey(h, selectedDateKey, selectedDayObj.dateObj.getDay())
    );
    const anyCheckedOnDay = visibleHabits.some(h => hasAnyMarkOnDay(h, selectedDateKey));
    const filterSuffix = trackerSelectedCategory !== 'הכל' ? ` (${trackerSelectedCategory})` : '';
    const allScheduledChecked =
        scheduledForSelected.length > 0 && scheduledForSelected.every(h => h.history && h.history[selectedDateKey]);

    const markAllBtn = document.getElementById('markAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');

    if (markAllBtn) {
        const markAllText =
            (selectedDayObj.isToday ? 'סמן הכל להיום' : `סמן הכל ל${selectedDayObj.dayFull}`) + filterSuffix;
        if (isSelectedFuture) {
            markAllBtn.textContent = 'לא ניתן לסמן תאריך עתידי';
            markAllBtn.disabled = true;
        } else if (allScheduledChecked || scheduledForSelected.length === 0) {
            markAllBtn.textContent = markAllText;
            markAllBtn.disabled = true;
        } else {
            markAllBtn.disabled = false;
            markAllBtn.textContent = markAllText;
        }
    }

    if (clearAllBtn) {
        clearAllBtn.disabled = isSelectedFuture || !anyCheckedOnDay;
    }
}

let analyticsRangeState = { preset: 'week', start: null, end: null };

function restoreAnalyticsRange(saved) {
    if (!saved || !ANALYTICS_PRESETS.some(p => p.id === saved.preset)) return;
    if (saved.preset === 'custom') {
        if (isValidDateKey(saved.start) && isValidDateKey(saved.end) && saved.start <= saved.end) {
            analyticsRangeState = { preset: 'custom', start: saved.start, end: saved.end };
        }
        return;
    }
    // Presets always restart from "now" so the view stays current
    analyticsRangeState = { preset: saved.preset, ...getPresetRange(saved.preset) };
}

function ensureAnalyticsRange() {
    if (!analyticsRangeState.start || !analyticsRangeState.end) {
        analyticsRangeState = {
            preset: analyticsRangeState.preset === 'custom' ? 'week' : analyticsRangeState.preset,
            ...getPresetRange(analyticsRangeState.preset === 'custom' ? 'week' : analyticsRangeState.preset)
        };
    }
}

function setAnalyticsPreset(preset) {
    analyticsEntryAnim = true;
    if (preset === 'custom') {
        ensureAnalyticsRange();
        const todayKey = getDateKeyDaysAgo(0);
        const end = analyticsRangeState.end > todayKey ? todayKey : analyticsRangeState.end;
        const start = analyticsRangeState.start > end ? end : analyticsRangeState.start;
        analyticsRangeState = { preset: 'custom', start, end };
    } else {
        analyticsRangeState = { preset, ...getPresetRange(preset) };
    }
    savePrefs();
    renderAnalytics();
    renderLeaderboard();
}

function applyCustomAnalyticsRange() {
    analyticsEntryAnim = true;
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
    analyticsRangeState = { preset: 'custom', start, end };
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
    analyticsEntryAnim = true;
    ensureAnalyticsRange();
    const { preset, start, end } = analyticsRangeState;
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
    analyticsRangeState = { preset, start: ns, end: ne };
    savePrefs();
    renderAnalytics();
    renderLeaderboard();
}

function getAnalyticsDays() {
    ensureAnalyticsRange();
    return buildDaysForRange(analyticsRangeState.start, analyticsRangeState.end);
}

// ===== Targeted DOM updates =====
// Renderers still describe a list as one HTML string, but only nodes that actually changed
// are touched: unchanged cards keep their DOM node (and their focus, hover state and running
// animations). A node whose own attributes changed is replaced whole, so CSS animation
// classes on it restart exactly as they would on a fresh node.
const patchTemplate = document.createElement('template');

function sameAttributes(a, b) {
    const attrs = a.attributes;
    if (attrs.length !== b.attributes.length) return false;
    for (let i = 0; i < attrs.length; i++) {
        if (b.getAttribute(attrs[i].name) !== attrs[i].value) return false;
    }
    return true;
}

function morphChildren(parent, next) {
    const oldNodes = Array.from(parent.childNodes);
    const newNodes = Array.from(next.childNodes);
    for (let i = 0; i < newNodes.length; i++) {
        const neu = newNodes[i];
        const old = oldNodes[i];
        if (!old) {
            parent.appendChild(neu);
            continue;
        }
        if (old.isEqualNode(neu)) continue;
        if (old.nodeType === 1 && neu.nodeType === 1 && old.tagName === neu.tagName && sameAttributes(old, neu)) {
            morphChildren(old, neu);
        } else if (old.nodeType === 3 && neu.nodeType === 3) {
            old.nodeValue = neu.nodeValue;
        } else {
            parent.replaceChild(neu, old);
        }
    }
    for (let i = newNodes.length; i < oldNodes.length; i++) parent.removeChild(oldNodes[i]);
}

// If the focused control was replaced, focus its successor (same action and arguments)
const FOCUS_KEY_ATTRS = [
    'id',
    'data-action',
    'data-id',
    'data-key',
    'data-slot',
    'data-arg',
    'data-cat',
    'data-ctx',
    'data-cal-key'
];
function focusSignature(el) {
    const parts = FOCUS_KEY_ATTRS.filter(a => el.hasAttribute(a)).map(
        a => `[${a}="${CSS.escape(el.getAttribute(a))}"]`
    );
    return parts.length ? parts.join('') : null;
}

function patchHTML(container, html) {
    const active = document.activeElement;
    const focusSel = active && active !== document.body && container.contains(active) ? focusSignature(active) : null;
    patchTemplate.innerHTML = html;
    morphChildren(container, patchTemplate.content);
    if (focusSel && !active.isConnected) {
        const successor = container.querySelector(focusSel);
        if (successor) successor.focus({ preventScroll: true });
    }
}

function renderAnalyticsRangeControls() {
    ensureAnalyticsRange();
    const presetsEl = document.getElementById('analyticsRangePresets');
    if (!presetsEl) return;
    presetsEl.innerHTML = ANALYTICS_PRESETS.map(p => {
        const active = p.id === analyticsRangeState.preset;
        return `<button type="button" aria-pressed="${active}" data-action="setPreset" data-arg="${p.id}" class="tap-44 h-9 px-2.5 sm:px-3 rounded-lg transition-all ${
            active
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
        }">${p.label}</button>`;
    }).join('');
    updateSegPill(presetsEl);
    document.getElementById('analyticsRangeLabel').textContent = formatRangeLabel(analyticsRangeState);
    const nextStart =
        analyticsRangeState.preset === 'month'
            ? formatDateKey(
                  new Date(
                      parseDateKeyLocal(analyticsRangeState.start).getFullYear(),
                      parseDateKeyLocal(analyticsRangeState.start).getMonth() + 1,
                      1
                  )
              )
            : addDaysToKey(analyticsRangeState.end, 1);
    document.getElementById('analyticsNextRangeBtn').disabled = nextStart > getDateKeyDaysAgo(0);
    const custom = document.getElementById('analyticsCustomRange');
    const isCustom = analyticsRangeState.preset === 'custom';
    custom.classList.toggle('hidden', !isCustom);
    if (isCustom) {
        const startEl = document.getElementById('analyticsRangeStart');
        const endEl = document.getElementById('analyticsRangeEnd');
        if (document.activeElement !== startEl) startEl.value = analyticsRangeState.start;
        if (document.activeElement !== endEl) endEl.value = analyticsRangeState.end;
        startEl.max = getDateKeyDaysAgo(0);
        endEl.max = getDateKeyDaysAgo(0);
    }
    scheduleScrollFades();
}

// ===== Analytics: filter (all / category / single habit) =====
let analyticsFilter = 'all'; // 'all' | 'cat:<name>' | 'habit:<id>'

function getAnalyticsFilterInfo() {
    if (analyticsFilter.startsWith('habit:')) {
        const habit = Store.habits.find(h => h.id === analyticsFilter.slice(6));
        if (habit) return { type: 'habit', habit, list: [habit] };
    } else if (analyticsFilter.startsWith('cat:')) {
        const cat = analyticsFilter.slice(4);
        const list = Store.habits.filter(h => getHabitCategoryDisplay(h) === cat);
        if (list.length) return { type: 'category', cat, list };
    }
    analyticsFilter = 'all';
    return { type: 'all', list: Store.habits };
}

function setAnalyticsFilter(value) {
    analyticsEntryAnim = true;
    analyticsFilter = value || 'all';
    savePrefs();
    renderAnalytics();
    renderLeaderboard();
}

function renderAnalyticsFilterSelect() {
    const sel = document.getElementById('analyticsFilterSelect');
    if (!sel) return;
    const cats = [...new Set(Store.habits.map(h => getHabitCategoryDisplay(h)))];
    const ordered = [
        ...Store.categories.filter(c => cats.includes(c)),
        ...cats.filter(c => !Store.categories.includes(c))
    ];
    const live = getLiveHabits();
    const archived = Store.habits.filter(h => isHabitArchived(h));
    const opt = (v, label) => `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`;
    sel.innerHTML =
        opt('all', 'כל ההרגלים') +
        (ordered.length > 1
            ? `<optgroup label="קטגוריה">${ordered.map(c => opt('cat:' + c, c)).join('')}</optgroup>`
            : '') +
        `<optgroup label="הרגל">${live.map(h => opt('habit:' + h.id, `${h.icon} ${h.name}`)).join('')}${archived.map(h => opt('habit:' + h.id, `${h.icon} ${h.name} (בארכיון)`)).join('')}</optgroup>`;
    sel.value = analyticsFilter;
}

// Charts animate in two ways: grow from zero when you arrive or change the range/filter,
// and glide from the previous value when one number changes. Nothing replays otherwise.
let analyticsEntryAnim = false;
const prevBarHeights = {};
const prevLeaderboardPct = {};
const KPI_IDS = ['weeklyRateValue', 'perfectDaysTileValue', 'bestStreakValue', 'attentionHabitBox'];

function renderAnalytics() {
    const noHabits = Store.habits.length === 0;
    document.getElementById('analyticsEmptyState').classList.toggle('hidden', !noHabits);
    document.getElementById('analyticsKpiRow').classList.toggle('hidden', noHabits);
    document.getElementById('analyticsMainGrid').classList.toggle('hidden', noHabits);
    const kpiBefore = KPI_IDS.map(id => document.getElementById(id).textContent);
    renderAnalyticsRangeControls();
    const filter = getAnalyticsFilterInfo();
    renderAnalyticsFilterSelect();
    const single = filter.type === 'habit' ? filter.habit : null;
    const scope = filter.list;
    const days = getAnalyticsDays();
    const rangeHabits = scope.filter(h => isHabitActiveInDays(h, days));

    // Streaks: current (live) and all-time best, within the filter
    let topStreak = 0,
        topHabit = single;
    let bestEver = 0,
        bestEverHabit = single;
    scope
        .filter(h => single || !isHabitArchived(h))
        .forEach(h => {
            const cur = calculateStreak(h);
            if (cur > topStreak) {
                topStreak = cur;
                topHabit = h;
            }
        });
    scope.forEach(h => {
        const best = calculateBestStreak(h);
        if (best > bestEver) {
            bestEver = best;
            bestEverHabit = h;
        }
    });
    const unitOf = h => getHabitStreakUnit(h);
    document.getElementById('bestStreakValue').textContent = topStreak;
    document.getElementById('bestStreakUnitLabel').textContent = unitOf(topHabit || scope[0]);
    document.getElementById('bestStreakHabitName').textContent = single
        ? topStreak > 0
            ? 'רצף פעיל'
            : 'אין רצף פעיל כרגע'
        : topStreak > 0
          ? `${topHabit.icon} ${topHabit.name}`
          : 'סמנו היום להתחלת רצף';
    const allTimeEl = document.getElementById('allTimeStreakText');
    if (bestEver <= 0) {
        allTimeEl.textContent = '';
    } else if (bestEver <= topStreak && bestEverHabit === topHabit) {
        allTimeEl.textContent = 'זה גם השיא';
    } else {
        allTimeEl.textContent = single
            ? `שיא: ${bestEver} ${unitOf(bestEverHabit)}`
            : `שיא: ${bestEver} ${unitOf(bestEverHabit)} · ${bestEverHabit.icon} ${bestEverHabit.name}`;
    }

    // Consistency score over elapsed days in range
    const rangeRate = (rangeDays, habitList) => {
        let t = 0,
            d = 0;
        habitList.forEach(h => {
            const r = getHabitRangeProgress(h, rangeDays, true);
            t += r.target;
            d += r.done;
        });
        return { target: t, done: d, rate: t > 0 ? Math.min(100, Math.round((d / t) * 100)) : null };
    };
    const cur = rangeRate(days, rangeHabits);
    document.getElementById('weeklyRateValue').textContent = `${cur.rate ?? 0}%`;
    document.getElementById('weeklyTotalChecks').textContent = `${cur.done} מתוך ${cur.target} יעדים`;

    // Compare with the previous range of the same kind
    const prevBounds = getPreviousRangeBounds(analyticsRangeState);
    const prevDays = buildDaysForRange(prevBounds.start, prevBounds.end);
    const prev = rangeRate(
        prevDays,
        scope.filter(h => isHabitActiveInDays(h, prevDays))
    );
    const compareEl = document.getElementById('rateCompareText');
    if (cur.rate !== null && prev.rate !== null) {
        const diff = cur.rate - prev.rate;
        const prevWord =
            analyticsRangeState.preset === 'week'
                ? 'שבוע קודם'
                : analyticsRangeState.preset === 'month'
                  ? 'חודש קודם'
                  : 'הטווח הקודם';
        compareEl.className = `text-xs font-semibold mt-1 ${diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : diff < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`;
        compareEl.innerHTML =
            diff === 0
                ? `ללא שינוי לעומת ${prevWord}`
                : `<span class="inline-flex items-center gap-1">${icon(diff > 0 ? 'arrowUp' : 'arrowDown', 'w-3.5 h-3.5')} ${Math.abs(diff)}% לעומת ${prevWord}</span>`;
    } else {
        compareEl.className = 'hidden';
    }

    // Per-day stats within the filter
    const dayStats = days.map(d => ({ day: d, ...getDayStats(d, scope) }));
    const countedDays = dayStats.filter(x => !x.day.isFuture && x.totalScheduled > 0);
    const perfectDays = countedDays.filter(x => x.allDone).length;
    const avgPct = countedDays.length ? Math.round(countedDays.reduce((a, x) => a + x.pct, 0) / countedDays.length) : 0;

    const tTitle = document.getElementById('perfectDaysTileTitle');
    const tVal = document.getElementById('perfectDaysTileValue');
    const tSub = document.getElementById('perfectDaysTileSub');
    const aTitle = document.getElementById('attentionTileTitle');
    const attentionBox = document.getElementById('attentionHabitBox');
    // Same structure as the other tiles: a 36px value row, then one muted sub-line
    const tileHtml = (value, sub, tone = 'number') => {
        const valueHtml =
            tone === 'ok'
                ? `<div class="mt-2 h-9 flex items-center gap-1.5 text-lg sm:text-xl font-bold text-emerald-700 dark:text-emerald-400">${icon('check', 'w-5 h-5', 3)}<span class="truncate">${value}</span></div>`
                : tone === 'empty'
                  ? `<div class="mt-2 h-9 flex items-center text-sm font-semibold text-slate-500 dark:text-slate-400">${value}</div>`
                  : `<div class="mt-2 h-9 flex items-baseline gap-1.5"><span class="text-3xl font-bold text-slate-900 dark:text-white">${value}</span></div>`;
        return `${valueHtml}<p class="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">${sub}</p>`;
    };

    if (single) {
        const elapsedActive = days.filter(d => !d.isFuture && isHabitActiveOnKey(single, d.key));
        const doneDays = elapsedActive.filter(d => single.history && single.history[d.key]).length;
        tTitle.textContent = 'ימי ביצוע';
        if (single.goalType === 'flexible') {
            tVal.textContent = `${doneDays}`;
            tSub.textContent = `מתוך ${elapsedActive.length} ימים בטווח`;
            // Weeks that met the quota (each week by the version of its last elapsed day)
            const quota = Math.max(1, Number(single.weeklyGoal) || 1);
            const weekQuota = w => {
                const elapsed = w.filter(d => !d.isFuture);
                const last = (elapsed.length ? elapsed : w)[(elapsed.length ? elapsed : w).length - 1];
                return Math.max(1, Number(getScheduleVersion(single, last.key).weeklyGoal) || 1);
            };
            const weeks = splitDaysIntoWeeks(days).filter(w =>
                w.some(d => !d.isFuture && isHabitActiveOnKey(single, d.key))
            );
            const finished = weeks.filter(w => !w.some(d => d.isFuture));
            const met = weeks.filter(
                w => w.reduce((a, d) => a + (single.history && single.history[d.key] ? 1 : 0), 0) >= weekQuota(w)
            ).length;
            aTitle.textContent = 'שבועות ביעד';
            attentionBox.innerHTML = tileHtml(
                `${met}/${Math.max(finished.length, met)}`,
                `שבועות עם ${quota} ביצועים ומעלה`
            );
        } else {
            tVal.textContent = `${countedDays.filter(x => x.allDone).length}/${countedDays.length}`;
            tSub.textContent = 'מתוך הימים המתוכננים';
            const missed = countedDays.filter(x => !x.allDone && !x.day.isToday);
            const lastMiss = missed.length ? missed[missed.length - 1].day : null;
            aTitle.textContent = 'פספוסים';
            attentionBox.innerHTML =
                missed.length === 0
                    ? tileHtml('אין פספוסים', 'בטווח שנבחר', 'ok')
                    : tileHtml(
                          missed.length,
                          `האחרון: ${lastMiss.dayFull}, ${lastMiss.dayNum} ב${lastMiss.monthShort}`
                      );
        }
    } else {
        tTitle.textContent = 'ימים מושלמים';
        tVal.textContent = `${perfectDays}/${countedDays.length}`;
        tSub.textContent = 'מתוך הימים עם יעדים';
        aTitle.textContent = 'צריך תשומת לב';
        const ranked = rangeHabits
            .map(h => ({ h, ...getHabitRangeProgress(h, days, true) }))
            .filter(x => x.target > 0)
            .map(x => ({ ...x, pct: Math.round((x.done / x.target) * 100) }))
            .sort((a, b) => a.pct - b.pct || b.target - a.target);
        if (ranked.length === 0) {
            attentionBox.innerHTML = tileHtml('אין עדיין נתונים', 'בטווח שנבחר', 'empty');
        } else if (ranked[0].pct >= 100) {
            attentionBox.innerHTML = tileHtml('הכל במסלול', 'כל ההרגלים עמדו ביעד', 'ok');
        } else {
            const w = ranked[0];
            attentionBox.innerHTML = tileHtml(
                `${w.pct}%`,
                `${escapeHtml(w.h.icon)} ${escapeHtml(w.h.name)} · ${w.done} מתוך ${w.target}`
            );
        }
    }

    // Strongest / weakest weekday (for a single flexible habit: share of days done)
    const insightEl = document.getElementById('weekdayInsight');
    const byWeekday = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    if (single && single.goalType === 'flexible') {
        days.filter(d => !d.isFuture && !d.isToday && isHabitActiveOnKey(single, d.key)).forEach(d => {
            const wd = d.dateObj.getDay();
            byWeekday[wd].sum += single.history && single.history[d.key] ? 100 : 0;
            byWeekday[wd].n++;
        });
    } else {
        // Today is still in progress, so it is left out of the weekday comparison
        countedDays
            .filter(x => !x.day.isToday)
            .forEach(x => {
                const wd = x.day.dateObj.getDay();
                byWeekday[wd].sum += x.pct;
                byWeekday[wd].n++;
            });
    }
    const wdAvg = byWeekday
        .map((v, i) => ({ i, avg: v.n ? Math.round(v.sum / v.n) : null }))
        .filter(v => v.avg !== null);
    insightEl.classList.add('hidden');
    if (days.length >= 7 && wdAvg.length >= 3) {
        const best = wdAvg.reduce((a, b) => (b.avg > a.avg ? b : a));
        const worst = wdAvg.reduce((a, b) => (b.avg < a.avg ? b : a));
        if (best.avg !== worst.avg) {
            insightEl.innerHTML = `היום החזק: <strong>${HEBREW_DAYS_FULL[best.i]}</strong> (${best.avg}%) · היום החלש: <strong>${HEBREW_DAYS_FULL[worst.i]}</strong> (${worst.avg}%)`;
            insightEl.classList.remove('hidden');
        }
    }

    // Layout: hide leaderboard for a single habit, chart takes full width
    document.getElementById('analyticsLeaderboardCard').classList.toggle('hidden', !!single);
    const chartCard = document.getElementById('analyticsChartCard');
    chartCard.classList.toggle('lg:col-span-7', !single);
    chartCard.classList.toggle('lg:col-span-12', !!single);

    const barWrap = document.getElementById('barChartWrap');
    const lineWrap = document.getElementById('lineChartWrap');
    const gridWrap = document.getElementById('habitGridWrap');
    const longRange = days.length > 14;
    barWrap.classList.toggle('hidden', longRange);
    lineWrap.classList.toggle('hidden', !longRange || !!single);
    gridWrap.classList.toggle('hidden', !longRange || !single);
    if (!longRange) {
        renderBarChart(dayStats, avgPct, single);
    } else if (single) {
        renderHabitGrid(single, days);
    } else {
        renderLineChart(days, avgPct, scope);
    }
    renderChartLegend(longRange ? (single ? 'grid' : 'line') : single ? 'habitBars' : 'bars');
    if (!renderingEntry) {
        restartAnimationClasses(
            KPI_IDS.map((id, i) => [document.getElementById(id), i])
                .filter(([el, i]) => el.textContent !== kpiBefore[i] && kpiBefore[i] !== '')
                .map(([el]) => [el, 'fade-in-quick'])
        );
    }
    const avgSummary = document.getElementById('chartAvgSummary');
    avgSummary.classList.toggle('hidden', !!single);
    avgSummary.classList.toggle('inline-flex', !single);
    document.getElementById('chartAvgSummaryText').textContent = `ממוצע לטווח: ${avgPct}%`;
}

// Calendar grid for one habit: columns are weeks (newest on the left), rows are weekdays.
function renderHabitGrid(habit, days) {
    const wrap = document.getElementById('habitGridWrap');
    const weeks = [];
    const first = days[0].dateObj;
    const cursor = new Date(first);
    cursor.setDate(first.getDate() - first.getDay());
    const lastKey = days[days.length - 1].key;
    while (formatDateKey(cursor) <= lastKey) {
        weeks.push(buildDaysForRange(formatDateKey(cursor), addDaysToKey(formatDateKey(cursor), 6)));
        cursor.setDate(cursor.getDate() + 7);
    }
    const inRange = new Set(days.map(d => d.key));
    const avail = Math.max(240, (wrap.clientWidth || wrap.parentElement.clientWidth || 600) - 40);
    const gap = 3;
    const size = Math.max(9, Math.min(30, Math.floor((avail - gap * weeks.length) / weeks.length)));
    const color = getColorMeta(habit.color);

    const cell = d => {
        let cls;
        let tip = `${d.dayFull} ${d.dayNum}/${d.dateObj.getMonth() + 1}: `;
        const done = !!(habit.history && habit.history[d.key]);
        if (!inRange.has(d.key)) {
            cls = 'opacity-0';
            tip = '';
        } else if (d.isFuture) {
            cls = 'bg-slate-100 dark:bg-slate-800/50';
            tip += 'עתידי';
        } else if (!isHabitActiveOnKey(habit, d.key)) {
            cls = 'border border-dashed border-slate-200 dark:border-slate-800';
            tip += 'לא במעקב';
        } else if (done) {
            cls = 'bg-emerald-500';
            tip += 'בוצע';
        } else if (!isFlexibleOnKey(habit, d.key) && !isHabitScheduledOnKey(habit, d.key, d.dateObj.getDay())) {
            cls = 'border border-slate-200 dark:border-slate-700';
            tip += 'יום מנוחה';
        } else {
            cls = 'bg-slate-200 dark:bg-slate-700';
            tip += d.isToday ? 'עוד לא סומן' : 'לא בוצע';
        }
        return `<span class="block rounded-[3px] ${cls} ${d.isToday ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : ''}" style="width:${size}px;height:${size}px" ${tip ? `data-tip="${tip}" data-tip-touch` : ''}></span>`;
    };

    const dayLabels = HEBREW_DAYS_SHORT.map(
        l =>
            `<span class="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center" style="height:${size}px">${l}</span>`
    ).join('');
    const cols = weeks
        .map((w, wi) => {
            const monthStart = w.find(d => d.dayNum === 1 && inRange.has(d.key));
            const label =
                wi === 0 || monthStart
                    ? HEBREW_MONTHS[(monthStart || w.find(d => inRange.has(d.key)) || w[0]).dateObj.getMonth()]
                    : '';
            return `<div class="flex flex-col items-center" style="gap:${gap}px">
            <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap h-4 leading-4" style="width:${size}px;overflow:visible;text-align:right">${label}</span>
            ${w.map(cell).join('')}
        </div>`;
        })
        .join('');
    wrap.innerHTML = `
        <div class="flex items-start justify-center py-2 ${analyticsEntryAnim ? 'fade-in-quick' : ''}" style="gap:${gap}px">
            <div class="flex flex-col pl-1" style="gap:${gap}px"><span class="h-4"></span>${dayLabels}</div>
            ${cols}
        </div>`;
}

function barFrom(key, height) {
    return analyticsEntryAnim ? 0 : prevBarHeights[key];
}
function barGrowClass(key, height) {
    const from = barFrom(key, height);
    return from !== undefined && from !== height ? 'bar-grow' : '';
}
function barGrowStyle(key, height, idx) {
    const from = barFrom(key, height);
    prevBarHeights[key] = height;
    if (from === undefined || from === height) return '';
    return `--bar-from:${from}%; animation-delay:${analyticsEntryAnim ? Math.min(idx, 14) * 25 : 0}ms;`;
}

function renderBarChart(dayStats, avgPct, single = null) {
    const n = dayStats.length;
    const compact = n > 7;
    const chart = document.getElementById('weeklyBarChart');
    chart.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`;
    chart.classList.toggle('gap-3', !compact);
    chart.classList.toggle('sm:gap-4', !compact);
    chart.classList.toggle('gap-1', compact);
    chart.classList.toggle('sm:gap-2', compact);

    chart.innerHTML = dayStats
        .map(({ day, totalScheduled, doneScheduled, pct }, barIdx) => {
            const isSelected = day.key === selectedDateKey;
            if (single) {
                // One habit: a day is either done or not
                const done = !!(single.history && single.history[day.key]);
                const active = isHabitActiveOnKey(single, day.key);
                const scheduled =
                    isFlexibleOnKey(single, day.key) || isHabitScheduledOnKey(single, day.key, day.dateObj.getDay());
                totalScheduled = active && scheduled ? 1 : 0;
                doneScheduled = done ? 1 : 0;
                pct = done ? 100 : 0;
            }
            const barHeight = day.isFuture
                ? 8
                : single
                  ? doneScheduled
                      ? 100
                      : 8
                  : totalScheduled === 0
                    ? 8
                    : Math.max(10, pct);
            let barColorClass = 'bg-indigo-500 dark:bg-indigo-500';
            if (day.isFuture) {
                barColorClass = 'bg-slate-200 dark:bg-slate-700';
            } else if (single ? doneScheduled : pct === 100 && totalScheduled > 0) {
                barColorClass = 'bg-emerald-500 dark:bg-emerald-400';
            } else if (doneScheduled === 0) {
                barColorClass = 'bg-slate-200 dark:bg-slate-700';
            }
            const tip = `${day.dayFull} ${day.dayNum}/${day.dateObj.getMonth() + 1}${day.isFuture ? ' (עתידי)' : ` · ${doneScheduled}/${totalScheduled}`}`;
            return `
            <div ${day.isFuture ? 'aria-disabled="true"' : `role="button" tabindex="0" aria-label="${tip}. מעבר לסימון היום הזה" data-action="barSelectDay" data-key="${day.key}" data-key-activate`} class="rounded-xl flex flex-col items-center h-full justify-end min-w-0 ${day.isFuture ? 'cursor-not-allowed opacity-60' : 'cursor-pointer group'}" data-tip="${tip}">
                <span class="text-xs font-semibold mb-1.5 transition ${compact ? 'hidden sm:block' : ''} ${
                    isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'
                }">${day.isFuture ? '&nbsp;' : single ? (doneScheduled ? icon('check', 'w-4 h-4 mx-auto') : totalScheduled ? icon('x', 'w-4 h-4 mx-auto') : '–') : `${doneScheduled}/${totalScheduled}`}</span>
                <div data-bar-track class="w-full max-w-[48px] h-40 bg-slate-100 dark:bg-slate-800/90 ${compact ? 'rounded-lg p-0.5 sm:rounded-xl sm:p-1' : 'rounded-xl p-1.5'} flex items-end border transition ${
                    isSelected
                        ? 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/25'
                        : 'border-transparent group-hover:border-slate-300 dark:group-hover:border-slate-700'
                }">
                    <div class="w-full ${compact ? 'rounded-lg sm:rounded-lg' : 'rounded-xl'} bar-fill ${barColorClass} ${barGrowClass(day.key, barHeight)}" style="height: ${barHeight}%; ${barGrowStyle(day.key, barHeight, barIdx)}"></div>
                </div>
                <div class="mt-2 text-center leading-tight">
                    <span class="block text-xs font-semibold ${
                        isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                    }">${compact ? day.dayShort : `<span class="sm:hidden">${day.dayShort}</span><span class="hidden sm:inline">${day.dayFull}</span>`}</span>
                    <span class="block text-xs font-semibold text-slate-500 dark:text-slate-400">${compact ? day.dayNum : `${day.dayNum}/${day.dateObj.getMonth() + 1}`}</span>
                </div>
            </div>
        `;
        })
        .join('');

    const avgLine = document.getElementById('chartAvgLine');
    if (avgLine) {
        avgLine.classList.toggle('hidden', !!single);
        avgLine.dataset.pct = avgPct;
        schedulePositionAvgLine();
    }
}

// Place the dashed average line from the real size of a bar track, so it stays
// correct when fonts, labels or breakpoints change the layout.
let avgLineFrame = 0;
function schedulePositionAvgLine() {
    if (avgLineFrame) return;
    avgLineFrame = requestAnimationFrame(() => {
        avgLineFrame = 0;
        positionAvgLine();
    });
}

function positionAvgLine() {
    const avgLine = document.getElementById('chartAvgLine');
    const wrap = document.getElementById('barChartWrap');
    const track = wrap && wrap.querySelector('[data-bar-track]');
    if (!avgLine || !track) return;
    // all reads first…
    const t = track.getBoundingClientRect();
    if (t.height === 0) return; // not visible yet
    const cs = getComputedStyle(track);
    const wrapBottom = wrap.getBoundingClientRect().bottom;
    const padBottom = parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
    const contentH = t.height - padBottom - parseFloat(cs.paddingTop) - parseFloat(cs.borderTopWidth);
    const pct = Number(avgLine.dataset.pct) || 0;
    const fromWrapBottom = wrapBottom - t.bottom;
    // …then one write
    avgLine.style.bottom = `${Math.round(fromWrapBottom + padBottom + (pct / 100) * contentH - 1)}px`;
}

function renderLineChart(days, avgPct, scope = Store.habits) {
    const wrap = document.getElementById('lineChartWrap');
    const width = Math.max(260, Math.round(wrap.clientWidth || wrap.parentElement.clientWidth || 600));
    const height = 240;
    const pad = { top: 16, bottom: 28, left: 8, right: 36 }; // y labels on the right (RTL)
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const n = days.length;
    // RTL: oldest day on the right, newest on the left
    const xFor = i => pad.left + plotW - (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
    const yFor = pct => pad.top + plotH - (pct / 100) * plotH;

    // Daily values (null = future or nothing scheduled)
    const dayPct = d => {
        if (d.isFuture) return null;
        const st = getDayStats(d, scope);
        return st.totalScheduled > 0 ? st.pct : null;
    };
    const values = days.map(dayPct);
    // 7-day moving average, using the 6 days before the range so it starts meaningfully
    const before = buildDaysForRange(addDaysToKey(days[0].key, -6), addDaysToKey(days[0].key, -1)).map(dayPct);
    const all = [...before, ...values];
    const ma = values.map((v, i) => {
        if (days[i].isFuture) return null;
        const windowVals = all.slice(i, i + 7).filter(x => x !== null);
        return windowVals.length ? windowVals.reduce((a, b) => a + b, 0) / windowVals.length : null;
    });

    const segments = arr => {
        const segs = [];
        let cur = [];
        arr.forEach((v, i) => {
            if (v === null) {
                if (cur.length) segs.push(cur);
                cur = [];
            } else cur.push([xFor(i), yFor(v)]);
        });
        if (cur.length) segs.push(cur);
        return segs;
    };
    const pathFrom = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');

    const dailySegs = segments(values);
    const areaPaths = dailySegs
        .filter(sg => sg.length > 1)
        .map(
            sg =>
                `${pathFrom(sg)}L${sg[sg.length - 1][0].toFixed(1)},${(pad.top + plotH).toFixed(1)}L${sg[0][0].toFixed(1)},${(pad.top + plotH).toFixed(1)}Z`
        )
        .join('');
    const dailyLine = dailySegs.map(pathFrom).join('');
    const maLine = segments(ma).map(pathFrom).join('');

    const grid = [0, 50, 100]
        .map(
            v => `
        <line x1="${pad.left}" x2="${pad.left + plotW}" y1="${yFor(v)}" y2="${yFor(v)}" stroke="currentColor" class="text-slate-200 dark:text-slate-800" stroke-width="1"/>
        <text x="${width - 4}" y="${yFor(v) + 4}" text-anchor="end" class="fill-slate-500 dark:fill-slate-400" font-size="11" font-weight="600">${v}%</text>`
        )
        .join('');

    const tickCount = Math.min(6, n);
    const ticks = [];
    for (let t = 0; t < tickCount; t++) {
        const i = Math.round((t / (tickCount - 1)) * (n - 1));
        if (!ticks.includes(i)) ticks.push(i);
    }
    const xLabels = ticks
        .map(i => {
            const d = days[i];
            const anchor = i === 0 ? 'end' : i === n - 1 ? 'start' : 'middle';
            return `<text x="${xFor(i)}" y="${height - 8}" text-anchor="${anchor}" class="fill-slate-500 dark:fill-slate-400" font-size="11" font-weight="600">${d.dayNum}/${d.dateObj.getMonth() + 1}</text>`;
        })
        .join('');

    const perfectDots = values
        .map((v, i) =>
            v === 100
                ? `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(100).toFixed(1)}" r="3" class="fill-emerald-500"/>`
                : ''
        )
        .join('');

    const avgY = yFor(avgPct);
    const hitW = Math.max(4, plotW / Math.max(1, n - 1));
    const hits = days
        .map((d, i) => {
            const v = values[i];
            const label = `${d.dayFull} ${d.dayNum}/${d.dateObj.getMonth() + 1}: ${d.isFuture ? 'עתידי' : v === null ? 'אין יעדים' : v + '%'}${ma[i] !== null ? ` · ממוצע 7 ימים ${Math.round(ma[i])}%` : ''}`;
            return `<rect x="${(xFor(i) - hitW / 2).toFixed(1)}" y="${pad.top}" width="${hitW.toFixed(1)}" height="${plotH}" fill="transparent" data-tip="${label}" data-tip-touch></rect>`;
        })
        .join('');

    wrap.innerHTML = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" direction="ltr" style="direction:ltr" class="block text-indigo-500" role="img" aria-label="גרף עקביות יומית לאורך ${n} ימים, ממוצע ${avgPct}%">
            ${grid}
            <path d="${areaPaths}" class="fill-indigo-500/10 dark:fill-indigo-400/10 ${analyticsEntryAnim ? 'fade-in-quick' : ''}"/>
            <path d="${dailyLine}" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5" stroke-linejoin="round" class="${analyticsEntryAnim ? 'fade-in-quick' : ''}"/>
            <line x1="${pad.left}" x2="${pad.left + plotW}" y1="${avgY}" y2="${avgY}" stroke="currentColor" class="text-slate-500 dark:text-slate-400" stroke-width="1.5" stroke-dasharray="5 4"/>
            ${maLine
                .split('M')
                .filter(Boolean)
                .map(
                    seg =>
                        `<path d="M${seg}" pathLength="1" class="${analyticsEntryAnim ? 'line-draw' : ''}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
                )
                .join('')}
            ${perfectDots}
            ${xLabels}
            ${hits}
        </svg>
    `;
}

function renderChartLegend(mode) {
    const el = document.getElementById('chartLegend');
    if (!el) return;
    const item = (swatch, text) => `<span class="flex items-center gap-1.5 whitespace-nowrap">${swatch} ${text}</span>`;
    const dashed = '<span class="w-4 shrink-0 border-t-2 border-dashed border-slate-400 inline-block"></span>';
    const sq = cls => `<span class="w-3 h-3 shrink-0 rounded-sm ${cls} inline-block"></span>`;
    const legends = {
        line: [
            item('<span class="w-4 h-1 shrink-0 rounded-full bg-indigo-500 inline-block"></span>', 'ממוצע 7 ימים'),
            item(sq('bg-indigo-500/20 border border-indigo-500/40'), 'אחוז יומי'),
            item('<span class="w-2.5 h-2.5 shrink-0 rounded-full bg-emerald-500 inline-block"></span>', 'יום מושלם')
        ],
        bars: [
            item(sq('bg-emerald-500'), 'יום מושלם (100%)'),
            item(sq('bg-indigo-500'), 'התקדמות יומית'),
            item(dashed, 'ממוצע')
        ],
        habitBars: [item(sq('bg-emerald-500'), 'בוצע'), item(sq('bg-slate-200 dark:bg-slate-700'), 'לא בוצע / מנוחה')],
        grid: [
            item(sq('bg-emerald-500'), 'בוצע'),
            item(sq('bg-slate-200 dark:bg-slate-700'), 'לא בוצע'),
            item(sq('border border-slate-300 dark:border-slate-600'), 'יום מנוחה'),
            item(sq('border border-dashed border-slate-300 dark:border-slate-700'), 'לא במעקב')
        ]
    };
    el.innerHTML = (legends[mode] || legends.bars).join('');
}

let lineChartResizeTimer = null;
let resizeFrame = 0;
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
            currentMainSection === 'analytics' &&
            (!document.getElementById('lineChartWrap').classList.contains('hidden') ||
                !document.getElementById('habitGridWrap').classList.contains('hidden'))
        )
            renderAnalytics();
    }, 150);
});

function widenFrom(id, pct, idx) {
    // memoised per render so the two calls above agree
    const key = `${id}|${pct}`;
    if (widenFrom.cache[key]) return widenFrom.cache[key];
    const from = analyticsEntryAnim ? 0 : prevLeaderboardPct[id];
    const out =
        from === undefined || from === pct
            ? { cls: '', style: '' }
            : {
                  cls: 'bar-widen',
                  style: `--w-from:${from}%; animation-delay:${analyticsEntryAnim ? Math.min(idx, 8) * 40 : 0}ms;`
              };
    widenFrom.cache[key] = out;
    return out;
}
widenFrom.cache = {};

function renderLeaderboard() {
    widenFrom.cache = {};
    const container = document.getElementById('habitLeaderboardList');
    if (!container) return;

    const days = getAnalyticsDays();
    const isCurrentWeek =
        analyticsRangeState.preset === 'week' && formatRangeLabel(analyticsRangeState) === 'השבוע הנוכחי';
    const periodWord = isCurrentWeek ? 'השבוע' : 'בטווח';
    const progressOf = h => {
        const { target, done } = getHabitRangeProgress(h, days, false);
        return { goal: target, count: done, pct: target > 0 ? Math.min(100, Math.round((done / target) * 100)) : 0 };
    };
    const weekHabits = getAnalyticsFilterInfo().list.filter(h => isHabitActiveInDays(h, days));
    if (weekHabits.length === 0) {
        patchHTML(
            container,
            `<p class="text-xs text-slate-500 dark:text-slate-400 text-center py-6">${Store.habits.length === 0 ? 'אין הרגלים להצגה בדירוג.' : 'אין הרגלים פעילים בטווח הזה.'}</p>`
        );
        analyticsEntryAnim = false;
        return;
    }

    // Sort by weekly goal completion percentage first so flexible habits are compared fairly
    const rows = weekHabits.map(h => ({ h, progress: progressOf(h), streak: calculateStreak(h) }));
    rows.sort((a, b) => b.progress.pct - a.progress.pct || b.streak - a.streak);
    const sorted = rows.map(r => r.h);
    const progressById = new Map(rows.map(r => [r.h.id, r.progress]));

    patchHTML(
        container,
        sorted
            .map((habit, idx) => {
                const colorMeta = getColorMeta(habit.color);
                const { count: weeklyCount, goal: weeklyGoal, pct } = progressById.get(habit.id);
                const goalLabel = getHabitGoalLabel(habit);
                const streakBadgeText = getHabitStreakText(habit);

                return `
            <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/80 space-y-2.5">
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-6 h-6 rounded-full bg-slate-200/80 dark:bg-slate-700 text-xs font-semibold flex items-center justify-center shrink-0">${idx + 1}</span>
                        <span class="text-lg shrink-0">${escapeHtml(habit.icon)}</span>
                        <div class="min-w-0">
                            <span class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 block truncate">${escapeHtml(habit.name)}</span>
                            <span class="text-xs text-slate-500 dark:text-slate-400 block truncate">${escapeHtml(goalLabel)}</span>
                        </div>
                    </div>
                    <span class="hidden sm:inline-flex text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                        ${streakBadgeText}
                    </span>
                </div>
                <div class="flex items-center gap-3">
                    <div class="flex-1 bg-slate-200/80 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div class="${pct >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'} h-full rounded-full ${widenFrom(habit.id, pct, idx).cls}" style="width: ${pct}%; ${widenFrom(habit.id, pct, idx).style}"></div>
                    </div>
                    <span class="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">${weeklyCount}/${weeklyGoal}<span class="hidden sm:inline"> ${periodWord} (${pct}%)</span></span>
                    <span class="sm:hidden text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">${streakBadgeText}</span>
                </div>
            </div>
        `;
            })
            .join('')
    );
    sorted.forEach(h => {
        prevLeaderboardPct[h.id] = progressById.get(h.id).pct;
    });
    analyticsEntryAnim = false;
}

function renderCategoryFilterBar(context = 'tracker') {
    const hasUncategorized = Store.habits.some(h => !(h.category || '').trim());
    const allFilterCategories = ['הכל', ...Store.categories];
    if (hasUncategorized) {
        allFilterCategories.push(UNCATEGORIZED_LABEL);
    }

    if (!allFilterCategories.includes(trackerSelectedCategory)) {
        trackerSelectedCategory = 'הכל';
    }
    if (!allFilterCategories.includes(manageSelectedCategory)) {
        manageSelectedCategory = 'הכל';
    }

    const live = getLiveHabits();
    const countFor = cat => {
        if (cat === 'הכל') return live.length;
        if (cat === UNCATEGORIZED_LABEL) return live.filter(h => !(h.category || '').trim()).length;
        return live.filter(h => h.category === cat).length;
    };
    const buildPills = (activeCat, ctx) =>
        allFilterCategories
            .map(cat => {
                const active = cat === activeCat;
                const n = countFor(cat);
                const badge =
                    n > 0
                        ? `<span class="min-w-[1.25rem] h-5 px-1 rounded-full text-xs leading-5 text-center font-semibold ${
                              active
                                  ? 'bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900'
                                  : 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300'
                          }">${n}</span>`
                        : '';
                return `
            <button type="button" aria-pressed="${active}" aria-label="${escapeHtml(cat)}${n > 0 ? `, ${n} הרגלים` : ''}" data-action="setCategoryFilter" data-cat="${escapeHtml(cat)}" data-ctx="${ctx}" class="tap-44 h-10 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition inline-flex items-center gap-1.5 ${
                active
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
            }">
                <span>${escapeHtml(cat)}</span>${badge}
            </button>
        `;
            })
            .join('');

    if (context === 'manage') {
        const manageBar = document.getElementById('manageCategoryFilterBar');
        if (manageBar) patchHTML(manageBar, buildPills(manageSelectedCategory, 'manage'));
        scheduleScrollFades();
        return;
    }
    const bar = document.getElementById('categoryFilterBar');
    if (bar) patchHTML(bar, buildPills(trackerSelectedCategory, 'tracker'));
    scheduleScrollFades();

    const indicator = document.getElementById('trackerActiveFilterIndicator');
    if (indicator) {
        if (trackerSelectedCategory !== 'הכל') {
            indicator.classList.remove('hidden');
            indicator.innerHTML = `
                <span>מוצגים רק הרגלי <strong>${escapeHtml(trackerSelectedCategory)}</strong></span>
                <span>·</span>
                <button type="button" data-action="setCategoryFilter" data-cat="הכל" data-ctx="tracker" class="font-bold text-indigo-600 dark:text-indigo-400 hover:underline">הצג הכל</button>
            `;
        } else {
            indicator.classList.add('hidden');
            indicator.innerHTML = '';
        }
    }
}

// Open/close a .reveal block in place (no re-render), so the height change can animate
function setRevealOpen(revealEl, toggleBtn, open, openText, closedText) {
    if (!revealEl) return false;
    revealEl.classList.toggle('is-open', open);
    if (open) {
        revealEl.removeAttribute('inert');
        revealEl.classList.add('is-opening');
        clearTimeout(revealEl._openingTimer);
        revealEl._openingTimer = setTimeout(() => revealEl.classList.remove('is-opening'), 500);
    } else {
        revealEl.setAttribute('inert', '');
        revealEl.classList.remove('is-opening');
    }
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', String(open));
        const label = toggleBtn.querySelector('[data-toggle-text]');
        if (label) label.textContent = open ? openText : closedText;
        const chevron = toggleBtn.querySelector('[data-toggle-text] + svg');
        if (chevron) chevron.classList.toggle('rotate-180', open);
    }
    return true;
}

function toggleUnscheduledGroup() {
    unscheduledSectionExpanded = !unscheduledSectionExpanded;
    if (
        !setRevealOpen(
            document.getElementById('restGroupReveal'),
            document.getElementById('restGroupToggle'),
            unscheduledSectionExpanded,
            'הסתר',
            'הצג הכל'
        )
    ) {
        renderHabitsList();
    }
}

// ===== Tooltip: one element, 300ms hover delay with a mouse; tap-to-show on chart cells with touch =====
(function setupTooltips() {
    const tip = document.createElement('div');
    tip.id = 'appTooltip';
    tip.setAttribute('role', 'tooltip');
    tip.className = 'app-tooltip';
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(tip));
    let showTimer = null,
        hideTimer = null,
        current = null;

    function show(target) {
        const text = target.getAttribute('data-tip');
        if (!text) return;
        current = target;
        const r = target.getBoundingClientRect(); // read (layout is clean here)
        const vw = window.innerWidth;
        tip.textContent = text; // writes
        tip.classList.remove('is-visible');
        tip.style.top = '-999px';
        tip.style.left = '-999px';
        const t = tip.getBoundingClientRect(); // the one forced layout: the tip's new size
        let top = r.top - t.height - 8;
        let below = false;
        if (top < 8) {
            top = r.bottom + 8;
            below = true;
        }
        const left = Math.min(vw - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2));
        tip.style.top = `${top}px`;
        tip.style.left = `${left}px`;
        tip.classList.toggle('is-below', below);
        tip.classList.add('is-visible'); // layout above already flushed the hidden state
    }
    function hide() {
        clearTimeout(showTimer);
        current = null;
        tip.classList.remove('is-visible');
    }
    document.addEventListener('pointerover', e => {
        if (e.pointerType !== 'mouse') return;
        const target = e.target.closest && e.target.closest('[data-tip]');
        if (!target || target === current) return;
        clearTimeout(showTimer);
        // moving between neighbouring cells keeps the tooltip and just moves it
        if (tip.classList.contains('is-visible')) show(target);
        else showTimer = setTimeout(() => show(target), 300);
    });
    document.addEventListener('pointerout', e => {
        if (e.pointerType !== 'mouse') return;
        const target = e.target.closest && e.target.closest('[data-tip]');
        if (!target) return;
        const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-tip]');
        if (to) return;
        hide();
    });
    document.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse') {
            hide();
            return;
        }
        const target = e.target.closest && e.target.closest('[data-tip-touch]');
        if (!target) {
            hide();
            return;
        }
        show(target);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, 1800);
    });
    let scrollHidePending = false;
    window.addEventListener(
        'scroll',
        () => {
            if (scrollHidePending || !current) return;
            scrollHidePending = true;
            requestAnimationFrame(() => {
                scrollHidePending = false;
                hide();
            });
        },
        { passive: true, capture: true }
    );
})();

// ===== Layout moves (FLIP): cards that stay glide to their new place, new ones fade in =====
const EASE_OUT_JS = 'cubic-bezier(0.22, 1, 0.36, 1)';
function captureFlip() {
    const map = new Map();
    document.querySelectorAll('[data-flip-key]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width) map.set(el.dataset.flipKey, r);
    });
    return map;
}
function playFlip(before) {
    if (prefersReducedMotion() || !Element.prototype.animate) return;
    const measured = [...document.querySelectorAll('[data-flip-key]')].map(el => [el, el.getBoundingClientRect()]); // reads
    measured.forEach(([el, r]) => {
        // writes
        if (!r.width) return;
        const b = before.get(el.dataset.flipKey);
        if (!b) {
            el.animate(
                [
                    { opacity: 0, transform: 'scale(0.97)' },
                    { opacity: 1, transform: 'none' }
                ],
                { duration: 220, easing: EASE_OUT_JS }
            );
            return;
        }
        const dx = b.left - r.left,
            dy = b.top - r.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
            duration: 280,
            easing: EASE_OUT_JS
        });
    });
}
function withFlip(mutate) {
    const before = captureFlip();
    mutate();
    playFlip(before);
}
// Fade/shrink the cards of these habits away, then apply the change and let the rest close the gap
function animateOut(ids, mutate) {
    const els = ids
        .flatMap(id => [...document.querySelectorAll(`[data-flip-key$="-${CSS.escape(id)}"]`)])
        .filter(el => el.getClientRects().length);
    if (els.length === 0 || prefersReducedMotion() || !Element.prototype.animate) {
        withFlip(mutate);
        return;
    }
    const fades = els.map(el =>
        el.animate(
            [
                { opacity: 1, transform: 'none' },
                { opacity: 0, transform: 'scale(0.96)' }
            ],
            { duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }
        )
    );
    setTimeout(() => {
        withFlip(mutate);
        fades.forEach(a => a.cancel()); // nodes that were removed don't care; ones that stay become visible again
    }, 180);
}
function flashHabits(ids) {
    flashHabitIds = new Set(ids);
    setTimeout(() => {
        flashHabitIds = new Set();
    }, 0);
}

// Habits that should briefly glow after the next render (just added, moved or restored)
let flashHabitIds = new Set();
function flashClassFor(id) {
    return flashHabitIds.has(id) ? 'flash-highlight' : '';
}

// Time (or time range) of a card, plus its live state today: now / next / past
function timeChipsHtml(habit, timeStatus) {
    const past = timeStatus === 'past';
    const timeHtml = timeRangeHtml(
        habit.time,
        habit.duration,
        `text-xs font-semibold ${past ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-200'}`
    );
    const statusHtml =
        timeStatus === 'now'
            ? '<span class="text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-600 text-white">עכשיו</span>'
            : timeStatus === 'next'
              ? '<span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">הבא</span>'
              : past
                ? '<span class="text-xs font-normal text-slate-500 dark:text-slate-400">עבר</span>'
                : '';
    return `${timeHtml}${statusHtml}`;
}

function buildHabitFocusCardHtml(habit, selectedDayObj, isSelectedDayFuture, timeStatus = null) {
    const colorMeta = getColorMeta(habit.color);
    const selectedDayOfWeek = selectedDayObj.dateObj.getDay();
    const isFlexible = habit.goalType === 'flexible';
    const isSlot = habit._slot !== undefined;
    const isDoneSelectedDay =
        !isSelectedDayFuture &&
        (isSlot
            ? isSlotDone(habit, selectedDateKey, habit._slot)
            : !!(habit.history && habit.history[selectedDateKey]));
    const slotAttr = isSlot ? ` data-slot="${habit._slot}"` : '';
    const isScheduledToday = isHabitScheduledForDayOfWeek(habit, selectedDayOfWeek);
    const streak = calculateStreak(habit);
    const streakLongText = getHabitStreakLongText(habit);
    const weeklyCount = getWeeklyCountForHabit(habit, weekDays);
    const weeklyGoal = getWeeklyGoalForHabit(habit, weekDays);
    const weeklyPct = weeklyGoal > 0 ? Math.min(100, Math.round((weeklyCount / weeklyGoal) * 100)) : 0;
    const isWeeklyQuotaMet = isFlexible && weeklyGoal > 0 && weeklyCount >= weeklyGoal;
    const goalLabel = getHabitGoalLabel(habit);
    const justToggled =
        lastToggle && lastToggle.id === habit.id && (!isSlot || lastToggle.slot === habit._slot) ? lastToggle : null;

    const miniPips = weekDays
        .map(d => {
            const isDayFuture = d.isFuture || isFutureDateKey(d.key);
            const checked = !isDayFuture && !!(habit.history && habit.history[d.key]);
            const isCurrent = d.key === selectedDateKey;
            const isDayScheduled = isHabitScheduledOnKey(habit, d.key, d.dateObj.getDay());
            const isDayFlexible = isFlexibleOnKey(habit, d.key);
            const isBeforeStart = !isHabitActiveOnKey(habit, d.key);
            return `
            <div title="${d.dayFull}${isBeforeStart ? ' (לפני תחילת ההרגל)' : isDayFuture ? ' (תאריך עתידי — טרם הגיע)' : isDayFlexible ? ' (גמיש השבוע)' : isDayScheduled ? ' (מתוכנן)' : ' (יום חופשי)'}" class="flex flex-col items-center gap-0.5 p-1 rounded-lg select-none pointer-events-none ${isDayFuture || isBeforeStart ? 'opacity-30' : !isDayScheduled && !isDayFlexible && !checked ? 'opacity-40' : ''}">
                <span class="text-xs font-semibold ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}">${d.dayLetter}</span>
                <span class="w-2.5 h-2.5 rounded-full transition-all ${
                    isDayFuture || isBeforeStart
                        ? 'border border-dashed border-slate-400 dark:border-slate-600 bg-transparent'
                        : checked
                          ? colorMeta.bg
                          : isDayScheduled || isDayFlexible
                            ? 'bg-slate-200 dark:bg-slate-700'
                            : 'border border-dashed border-slate-400 dark:border-slate-600 bg-transparent'
                } ${isCurrent ? 'ring-2 ring-offset-1 ring-indigo-400 dark:ring-offset-slate-900' : ''} ${justToggled && justToggled.key === d.key && checked ? 'pip-pop' : ''}"></span>
            </div>
        `;
        })
        .join('');

    return `
        <div data-flip-key="t-${escapeHtml(habit.id)}${isSlot ? `-${habit._slot}` : ''}" ${isSelectedDayFuture ? '' : `data-action="toggleCardBody" data-id="${escapeHtml(habit.id)}" data-key="${selectedDateKey}"${slotAttr}`} class="${flashClassFor(habit.id)} ${isSelectedDayFuture ? 'cursor-not-allowed' : 'cursor-pointer'} select-none bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border ${timeStatus === 'now' ? 'border-indigo-500 dark:border-indigo-400 ring-1 ring-indigo-500/40' : 'border-slate-200/70 dark:border-slate-800'} transition-all duration-300 flex flex-col justify-between ${
            !isScheduledToday && !isFlexible ? 'opacity-85' : 'hover:border-slate-300 dark:hover:border-slate-700'
        }">
            <div class="flex items-start gap-3.5">
                <!-- Large Touch Checkbox Button -->
                <button type="button" ${isSelectedDayFuture ? 'disabled' : `data-action="toggleDay" data-id="${escapeHtml(habit.id)}" data-key="${selectedDateKey}"${slotAttr}`} title="${isSelectedDayFuture ? 'לא ניתן לסמן הרגלים בתאריך עתידי' : ''}" aria-label="סמן את ${escapeHtml(habit.name)}${isSlot ? `, פעם ${habit._slot + 1} מתוך ${habit._slots}` : ''}" aria-pressed="${isDoneSelectedDay ? 'true' : 'false'}" class="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-xl transition-all ${
                    isSelectedDayFuture
                        ? 'bg-slate-100 dark:bg-slate-800/70 text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 cursor-not-allowed pointer-events-none opacity-60'
                        : isDoneSelectedDay
                          ? `${colorMeta.bg} text-white ${habit.id === lastToggledHabitId && (!isSlot || justToggled) ? 'animate-pop' : ''}`
                          : `${colorMeta.softBg} ${colorMeta.text} border border-slate-200 dark:border-slate-700`
                }">
                    ${
                        isDoneSelectedDay
                            ? `<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" aria-hidden="true"><path class="${justToggled ? 'check-draw' : ''}" pathLength="1" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`
                            : `<span class="${justToggled ? 'fade-in-quick' : ''}">${escapeHtml(habit.icon)}</span>`
                    }
                </button>

                <!-- Habit Title & Metadata -->
                <div class="flex-1 min-w-0">
                    <div class="flex items-center flex-wrap gap-1.5">
                        ${habit.time ? timeChipsHtml(habit, timeStatus) : ''}
                        ${isSlot ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">פעם ${habit._slot + 1} מתוך ${habit._slots}</span>` : ''}
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                            ${escapeHtml(getHabitCategoryDisplay(habit))}
                        </span>
                        ${isSelectedDayFuture ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">טרם הגיע</span>` : !isScheduledToday && !isFlexible ? `<span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 text-slate-500 dark:text-slate-400">${isDoneSelectedDay ? 'בונוס יומי' : 'יום מנוחה'}</span>` : ''}
                        ${streakLongText ? `<span class="text-xs font-semibold text-slate-500 dark:text-slate-400">${streakLongText}</span>` : ''}
                    </div>
                    <h3 class="text-sm sm:text-base font-bold mt-1 truncate ${
                        isDoneSelectedDay ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'
                    } ${justToggled ? (isDoneSelectedDay ? 'title-dim' : 'title-undim') : ''}">
                        ${escapeHtml(habit.name)}
                    </h3>
                    ${habit.note ? `<p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">${escapeHtml(habit.note)}</p>` : ''}
                </div>
            </div>

            <!-- Bottom Bar: Mini 7-Day Pips + Weekly Target Progress -->
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                <div class="flex items-center gap-0.5">
                    ${miniPips}
                </div>
                <span title="יעד שבועי" class="shrink-0 text-xs font-semibold ${weeklyGoal > 0 && weeklyCount >= weeklyGoal ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}">
                    <span class="inline-flex items-center gap-1 ${justToggled ? (justToggled.on ? 'count-up' : 'count-down') : ''}">${weeklyGoal > 0 && weeklyCount >= weeklyGoal ? icon('check', 'w-3.5 h-3.5') : ''}${weeklyCount}/${weeklyGoal} השבוע</span>
                </span>
            </div>
        </div>
    `;
}

function renderHabitsList() {
    const container = document.getElementById('habitsListContainer');

    const categoryFiltered =
        trackerSelectedCategory === 'הכל'
            ? Store.habits
            : Store.habits.filter(h => getHabitCategoryDisplay(h) === trackerSelectedCategory);
    // Habits only appear from their start date: the focus view checks the selected day,
    // the weekly table checks whether the habit started at some point during the visible week
    const filtered = categoryFiltered.filter(h =>
        currentViewMode === 'focus' ? isHabitActiveOnKey(h, selectedDateKey) : isHabitActiveInDays(h, weekDays)
    );

    if (filtered.length === 0 && categoryFiltered.length > 0) {
        container.className = '';
        patchHTML(
            container,
            `
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700">
                
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">${currentViewMode === 'focus' ? 'אין הרגלים פעילים ביום הזה' : 'אין הרגלים פעילים בשבוע הזה'}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">כל הרגל מופיע רק מתאריך ההתחלה שלו ועד שהועבר לארכיון. אפשר לשנות את תאריך ההתחלה בעריכת ההרגל.</p>
                <button data-action="jumpToToday" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition">חזרה להיום</button>
            </div>
        `
        );
        return;
    }

    if (filtered.length === 0) {
        container.className = '';
        patchHTML(
            container,
            `
            <div class="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700">
                <div class="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
                    <svg class="w-6 h-6 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/></svg>
                </div>
                <h3 class="text-sm font-bold text-slate-800 dark:text-slate-100">${Store.habits.length === 0 ? 'עוד אין לכם הרגלים' : 'אין הרגלים בקטגוריה זו'}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">${Store.habits.length === 0 ? 'הוסיפו את ההרגל הראשון שלכם כדי להתחיל.' : 'נסו קטגוריה אחרת, או הוסיפו הרגל חדש לקטגוריה הזו.'}</p>
                <div class="flex flex-wrap items-center justify-center gap-2">
                    <button data-action="newHabit" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition">
                        + הוספת הרגל
                    </button>
                    ${
                        Store.habits.length > 0
                            ? `
                        <button data-action="setCategoryFilter" data-cat="הכל" data-ctx="tracker" class="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition">
                            הצג את כל ההרגלים
                        </button>
                    `
                            : ''
                    }
                </div>
            </div>
        `
        );
        return;
    }

    if (currentViewMode === 'focus') {
        container.className = 'space-y-6';
        const selectedDayObj = weekDays.find(d => d.key === selectedDateKey) || weekDays[0];
        const selectedDayOfWeek = selectedDayObj.dateObj.getDay();
        const isSelectedDayFuture = isFutureDateKey(selectedDateKey);

        // 4 Logical Groups:
        // 1. Scheduled Today - Not Done Yet
        // 2. Scheduled Today - Done
        // 3. Flexible This Week ('flexible')
        // 4. Not Scheduled Today (Rest Days - collapsed by default)
        const scheduledNotDone = [];
        const scheduledDone = [];
        const flexibleHabits = [];
        const unscheduledRestHabits = [];

        // Each card uses the settings in force on the selected day
        const dayHabits = filtered.map(h => habitOn(h, selectedDateKey));
        dayHabits.forEach(habit => {
            const isDone = !isSelectedDayFuture && !!(habit.history && habit.history[selectedDateKey]);
            if (habit.goalType === 'flexible') {
                flexibleHabits.push(habit);
            } else if (isHabitScheduledForDayOfWeek(habit, selectedDayOfWeek)) {
                if (isDone) {
                    scheduledDone.push(habit);
                } else {
                    scheduledNotDone.push(habit);
                }
            } else {
                unscheduledRestHabits.push(habit);
            }
        });

        // Cards are listed alphabetically by name, so a card never jumps while ticking habits off.
        const orderedScheduled = [...scheduledNotDone, ...scheduledDone].sort((x, y) => compareByName(x.name, y.name));
        flexibleHabits.sort((x, y) => compareByName(x.name, y.name));
        unscheduledRestHabits.sort((x, y) => compareByName(x.name, y.name));
        let sectionsHtml = '';

        // Day plan by time: when at least one habit of the day has a time, split into
        // morning / noon / evening / any time. A flexible habit with a time joins the plan
        // while its weekly quota isn't met yet, or when it was ticked on this day.
        // A habit done several times a day becomes one card per occurrence (its own time and mark)
        const expand = list =>
            list.flatMap(h =>
                h.slotTimes ? h.slotTimes.map((t, i) => ({ ...h, time: t, _slot: i, _slots: h.slotTimes.length })) : [h]
            );
        const itemKey = h => (h._slot !== undefined ? `${h.id}#${h._slot}` : h.id);
        const isDoneOnDay = h =>
            !isSelectedDayFuture &&
            (h._slot !== undefined
                ? isSlotDone(h, selectedDateKey, h._slot)
                : !!(h.history && h.history[selectedDateKey]));
        const flexInPlan = flexibleHabits.filter(
            h =>
                hasAnyTime(h) &&
                (isDoneOnDay(h) ||
                    getWeeklyCountForHabit(h, weekDays) < Math.max(1, getWeeklyGoalForHabit(h, weekDays)))
        );
        const usePlan = orderedScheduled.some(h => hasAnyTime(h)) || flexInPlan.length > 0;

        if (usePlan) {
            const planItems = expand([...orderedScheduled, ...flexInPlan]);
            const timed = planItems
                .filter(h => h.time)
                .sort((x, y) => timeToMinutes(x.time) - timeToMinutes(y.time) || compareByName(x.name, y.name));
            // Live state for today's open items: now / next / past
            const status = new Map();
            if (selectedDateKey === getDateKeyDaysAgo(0)) {
                const nowD = new Date();
                const nowMin = nowD.getHours() * 60 + nowD.getMinutes();
                const open = timed.filter(h => !isDoneOnDay(h));
                open.forEach(h => {
                    const start = timeToMinutes(h.time);
                    const end = start + (h.duration || 0);
                    if (h.duration > 0 && start <= nowMin && nowMin < end) status.set(itemKey(h), 'now');
                    else if (h.duration > 0 ? nowMin >= end : nowMin > start) status.set(itemKey(h), 'past');
                });
                const upcoming = open.filter(h => timeToMinutes(h.time) > nowMin);
                if (upcoming.length) {
                    const first = timeToMinutes(upcoming[0].time);
                    upcoming.filter(h => timeToMinutes(h.time) === first).forEach(h => status.set(itemKey(h), 'next'));
                }
            }
            const groups = [
                ...DAY_PARTS.map(part => ({ label: part.label, items: timed.filter(h => dayPartOf(h.time) === part) })),
                { label: 'בכל שעה', items: planItems.filter(h => !h.time) }
            ].filter(g => g.items.length > 0);
            groups.forEach(g => {
                const doneCount = g.items.filter(isDoneOnDay).length;
                sectionsHtml += `
                    <div class="space-y-3">
                        <div class="flex items-center gap-2 px-1">
                            <h3 class="text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200">${g.label}</h3>
                            <span class="text-xs font-semibold tabular-nums ${doneCount === g.items.length ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}">${doneCount}/${g.items.length}</span>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            ${g.items.map(h => buildHabitFocusCardHtml(h, selectedDayObj, isSelectedDayFuture, status.get(itemKey(h)) || null)).join('')}
                        </div>
                    </div>
                `;
            });
            // flexible habits that stay in their usual group
            const flexLeft = flexibleHabits.filter(h => !flexInPlan.includes(h));
            flexibleHabits.length = 0;
            flexibleHabits.push(...flexLeft);
        } else if (orderedScheduled.length > 0) {
            sectionsHtml += `
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    ${expand(orderedScheduled)
                        .map(h => buildHabitFocusCardHtml(h, selectedDayObj, isSelectedDayFuture))
                        .join('')}
                </div>
            `;
        }

        if (flexibleHabits.length > 0) {
            sectionsHtml += `
                <div class="space-y-3 pt-1">
                    <div class="flex items-center justify-between px-1">
                        <h3 class="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">גמישים השבוע</h3>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        ${expand(flexibleHabits)
                            .map(h => buildHabitFocusCardHtml(h, selectedDayObj, isSelectedDayFuture))
                            .join('')}
                    </div>
                </div>
            `;
        }

        if (unscheduledRestHabits.length > 0) {
            sectionsHtml += `
                <div class="pt-2 border-t border-slate-200/70 dark:border-slate-800/80">
                    <button type="button" id="restGroupToggle" data-action="toggleRestGroup" aria-expanded="${unscheduledSectionExpanded}" aria-controls="restGroupReveal" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-200/60 dark:bg-slate-900/80 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
                        <div class="flex items-center gap-2">
                            <span>לא מתוכננים היום (ימי מנוחה)</span>
                            <span class="px-2 py-0.5 rounded-full bg-slate-300/70 dark:bg-slate-800 text-xs font-semibold">${unscheduledRestHabits.length}</span>
                        </div>
                        <span class="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                            <span class="inline-flex items-center gap-1"><span data-toggle-text>${unscheduledSectionExpanded ? 'הסתר' : 'הצג הכל'}</span>${icon('chevronDown', 'w-4 h-4 transition-transform' + (unscheduledSectionExpanded ? ' rotate-180' : ''))}</span>
                        </span>
                    </button>
                    <div id="restGroupReveal" class="reveal ${unscheduledSectionExpanded ? 'is-open' : ''}" ${unscheduledSectionExpanded ? '' : 'inert'}>
                        <div>
                            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-3">
                                ${unscheduledRestHabits.map((h, i) => `<div class="stagger-item grid" style="--i:${Math.min(i, 5)}">${buildHabitFocusCardHtml(h, selectedDayObj, isSelectedDayFuture)}</div>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        patchHTML(container, sectionsHtml);
    } else {
        // Weekly Matrix Table (focused purely on logging across the week)
        container.className = 'space-y-3';

        const desktopHeaders = weekDays
            .map(d => {
                const isSelected = d.key === selectedDateKey;
                return `
                <th scope="col" ${isSelected ? 'aria-current="date"' : ''} class="p-1 text-center ${isSelected ? 'bg-indigo-50/80 dark:bg-indigo-950/40' : ''}">
                    <button type="button" ${d.isFuture ? 'disabled' : `data-action="selectDay" data-key="${d.key}"`} title="${d.isFuture ? 'תאריך עתידי — לא ניתן לבחור' : `בחירת ${d.dayFull}`}" aria-pressed="${isSelected}" class="w-full min-h-[44px] py-1.5 px-1 rounded-lg transition ${
                        d.isFuture
                            ? 'text-slate-400 dark:text-slate-600 opacity-60 cursor-not-allowed'
                            : isSelected
                              ? 'text-indigo-700 dark:text-indigo-300'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }">
                        <span class="block text-xs font-semibold">${d.dayShort}</span>
                        <span class="block text-xs font-normal">${d.dayNum}/${d.dateObj.getMonth() + 1}</span>
                    </button>
                </th>
            `;
            })
            .join('');

        const desktopRows = filtered
            .map(habit => {
                const colorMeta = getColorMeta(habit.color);
                const streakText = getHabitStreakText(habit);
                const weeklyCount = getWeeklyCountForHabit(habit, weekDays);
                const weeklyGoal = getWeeklyGoalForHabit(habit, weekDays);
                const goalLabel = getHabitGoalLabel(habit);
                const isFlexible = habit.goalType === 'flexible';

                const dayCells = weekDays
                    .map(d => {
                        const isDayFuture = d.isFuture || isFutureDateKey(d.key);
                        const checked = !isDayFuture && !!(habit.history && habit.history[d.key]);
                        const isSelected = d.key === selectedDateKey;
                        const isDayScheduled = isHabitScheduledOnKey(habit, d.key, d.dateObj.getDay());
                        const isDayFlexible = isFlexibleOnKey(habit, d.key);
                        const isBeforeStart = !isHabitActiveOnKey(habit, d.key);
                        if (isBeforeStart) {
                            return `
                    <td class="p-2 text-center ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''}">
                        <span title="לפני תחילת ההרגל (${formatStartDateLabel(habit.startDate)})" class="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-slate-300 dark:text-slate-700 select-none">·</span>
                    </td>
                    `;
                        }
                        return `
                    <td class="p-2 text-center ${isSelected ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''}">
                        <button type="button" ${isDayFuture ? 'disabled' : `data-action="toggleDay" data-id="${escapeHtml(habit.id)}" data-key="${d.key}"`} data-cell-pop="${lastToggle && lastToggle.on && lastToggle.id === habit.id && lastToggle.key === d.key ? '1' : ''}" title="${isDayFuture ? 'תאריך עתידי - לא ניתן לסמן' : isDayFlexible ? 'גמיש השבוע' : isDayScheduled ? 'יום מתוכנן' : 'יום מנוחה'}" aria-label="סמן ${escapeHtml(habit.name)} ב${d.dayFull}" class="w-10 h-10 mx-auto rounded-xl border flex items-center justify-center transition ${
                            isDayFuture
                                ? 'bg-transparent border-transparent cursor-not-allowed pointer-events-none'
                                : checked
                                  ? `${colorMeta.bg} text-white border-transparent shadow-sm`
                                  : isDayScheduled || isDayFlexible
                                    ? 'bg-slate-50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                                    : 'bg-transparent text-slate-300 dark:text-slate-700 border-dashed border-slate-200 dark:border-slate-800 opacity-55 hover:opacity-100'
                        }">
                            ${isDayFuture ? '' : checked ? icon('check', 'w-5 h-5', 3) : isDayScheduled || isDayFlexible ? '–' : '•'}
                        </button>
                    </td>
                `;
                    })
                    .join('');

                return `
                <tr class="border-t border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td class="py-3.5 px-4">
                        <div class="flex items-center gap-3">
                            <span class="w-10 h-10 rounded-xl ${colorMeta.softBg} flex items-center justify-center text-lg shrink-0">${escapeHtml(habit.icon)}</span>
                            <div class="min-w-0">
                                <div class="text-sm font-bold text-slate-900 dark:text-white truncate">${escapeHtml(habit.name)}</div>
                                <div class="flex items-center flex-wrap gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                    <span>${escapeHtml(getHabitCategoryDisplay(habit))}</span>
                                    <span>•</span>
                                    <span>${escapeHtml(goalLabel)}</span>
                                    ${streakText ? `<span>•</span><span>${streakText}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </td>
                    ${dayCells}
                    <td class="py-3.5 px-4 text-center">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            weeklyGoal > 0 && weeklyCount >= weeklyGoal
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }">${weeklyCount}/${weeklyGoal}</span>
                    </td>
                </tr>
            `;
            })
            .join('');

        const mobileGridCards = filtered
            .map(habit => {
                const colorMeta = getColorMeta(habit.color);
                const streakLongText = getHabitStreakLongText(habit);
                const weeklyCount = getWeeklyCountForHabit(habit, weekDays);
                const weeklyGoal = getWeeklyGoalForHabit(habit, weekDays);

                const gridButtons = weekDays
                    .map(d => {
                        const isDayFuture = d.isFuture || isFutureDateKey(d.key);
                        const checked = !isDayFuture && !!(habit.history && habit.history[d.key]);
                        const isSelected = d.key === selectedDateKey;
                        if (!isHabitActiveOnKey(habit, d.key)) {
                            return `
                    <span title="לפני תחילת ההרגל" class="flex flex-col items-center py-2 rounded-xl border border-transparent text-slate-300 dark:text-slate-700 select-none">
                        <span class="text-xs font-semibold">${d.dayLetter}</span>
                        <span class="text-xs font-semibold mt-0.5">·</span>
                    </span>
                    `;
                        }
                        return `
                    <button type="button" ${isDayFuture ? 'disabled' : `data-action="toggleDay" data-id="${escapeHtml(habit.id)}" data-key="${d.key}"`} data-cell-pop="${lastToggle && lastToggle.on && lastToggle.id === habit.id && lastToggle.key === d.key ? '1' : ''}" class="min-h-[44px] flex flex-col items-center justify-center py-2 rounded-xl border transition ${
                        isDayFuture
                            ? 'bg-transparent border-transparent cursor-not-allowed pointer-events-none'
                            : checked
                              ? `${colorMeta.bg} text-white border-transparent shadow-sm`
                              : 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200/70 dark:border-slate-700/70'
                    } ${isSelected ? 'ring-2 ring-indigo-500/50' : ''}">
                        <span class="text-xs font-semibold ${checked ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}">${d.dayLetter}</span>
                        <span class="text-xs font-semibold mt-0.5 h-4 flex items-center">${isDayFuture ? '&nbsp;' : checked ? icon('check', 'w-4 h-4', 3) : '–'}</span>
                    </button>
                `;
                    })
                    .join('');

                return `
                <div class="md:hidden bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                            <span class="w-9 h-9 rounded-xl ${colorMeta.softBg} flex items-center justify-center text-lg shrink-0">${escapeHtml(habit.icon)}</span>
                            <div class="min-w-0">
                                <h3 class="text-sm font-bold text-slate-900 dark:text-white truncate">${escapeHtml(habit.name)}</h3>
                                <div class="flex items-center flex-wrap gap-2 text-xs">
                                    ${streakLongText ? `<span class="text-slate-500 dark:text-slate-400">${streakLongText}</span><span class="text-slate-500 dark:text-slate-400">•</span>` : ''}
                                    <span class="text-slate-500 dark:text-slate-400">${weeklyCount}/${weeklyGoal} השבוע</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="grid grid-cols-7 gap-1.5">
                        ${gridButtons}
                    </div>
                </div>
            `;
            })
            .join('');

        patchHTML(
            container,
            `
            <div class="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-right border-collapse">
                        <thead>
                            <tr class="bg-slate-50/80 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs">
                                <th scope="col" class="py-3.5 px-4 font-bold">הרגל</th>
                                ${desktopHeaders}
                                <th scope="col" class="py-3.5 px-4 text-center font-bold">יעד שבועי</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${desktopRows}
                        </tbody>
                    </table>
                </div>
            </div>
            ${mobileGridCards}
        `
        );
    }
}

function renderManageSection() {
    const grid = document.getElementById('manageHabitsGrid');
    const subtitle = document.getElementById('manageHabitsSubtitle');
    if (!grid) return;

    const liveHabits = getLiveHabits();
    const filtered =
        manageSelectedCategory === 'הכל'
            ? liveHabits
            : liveHabits.filter(h => getHabitCategoryDisplay(h) === manageSelectedCategory);

    if (subtitle) {
        subtitle.textContent = `מוצגים ${filtered.length} מתוך ${liveHabits.length} הרגלים`;
    }
    renderArchiveSection();
    manageVisibleHabitIds = filtered.map(h => h.id);
    selectedHabitIds.forEach(id => {
        if (!manageVisibleHabitIds.includes(id)) selectedHabitIds.delete(id);
    });
    updateManageBulkBar();

    if (filtered.length === 0) {
        patchHTML(
            grid,
            `
            <div class="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700">
                <p class="text-sm font-bold text-slate-700 dark:text-slate-200">לא נמצאו הרגלים בקטגוריה זו</p>
                <button data-action="newHabit" class="mt-3 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold">
                    + הוספת הרגל חדש
                </button>
            </div>
        `
        );
        return;
    }

    patchHTML(
        grid,
        filtered
            .map(habit => {
                const colorMeta = getColorMeta(habit.color);
                const goalLabel = getHabitGoalLabel(habit);
                const streak = calculateStreak(habit);
                const streakUnit = getHabitStreakUnit(habit);
                const totalHistoryChecks = habit.history ? Object.values(habit.history).filter(Boolean).length : 0;
                const menuId = escapeHtml(`habitMenu_${habit.id}`);
                const isSelected = manageSelectMode && selectedHabitIds.has(habit.id);

                const daysBadges = HEBREW_DAYS_SHORT.map((dLabel, idx) => {
                    const active = habit.goalType === 'flexible' || isHabitScheduledForDayOfWeek(habit, idx);
                    return `
                <span class="w-7 h-7 rounded-lg text-xs font-semibold flex items-center justify-center ${
                    active
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        : 'text-slate-300 dark:text-slate-600'
                }">${dLabel}</span>
            `;
                }).join('');

                return `
            <div role="button" tabindex="0" data-habit-card="${escapeHtml(habit.id)}" data-flip-key="m-${escapeHtml(habit.id)}" data-action="manageCard" data-id="${escapeHtml(habit.id)}" data-key-activate ${manageSelectMode ? `aria-pressed="${isSelected}"` : ''} aria-label="${manageSelectMode ? 'בחירת' : 'עריכת'} ${escapeHtml(habit.name)}" class="${flashClassFor(habit.id)} habit-drag-card group cursor-pointer bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border flex flex-col justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition ${
                isSelected
                    ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
                    : 'border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }">
                <div class="flex items-stretch justify-between gap-3">
                    <div class="flex items-start gap-3.5 min-w-0">
                        <div class="w-12 h-12 rounded-xl ${colorMeta.softBg} flex items-center justify-center text-2xl shrink-0">
                            ${escapeHtml(habit.icon)}
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center flex-wrap gap-1.5">
                                <span class="text-xs font-semibold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                    ${escapeHtml(getHabitCategoryDisplay(habit))}
                                </span>
                                <span class="text-xs font-normal text-slate-500 dark:text-slate-400">
                                    ${escapeHtml(goalLabel)}
                                </span>
                                ${
                                    habit.time
                                        ? timeRangeHtml(
                                              habit.time,
                                              habit.duration,
                                              'text-xs font-semibold text-slate-600 dark:text-slate-300'
                                          )
                                        : habit.slotTimes
                                          ? habit.slotTimes.some(Boolean)
                                              ? `<span dir="ltr" class="tabular-nums text-xs font-semibold text-slate-600 dark:text-slate-300">${habit.slotTimes.filter(Boolean).join(' · ')}</span>`
                                              : ''
                                          : habit.dayTimes
                                            ? `<span data-tip="${escapeHtml(scheduleTimeSummary(habit))}" data-tip-touch class="text-xs font-semibold text-slate-600 dark:text-slate-300 underline decoration-dotted underline-offset-2">שעות משתנות</span>`
                                            : ''
                                }
                            </div>
                            <h3 class="text-base font-bold text-slate-900 dark:text-white mt-1.5 truncate">
                                ${escapeHtml(habit.name)}
                            </h3>
                            ${habit.note ? `<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${escapeHtml(habit.note)}</p>` : ''}
                        </div>
                    </div>

                    ${
                        manageSelectMode
                            ? `
                    <span class="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${habit.id === lastSelectToggledId && isSelected ? 'pip-pop' : ''} ${selectModeJustChanged ? 'fade-in-quick' : ''} ${
                        isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                    }" aria-hidden="true">${isSelected ? '<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}</span>
                    `
                            : `
                    <div class="flex flex-col items-center shrink-0 -mt-1 -ml-1">
                    <!-- Overflow menu: edit / archive / delete -->
                    <div class="relative">
                        <button type="button" data-action="toggleMenu" data-arg="${menuId}" aria-haspopup="menu" aria-expanded="false" aria-label="פעולות עבור ${escapeHtml(habit.name)}" title="פעולות" class="tap-44 w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
                        </button>
                        <div id="${menuId}" data-menu-panel role="menu" data-stop-propagation class="hidden absolute top-full mt-1.5 left-0 z-30 min-w-[12rem] p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg">
                            <button type="button" role="menuitem" data-action="menuEdit" data-id="${escapeHtml(habit.id)}" class="w-full text-right px-3 py-2 rounded-lg text-sm font-normal text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">עריכה</button>
                            <button type="button" role="menuitem" data-action="menuArchive" data-id="${escapeHtml(habit.id)}" class="w-full text-right px-3 py-2 rounded-lg text-sm font-normal text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">העברה לארכיון</button>
                            <button type="button" role="menuitem" data-action="menuDelete" data-id="${escapeHtml(habit.id)}" class="w-full text-right px-3 py-2 rounded-lg text-sm font-normal text-rose-600 dark:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">מחיקה</button>
                        </div>
                    </div>
                    <!-- Drag handle (under the menu, centred in the remaining height): makes "drag to another category" discoverable -->
                    <span data-tip="גררו להעברה לקטגוריה אחרת" aria-hidden="true" class="self-end -ml-[2px] w-5 flex-1 min-h-8 flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-grab group-hover:text-slate-700 dark:group-hover:text-slate-200 transition"><svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg></span>
                    </div>
                    `
                    }
                </div>

                <!-- Scheduled Days & Stats -->
                <div class="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-1" title="ימי פעילות בשבוע">
                        ${daysBadges}
                    </div>
                    <div class="text-xs text-slate-500 dark:text-slate-400">
                        ${streak > 0 ? `<span>רצף ${streak} ${streakUnit}</span><span class="mx-1 text-slate-300 dark:text-slate-600">·</span>` : ''}
                        <span>${totalHistoryChecks} סימונים</span>
                        <span class="block mt-0.5 text-xs text-slate-500 dark:text-slate-400">החל מ-${formatStartDateLabel(habit.startDate)}</span>
                    </div>
                </div>
            </div>
        `;
            })
            .join('')
    );
}

// Small overflow (⋯) menus
function closeAllMenus() {
    document.querySelectorAll('[data-menu-panel]').forEach(panel => {
        if (panel.getAttribute('role') === 'listbox') return; // custom selects close themselves
        if (panel.classList.contains('hidden') || panel.classList.contains('is-closing')) return;
        if (prefersReducedMotion()) {
            panel.classList.add('hidden');
            return;
        }
        panel.classList.add('is-closing');
        panel._closeTimer = setTimeout(() => {
            panel.classList.add('hidden');
            panel.classList.remove('is-closing');
        }, 100);
    });
    document.querySelectorAll('[aria-haspopup="menu"]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
}

function toggleMenu(event, menuId, trigger) {
    event.stopPropagation();
    const panel = document.getElementById(menuId);
    if (!panel) return;
    const wasOpen = !panel.classList.contains('hidden') && !panel.classList.contains('is-closing');
    closeAllMenus();
    if (!wasOpen) {
        clearTimeout(panel._closeTimer);
        panel.classList.remove('hidden', 'is-closing');
        trigger.setAttribute('aria-expanded', 'true');
    }
}

document.addEventListener('click', closeAllMenus);
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllMenus();
});

// ===== Manage: multi-select, bulk actions, drag & drop between categories =====
let manageSelectMode = false;
const selectedHabitIds = new Set();
let manageVisibleHabitIds = [];
let categorySelectMode = false;
const selectedCategories = new Set();
let suppressNextCardClick = false;
const habitDragState = { pending: null, active: false, ids: [], target: null };

let lastSelectToggledId = null;
let selectModeJustChanged = false;
function handleManageCardClick(id) {
    if (suppressNextCardClick) {
        suppressNextCardClick = false;
        return;
    }
    if (manageSelectMode) {
        if (selectedHabitIds.has(id)) selectedHabitIds.delete(id);
        else selectedHabitIds.add(id);
        lastSelectToggledId = id;
        renderManageSection();
        lastSelectToggledId = null;
    } else {
        openHabitModal(id);
    }
}

function toggleManageSelectMode() {
    if (manageSelectMode) exitManageSelectMode();
    else {
        manageSelectMode = true;
        closeAllMenus();
        selectModeJustChanged = true;
        renderManageSection();
        selectModeJustChanged = false;
    }
}

function exitManageSelectMode() {
    manageSelectMode = false;
    selectedHabitIds.clear();
    renderManageSection();
}

function toggleSelectAllManageHabits() {
    const allSelected = manageVisibleHabitIds.length > 0 && manageVisibleHabitIds.every(id => selectedHabitIds.has(id));
    if (allSelected) selectedHabitIds.clear();
    else manageVisibleHabitIds.forEach(id => selectedHabitIds.add(id));
    renderManageSection();
}

function updateManageBulkBar() {
    const bar = document.getElementById('manageBulkBar');
    const toggle = document.getElementById('manageSelectToggleBtn');
    if (toggle) {
        toggle.textContent = manageSelectMode ? 'סיום' : 'בחירה';
        toggle.setAttribute('aria-pressed', String(manageSelectMode));
    }
    if (!bar) return;
    bar.classList.toggle('hidden', !manageSelectMode);
    const section = document.getElementById('section_manage');
    if (section) section.classList.toggle('pb-24', manageSelectMode);
    const n = selectedHabitIds.size;
    document.getElementById('manageBulkCount').textContent = n === 0 ? 'בחרו הרגלים' : `נבחרו ${n}`;
    const allSelected = manageVisibleHabitIds.length > 0 && manageVisibleHabitIds.every(id => selectedHabitIds.has(id));
    document.getElementById('manageBulkSelectAllBtn').textContent = allSelected ? 'ניקוי בחירה' : 'בחירת הכל';
    document.getElementById('manageBulkArchiveBtn').disabled = n === 0;
    document.getElementById('manageBulkDeleteBtn').disabled = n === 0;
}

function archiveHabitsByIds(ids) {
    animateOut(ids, () => archiveHabitsByIdsNow(ids));
}

function archiveHabitsByIdsNow(ids) {
    const snapshot = createUndoSnapshot();
    const count = Store.archiveHabits(ids, getDateKeyDaysAgo(0), getDateKeyDaysAgo(-1));
    if (!count) return;
    manageSelectMode = false;
    selectedHabitIds.clear();
    showToast(`${habitCountLabel(count)} הועברו לארכיון`, snapshot);
    renderAll();
}

function bulkArchiveSelectedHabits() {
    if (selectedHabitIds.size === 0) return;
    archiveHabitsByIds([...selectedHabitIds]);
}

function bulkDeleteSelectedHabits() {
    const ids = [...selectedHabitIds];
    if (ids.length === 0) return;
    const label = habitCountLabel(ids.length);
    openConfirmModal(
        `מחיקת ${label}?`,
        `${ids.length === 1 ? 'ההרגל שנבחר וכל ההיסטוריה שלו יימחקו' : `${label} וכל ההיסטוריה שלהם יימחקו`} גם מהימים הקודמים. אם רק הפסקתם לעקוב, עדיף להעביר לארכיון: ההיסטוריה נשמרת ואפשר לשחזר.`,
        () =>
            animateOut(ids, () => {
                const snapshot = createUndoSnapshot();
                manageSelectMode = false;
                selectedHabitIds.clear();
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
    const staysVisible = manageSelectedCategory === 'הכל' || manageSelectedCategory === targetCat;
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
    const dragged = Store.habits.filter(h => habitDragState.ids.includes(h.id));
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
    if (habitDragState.target === el) return;
    if (habitDragState.target) {
        habitDragState.target.classList.remove('bg-indigo-600', 'text-white', 'dark:text-white', 'scale-105');
    }
    habitDragState.target = el;
    if (el) el.classList.add('bg-indigo-600', 'text-white', 'dark:text-white', 'scale-105');
}

function moveGhost(x, y) {
    const ghost = document.getElementById('habitDragGhost');
    ghost.style.transform = `translate(${x + 12}px, ${y + 12}px) rotate(-2deg)`;
}

function startHabitDrag(x, y) {
    const p = habitDragState.pending;
    if (!p) return;
    const ids = manageSelectMode && selectedHabitIds.has(p.id) ? [...selectedHabitIds] : [p.id];
    habitDragState.active = true;
    habitDragState.ids = ids;
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
    const p = habitDragState.pending;
    if (p && p.timer) clearTimeout(p.timer);
    habitDragState.pending = null;
    detachDragListeners();
    if (dragFrame) {
        cancelAnimationFrame(dragFrame);
        dragFrame = 0;
    }
    // the drop target follows the last pointer position, even if its frame hadn't run yet
    if (habitDragState.active && dragPoint) updateDragPosition(dragPoint[0], dragPoint[1]);
    dragPoint = null;
    if (!habitDragState.active) return;
    const target = habitDragState.target;
    const ids = habitDragState.ids;
    setDropTarget(null);
    habitDragState.active = false;
    habitDragState.ids = [];
    document.getElementById('habitDragGhost').classList.add('hidden');
    document.getElementById('habitDropTray').classList.add('hidden');
    document.body.classList.remove('is-dragging-habit');
    suppressNextCardClick = true;
    setTimeout(() => {
        suppressNextCardClick = false;
    }, 400);
    if (drop && target && target.dataset.current !== 'true') {
        if (manageSelectMode) {
            manageSelectMode = false;
            selectedHabitIds.clear();
        }
        moveHabitsToCategory(ids, target.dataset.dropCategory);
    } else {
        renderManageSection();
    }
}

// Only pointerdown listens all the time. The move / up / touch / Escape listeners exist only
// between pressing a card and the end of that press or drag, and are removed right after.
function onDragPointerMove(e) {
    const p = habitDragState.pending;
    if (!p) return;
    if (!habitDragState.active) {
        const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        if (p.pointerType === 'mouse') {
            if (moved > 6) startHabitDrag(e.clientX, e.clientY);
            else return;
        } else {
            if (moved > 10) {
                clearTimeout(p.timer);
                habitDragState.pending = null;
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
    const p = habitDragState.pending;
    if (habitDragState.active && p && p.pointerType !== 'mouse') return;
    endHabitDrag(false);
}
function onDragTouchMove(e) {
    if (!habitDragState.active) return;
    e.preventDefault();
    const t = e.touches[0];
    if (t) scheduleDragPosition(t.clientX, t.clientY);
}
function onDragTouchEnd() {
    if (habitDragState.active) endHabitDrag(true);
}
function onDragTouchCancel() {
    if (habitDragState.active) endHabitDrag(false);
}
function onDragContextMenu(e) {
    if (habitDragState.pending || habitDragState.active) e.preventDefault();
}
function onDragKeydown(e) {
    if (e.key === 'Escape' && habitDragState.active) endHabitDrag(false);
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

document.addEventListener('pointerdown', e => {
    suppressNextCardClick = false;
    const card = e.target.closest('[data-habit-card]');
    if (!card || currentMainSection !== 'manage') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest('[aria-haspopup], [data-menu-panel]')) return;
    const p = { id: card.dataset.habitCard, x: e.clientX, y: e.clientY, pointerType: e.pointerType, timer: null };
    if (e.pointerType !== 'mouse') {
        p.timer = setTimeout(() => startHabitDrag(p.x, p.y), 380);
    }
    habitDragState.pending = p;
    attachDragListeners();
});

// The ghost follows the pointer once per frame, however many move events arrive
let dragFrame = 0;
let dragPoint = null;
function scheduleDragPosition(x, y) {
    dragPoint = [x, y];
    if (dragFrame) return;
    dragFrame = requestAnimationFrame(() => {
        dragFrame = 0;
        if (habitDragState.active && dragPoint) updateDragPosition(dragPoint[0], dragPoint[1]);
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
    if (Store.categories.length === 0 && categorySelectMode) categorySelectMode = false;
    toolbar.classList.toggle('hidden', Store.categories.length === 0);
    toggle.textContent = categorySelectMode ? 'ביטול' : 'בחירה';
    allBtn.classList.toggle('hidden', !categorySelectMode);
    const allSelected = Store.categories.length > 0 && Store.categories.every(c => selectedCategories.has(c));
    allBtn.textContent = allSelected ? 'ניקוי בחירה' : 'בחירת הכל';
    info.textContent = categorySelectMode ? `נבחרו ${selectedCategories.size}` : `${Store.categories.length} קטגוריות`;
    delBtn.classList.toggle('hidden', !categorySelectMode);
    delBtn.disabled = selectedCategories.size === 0;
    delBtn.textContent =
        selectedCategories.size > 1 ? `מחיקת ${selectedCategories.size} קטגוריות` : 'מחיקת הקטגוריה שנבחרה';
}

function toggleCategorySelectMode() {
    categorySelectMode = !categorySelectMode;
    selectedCategories.clear();
    editingCategoryName = null;
    renderCategoryManagerItems();
}

function toggleCategorySelected(cat) {
    if (selectedCategories.has(cat)) selectedCategories.delete(cat);
    else selectedCategories.add(cat);
    renderCategoryManagerItems();
}

function toggleSelectAllCategories() {
    const allSelected = Store.categories.every(c => selectedCategories.has(c));
    if (allSelected) selectedCategories.clear();
    else Store.categories.forEach(c => selectedCategories.add(c));
    renderCategoryManagerItems();
}

function bulkDeleteSelectedCategories() {
    const cats = [...selectedCategories];
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
            if (cats.includes(trackerSelectedCategory)) trackerSelectedCategory = 'הכל';
            if (cats.includes(manageSelectedCategory)) manageSelectedCategory = 'הכל';
            selectedCategories.clear();
            categorySelectMode = false;
            Store.deleteCategories(cats);
            populateCategorySelectDropdown();
            renderAll();
            renderCategoryManagerItems();
            showToast(`${cats.length === 1 ? 'הקטגוריה נמחקה' : `${cats.length} קטגוריות נמחקו`}`, snapshot);
        },
        { confirmLabel: 'מחיקה' }
    );
}

function getTrackerVisibleHabits() {
    const byCategory =
        trackerSelectedCategory === 'הכל'
            ? Store.habits
            : Store.habits.filter(h => getHabitCategoryDisplay(h) === trackerSelectedCategory);
    return byCategory.filter(h => isHabitActiveOnKey(h, selectedDateKey));
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

    lastToggledHabitId = newState ? habitId : null;
    lastToggle = { id: habitId, key: dateKey, on: newState, slot: result.slot };
    if (newState && !wasAllDone && nowAllDone) celebrateDayKey = dateKey;
    if (newState && navigator.vibrate && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        try {
            navigator.vibrate(10);
        } catch (e) {}
    }
    renderAll();
    lastToggledHabitId = null;
    lastToggle = null;
    celebrateDayKey = null;
}

function markAllForSelectedDay() {
    if (isFutureDateKey(selectedDateKey)) {
        showToast('לא ניתן לסמן הרגלים בתאריך שעוד לא הגיע');
        return;
    }
    if (Store.habits.length === 0) return;
    const selectedDayObj = weekDays.find(d => d.key === selectedDateKey) || weekDays[0];
    const dayIdx = selectedDayObj.dateObj.getDay();
    // Only the habits the user can actually see (respects the category filter)
    const targetHabits = getTrackerVisibleHabits().filter(h => isHabitScheduledOnKey(h, selectedDateKey, dayIdx));
    if (targetHabits.length === 0) return;

    const snapshot = createUndoSnapshot();
    Store.markDay(
        targetHabits.map(h => h.id),
        selectedDateKey
    );
    playFeedbackSound('celebrate');
    const label = selectedDayObj.isToday ? 'היום' : selectedDayObj.dayFull;
    showToast(`כל ההרגלים המתוכננים ל${label} סומנו!`, snapshot);
    renderAll();
}

function clearAllForSelectedDay() {
    if (isFutureDateKey(selectedDateKey)) return;
    const visibleHabits = getTrackerVisibleHabits();
    const anyChecked = visibleHabits.some(h => hasAnyMarkOnDay(h, selectedDateKey));
    if (!anyChecked) return;

    const snapshot = createUndoSnapshot();
    Store.clearDay(
        visibleHabits.map(h => h.id),
        selectedDateKey
    );
    playFeedbackSound('uncheck');
    showToast('הסימונים ליום זה נוקו', snapshot);
    renderAll();
}

// Save button state: needs a name; when editing, also needs a real change
let habitModalInitialState = null;

function getHabitFormState() {
    const goalType = selectedModalGoalType;
    return JSON.stringify({
        name: (document.getElementById('habitNameInput')?.value || '').trim(),
        category: document.getElementById('habitCategoryInput')?.value || '',
        startDate: document.getElementById('habitStartDateInput')?.value || '',
        goalType,
        weeklyGoal: goalType === 'flexible' ? String(document.getElementById('habitGoalInput')?.value || '') : '',
        fixedDays: goalType === 'fixed_days' ? [...selectedModalFixedDays].sort((a, b) => a - b) : [],
        note: (document.getElementById('habitNoteInput')?.value || '').trim(),
        icon: selectedModalIcon,
        color: selectedModalColor,
        timing: (() => {
            const d = getModalScheduleDef();
            return [d.time, d.duration, d.dayTimes, d.slotTimes];
        })()
    });
}

// ---- Time & duration fields ----
// ===== Time editor: once a day / several times a day / different times per day =====
// The window keeps a small model; one hour + minute pair edits the cell picked with the chips.
const timeModel = {
    uniform: ['', '', '', ''], // every day the same
    cells: Array.from({ length: 7 }, () => ['', '', '', '']), // per weekday, when days differ
    day: 0,
    slot: 0
};

function isPerDayTimesOn() {
    return !!document.getElementById('habitPerDayToggle')?.checked;
}

function modalSlotCount() {
    return Math.max(1, Math.min(MAX_SLOTS, Number(document.getElementById('habitTimesPerDay')?.value) || 1));
}

function modalActiveWeekdays() {
    return scheduleWeekdays({ goalType: selectedModalGoalType, fixedDays: selectedModalFixedDays });
}

function timeModelRow(day) {
    return isPerDayTimesOn() ? timeModel.cells[day] : timeModel.uniform;
}

function readModalTime() {
    const n = modalSlotCount();
    const duration = Number(document.getElementById('habitDuration')?.value) || 0;
    if (isPerDayTimesOn())
        return { time: '', duration, slotTimes: null, dayTimes: timeModel.cells.map(r => r.slice(0, n)) };
    if (n > 1) return { time: '', duration, dayTimes: null, slotTimes: timeModel.uniform.slice(0, n) };
    const t = timeModel.uniform[0] || '';
    return { time: t, duration: t ? duration : 0, dayTimes: null, slotTimes: null };
}

// Show the picked cell's time in the hour / minute fields
function loadEditorFromCell() {
    const t = timeModelRow(timeModel.day)[timeModel.slot] || '';
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
    timeModelRow(timeModel.day)[timeModel.slot] = hour ? `${hour}:${minute}` : '';
    syncHabitTimeFields();
}

function focusAfterRender(id) {
    const el = document.getElementById(id);
    if (el) el.focus({ preventScroll: true });
}

function pickTimeDay(d) {
    timeModel.day = d;
    loadEditorFromCell();
    syncHabitTimeFields();
    focusAfterRender(`timeDayChip_${d}`);
}

function pickTimeSlot(i) {
    timeModel.slot = i;
    loadEditorFromCell();
    syncHabitTimeFields();
    focusAfterRender(`timeSlotChip_${i}`);
}

// Switch on: every day starts from the shared times. Off: the first day with a time becomes the shared one.
function togglePerDayTimes(on) {
    const active = modalActiveWeekdays();
    if (on) {
        timeModel.cells = Array.from({ length: 7 }, () => [...timeModel.uniform]);
        if (!active.includes(timeModel.day)) timeModel.day = active[0];
    } else {
        const src = active.find(d => timeModel.cells[d].some(Boolean));
        timeModel.uniform = [...timeModel.cells[src !== undefined ? src : active[0]]];
    }
    loadEditorFromCell();
    syncHabitTimeFields();
    updateHabitSaveState();
}

// Occurrences beyond the new count are cleared, so they don't come back unexpectedly
function setModalTimesPerDay(n) {
    for (let i = n; i < MAX_SLOTS; i++) {
        timeModel.uniform[i] = '';
        timeModel.cells.forEach(r => {
            r[i] = '';
        });
    }
    if (timeModel.slot >= n) timeModel.slot = 0;
    loadEditorFromCell();
    syncHabitTimeFields();
    updateHabitSaveState();
}

function copyDayTimesToAll() {
    const src = [...timeModel.cells[timeModel.day]];
    timeModel.cells = timeModel.cells.map(() => [...src]);
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
    timeModel.uniform = pad(slotTimes || [time || '']);
    timeModel.cells = Array.from({ length: 7 }, (_, d) =>
        pad(dayTimes ? (Array.isArray(dayTimes[d]) ? dayTimes[d] : [dayTimes[d] || '']) : timeModel.uniform)
    );
    timeModel.day = modalActiveWeekdays()[0];
    timeModel.slot = 0;
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
    if (perDay && !active.includes(timeModel.day)) {
        timeModel.day = active[0];
        moved = true;
    }
    if (timeModel.slot >= n) {
        timeModel.slot = 0;
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
                    const t = timeModel.cells[d][timeModel.slot] || '';
                    return timeChipHtml(
                        `timeDayChip_${d}`,
                        `data-action="pickTimeDay" data-arg="${d}"`,
                        d === timeModel.day,
                        HEBREW_DAYS_SHORT[d],
                        t,
                        `${HEBREW_DAYS_FULL[d]}${n > 1 ? `, פעם ${timeModel.slot + 1}` : ''}: ${t || 'ללא שעה'}`
                    );
                })
                .join('')
        );
    }
    const slotChips = document.getElementById('timeSlotChips');
    slotChips.classList.toggle('hidden', n < 2);
    if (n > 1) {
        const row = timeModelRow(timeModel.day);
        patchHTML(
            slotChips,
            [...Array(n).keys()]
                .map(i =>
                    timeChipHtml(
                        `timeSlotChip_${i}`,
                        `data-action="pickTimeSlot" data-arg="${i}"`,
                        i === timeModel.slot,
                        `פעם ${i + 1}`,
                        row[i] || '',
                        `פעם ${i + 1}${perDay ? `, ${HEBREW_DAYS_FULL[timeModel.day]}` : ''}: ${row[i] || 'ללא שעה'}`,
                        'flex-1'
                    )
                )
                .join('')
        );
    }
    const caption = document.getElementById('timeEditCaption');
    caption.classList.toggle('hidden', !perDay && n < 2);
    caption.textContent = `השעה של ${[perDay ? HEBREW_DAYS_FULL[timeModel.day] : '', n > 1 ? `פעם ${timeModel.slot + 1}` : ''].filter(Boolean).join(', ')}:`;
    const copyBtn = document.getElementById('copyDayTimesBtn');
    copyBtn.classList.toggle('hidden', !perDay);
    copyBtn.textContent = `העתקת ${n > 1 ? 'השעות' : 'השעה'} של ${HEBREW_DAYS_FULL[timeModel.day]} לכל הימים`;

    setSelectDisabled('habitTimeMinute', !document.getElementById('habitTimeHour').value);
    setSelectDisabled('habitDuration', !hasAnyTime(readModalTime()));
    document.getElementById('habitDurationEach').classList.toggle('hidden', n < 2);
    updateHabitTimeHint();
    updateHabitModalSummaries();
}

function getModalScheduleDef() {
    const goalType = selectedModalGoalType;
    return normalizeScheduleFields({
        goalType,
        fixedDays: goalType === 'fixed_days' ? [...selectedModalFixedDays] : [],
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

// ---- "Which days does the change apply to?" ----
let scheduleScope = 'forward';

function setScheduleScope(scope) {
    scheduleScope = scope;
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
        const on = scheduleScope === sc;
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
        scheduleScope === 'forward'
            ? `הימים שעברו יישארו לפי ההגדרה הקודמת (${describeScheduleVersion(prev, hasAnyTime(def))}), כך שהסטטיסטיקה שלהם לא תשתנה.`
            : 'ההגדרה החדשה תחול גם על כל הימים שעברו, והסטטיסטיקה שלהם תחושב מחדש. מתאים לתיקון טעות.';
}

function isHabitFormSaveable() {
    const name = (document.getElementById('habitNameInput')?.value || '').trim();
    if (!name) return false;
    const isEditing = !!document.getElementById('habitIdInput')?.value;
    if (!isEditing) return true;
    return habitModalInitialState === null || getHabitFormState() !== habitModalInitialState;
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
    selectedModalGoalType = type;
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
    if (selectedModalFixedDays.includes(dayIdx)) {
        if (selectedModalFixedDays.length > 1) {
            selectedModalFixedDays = selectedModalFixedDays.filter(d => d !== dayIdx);
        } else {
            showToast('יש לבחור לפחות יום קבוע אחד בשבוע');
            shakeField(document.getElementById('fixedDaysPickerGrid'), false);
            return;
        }
    } else {
        selectedModalFixedDays.push(dayIdx);
        selectedModalFixedDays.sort((a, b) => a - b);
        justPicked = dayIdx;
    }
    renderFixedDaysPicker();
    justPicked = null;
    updateHabitSaveState();
}

function renderFixedDaysPicker() {
    const grid = document.getElementById('fixedDaysPickerGrid');
    const badge = document.getElementById('fixedDaysCountBadge');
    if (!grid || !badge) return;

    const count = selectedModalFixedDays.length;
    badge.textContent = count === 1 ? 'יום אחד נבחר' : `${count} ימים נבחרו`;

    patchHTML(
        grid,
        HEBREW_DAYS_SHORT.map((label, idx) => {
            const active = selectedModalFixedDays.includes(idx);
            return `
            <button type="button" data-action="toggleFixedDay" data-arg="${idx}" aria-pressed="${active}" aria-label="${HEBREW_DAYS_FULL[idx]}" data-cell-pop="${active && justPicked === idx ? '1' : ''}" class="min-w-0 min-h-[44px] py-2.5 rounded-xl font-semibold text-xs border transition-all ${
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
    selectedModalIcon = last;
    renderModalPickers();
    updateHabitSaveState();
}

function renderModalPickers() {
    const iconGrid = document.getElementById('iconPickerGrid');
    // 11 icons + the "+" tile fill two clean rows of 6. If the chosen icon is not among
    // them, it takes the last icon slot (the replaced one stays reachable from the "+" list).
    const iconList = ICON_OPTIONS.slice(0, 11).map(i => ({ emoji: i.emoji, label: i.label }));
    if (!iconList.some(i => i.emoji === selectedModalIcon)) {
        const known = ICON_OPTIONS.find(i => i.emoji === selectedModalIcon);
        iconList[10] = { emoji: selectedModalIcon, label: known ? known.label : 'אייקון מותאם אישית' };
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
                const active = item.emoji === selectedModalIcon;
                return `
            <button type="button" data-action="selectIcon" title="${escapeHtml(item.label)}" aria-label="אייקון: ${escapeHtml(item.label)}" aria-pressed="${active}" data-cell-pop="${active && justPicked === 'icon' ? '1' : ''}" class="h-11 rounded-xl text-xl flex items-center justify-center border transition ${
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
            const active = c.id === selectedModalColor;
            return `
            <button type="button" data-action="selectColor" data-arg="${c.id}" title="${c.name}" aria-label="צבע ${c.name}" aria-pressed="${active}" data-cell-pop="${active && justPicked === 'color' ? '1' : ''}" class="tap-44 w-10 h-10 shrink-0 rounded-full ${c.bg} flex items-center justify-center text-white text-sm font-bold transition ${
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
    const c = COLOR_OPTIONS.find(x => x.id === selectedModalColor) || COLOR_OPTIONS[0];
    prev.className = `w-12 h-12 rounded-xl flex items-center justify-center text-2xl border-2 ${c.softBg} ${c.border}`;
    prev.textContent = selectedModalIcon;
    const known = ICON_OPTIONS.find(i => i.emoji === selectedModalIcon);
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

let justPicked = null; // 'icon' | 'color' | day index — the option that pops on the next render
function shakeField(el, keepError = true) {
    if (!el) return;
    if (keepError) {
        el.classList.add('field-error');
        el.setAttribute('aria-invalid', 'true');
        el.addEventListener(
            'input',
            () => {
                el.classList.remove('field-error');
                el.removeAttribute('aria-invalid');
            },
            { once: true }
        );
    }
    if (prefersReducedMotion()) return;
    el.classList.remove('field-shake');
    void el.offsetWidth;
    el.classList.add('field-shake');
    setTimeout(() => el.classList.remove('field-shake'), 300);
}

function selectModalIcon(emoji) {
    selectedModalIcon = emoji;
    justPicked = 'icon';
    renderModalPickers();
    justPicked = null;
    updateHabitSaveState();
}

function selectModalColor(colorId) {
    selectedModalColor = colorId;
    justPicked = 'color';
    renderModalPickers();
    justPicked = null;
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
        selectedModalIcon = habit.icon || ICON_OPTIONS[0].emoji;
        selectedModalColor = habit.color || COLOR_OPTIONS[0].id;
        selectedModalGoalType = habit.goalType || 'daily';
        selectedModalFixedDays =
            Array.isArray(habit.fixedDays) && habit.fixedDays.length > 0 ? [...habit.fixedDays] : [0, 2, 4];
        setupStartDateInput(habit.startDate, habit);
        setModalTime(habit.time, habit.duration, habit.dayTimes, habit.slotTimes);
    } else {
        titleEl.textContent = 'הרגל חדש';
        document.getElementById('habitIdInput').value = '';
        document.getElementById('habitNameInput').value = '';
        const activeCat = currentMainSection === 'manage' ? manageSelectedCategory : trackerSelectedCategory;
        const defaultCat =
            activeCat !== 'הכל' && activeCat !== UNCATEGORIZED_LABEL ? activeCat : Store.categories[0] || '';
        populateCategorySelectDropdown(defaultCat);
        document.getElementById('habitGoalInput').value = '4';
        document.getElementById('habitNoteInput').value = '';
        selectedModalIcon = ICON_OPTIONS[0].emoji;
        selectedModalColor = COLOR_OPTIONS[0].id;
        selectedModalGoalType = 'daily';
        selectedModalFixedDays = [0, 2, 4];
        setupStartDateInput(getDateKeyDaysAgo(0), null);
        setModalTime('', 0);
    }
    scheduleScope = 'forward';

    setModalGoalType(selectedModalGoalType);
    renderModalPickers();
    habitModalInitialState = getHabitFormState();
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

    if (selectedModalGoalType === 'daily') {
        weeklyGoal = 7;
        fixedDays = [0, 1, 2, 3, 4, 5, 6];
    } else if (selectedModalGoalType === 'flexible') {
        weeklyGoal = parseInt(document.getElementById('habitGoalInput').value, 10) || 4;
        fixedDays = [];
    } else if (selectedModalGoalType === 'fixed_days') {
        fixedDays = [...selectedModalFixedDays].sort((a, b) => a - b);
        weeklyGoal = fixedDays.length;
    }

    const { time, duration, dayTimes, slotTimes } = readModalTime();
    const scheduleDef = normalizeScheduleFields({
        goalType: selectedModalGoalType,
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
                    icon: selectedModalIcon,
                    color: selectedModalColor,
                    startDate: readStartDateInput(existing)
                },
                scheduleDef,
                scheduleScope
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
            icon: selectedModalIcon,
            color: selectedModalColor,
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

let archiveSectionExpanded = false;

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
    archiveSectionExpanded = !archiveSectionExpanded;
    if (
        !setRevealOpen(
            document.getElementById('archiveReveal'),
            document.getElementById('archiveToggle'),
            archiveSectionExpanded,
            'הסתר',
            'הצג'
        )
    ) {
        renderArchiveSection();
    }
}

function renderArchiveSection() {
    const section = document.getElementById('manageArchiveSection');
    if (!section) return;
    const archived = Store.habits.filter(isHabitArchived);
    if (archived.length === 0) {
        section.classList.add('hidden');
        section.innerHTML = '';
        return;
    }
    section.classList.remove('hidden');
    const items = archived
        .map(habit => {
            const colorMeta = getColorMeta(habit.color);
            const totalChecks = habit.history ? Object.values(habit.history).filter(Boolean).length : 0;
            const lastActiveKey = (() => {
                const p = habit.archivedSince.split('-').map(Number);
                return formatDateKey(new Date(p[0], p[1] - 1, p[2] - 1));
            })();
            const rangeText =
                lastActiveKey < habit.startDate
                    ? 'לא היה פעיל'
                    : `${formatStartDateLabel(habit.startDate)} – ${formatStartDateLabel(lastActiveKey)}`;
            return `
            <div data-flip-key="a-${escapeHtml(habit.id)}" class="p-3.5 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <span class="w-10 h-10 rounded-xl ${colorMeta.softBg} flex items-center justify-center text-lg shrink-0 grayscale-[40%]">${escapeHtml(habit.icon)}</span>
                    <div class="min-w-0">
                        <div class="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">${escapeHtml(habit.name)}</div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 truncate">${escapeHtml(getHabitCategoryDisplay(habit))} · ${rangeText} · ${totalChecks} סימונים</div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <button data-action="restoreHabit" data-id="${escapeHtml(habit.id)}" class="h-9 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-xs font-semibold transition flex items-center gap-1.5">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5"/></svg>
                        <span>שחזור</span>
                    </button>
                    <button data-action="deleteHabit" data-id="${escapeHtml(habit.id)}" title="מחיקה לצמיתות" aria-label="מחיקת ${escapeHtml(habit.name)} לצמיתות" class="tap-44 w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center justify-center transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                </div>
            </div>
        `;
        })
        .join('');
    patchHTML(
        section,
        `
        <button type="button" id="archiveToggle" data-action="toggleArchive" aria-expanded="${archiveSectionExpanded}" aria-controls="archiveReveal" class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-200/60 dark:bg-slate-900/80 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition">
            <div class="flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                <span>ארכיון</span>
                <span class="px-2 py-0.5 rounded-full bg-slate-300/70 dark:bg-slate-800 text-xs font-semibold">${archived.length}</span>
            </div>
            <span class="text-xs font-semibold text-indigo-600 dark:text-indigo-400"><span class="inline-flex items-center gap-1"><span data-toggle-text>${archiveSectionExpanded ? 'הסתר' : 'הצג'}</span>${icon('chevronDown', 'w-4 h-4 transition-transform' + (archiveSectionExpanded ? ' rotate-180' : ''))}</span></span>
        </button>
        <div id="archiveReveal" class="reveal ${archiveSectionExpanded ? 'is-open' : ''}" ${archiveSectionExpanded ? '' : 'inert'}>
            <div>
                <p class="text-xs text-slate-500 dark:text-slate-400 px-1 pt-3 mb-2">הרגלים בארכיון לא מופיעים במעקב מהיום שהועברו, אבל ההיסטוריה שלהם נשמרת בסטטיסטיקה של הימים הקודמים.</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">${items}</div>
            </div>
        </div>
    `
    );
}

function openResetModal() {
    openConfirmModal(
        'איפוס הרגלים לדוגמה?',
        'האם לשחזר את רשימת ההרגלים והקטגוריות לדוגמה ואת נתוני השבוע הנוכחי?',
        () => {
            weekOffset = 0;
            weekDays = getWindow7Days(0);
            trackerSelectedCategory = 'הכל';
            manageSelectedCategory = 'הכל';
            selectedDateKey = getDateKeyDaysAgo(0);
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

// ===== Toast: short entry, undo countdown bar, pauses while hovered or focused =====
let toastTimer = null;
let toastEndsAt = 0;
let toastRemaining = 0;
const TOAST_HIDDEN = ['opacity-0', 'translate-y-2', 'scale-[0.96]', 'lg:-translate-y-2', 'pointer-events-none'];
const TOAST_SHOWN = ['opacity-100', 'translate-y-0', 'scale-100'];

function hideToast() {
    const container = document.getElementById('toastContainer');
    container.classList.add(...TOAST_HIDDEN);
    container.classList.remove(...TOAST_SHOWN, 'pointer-events-auto', 'toast-paused');
    document.getElementById('toastProgress').classList.remove('is-running');
    lastActionUndoSnapshot = null;
    toastTimer = null;
}

function scheduleToastHide(ms) {
    clearTimeout(toastTimer);
    toastEndsAt = Date.now() + ms;
    toastTimer = setTimeout(hideToast, ms);
}

function showToast(message, undoSnapshot = null) {
    const container = document.getElementById('toastContainer');
    const undoBtn = document.getElementById('toastUndoBtn');
    const progress = document.getElementById('toastProgress');
    const msgEl = document.getElementById('toastMessage');
    const wasVisible = container.classList.contains('opacity-100');
    msgEl.textContent = message;
    // the toast is already up: swap the text softly instead of re-entering
    if (wasVisible) msgEl.classList.remove('toast-text-in');

    if (undoSnapshot) {
        lastActionUndoSnapshot = undoSnapshot;
        undoBtn.classList.remove('hidden');
        container.classList.remove('pointer-events-none');
        container.classList.add('pointer-events-auto');
    } else {
        lastActionUndoSnapshot = null;
        undoBtn.classList.add('hidden');
        container.classList.remove('pointer-events-auto');
    }

    container.classList.remove(...TOAST_HIDDEN, 'toast-paused');
    if (!undoSnapshot) container.classList.add('pointer-events-none');
    container.classList.add(...TOAST_SHOWN);

    // restart the countdown bar only for toasts that can be undone
    progress.classList.remove('is-running');
    progress.classList.toggle('hidden', !undoSnapshot);
    if (wasVisible || undoSnapshot) {
        void container.offsetWidth; // one reflow restarts both animations below
        if (wasVisible) msgEl.classList.add('toast-text-in');
        if (undoSnapshot) progress.classList.add('is-running');
    }

    scheduleToastHide(undoSnapshot ? 5000 : 2400);
}

function pauseToast() {
    const container = document.getElementById('toastContainer');
    if (!toastTimer || !lastActionUndoSnapshot) return;
    clearTimeout(toastTimer);
    toastTimer = null;
    toastRemaining = Math.max(800, toastEndsAt - Date.now());
    container.classList.add('toast-paused');
}

function resumeToast() {
    const container = document.getElementById('toastContainer');
    if (!container.classList.contains('toast-paused')) return;
    container.classList.remove('toast-paused');
    scheduleToastHide(toastRemaining);
}

(function wireToastPause() {
    const container = document.getElementById('toastContainer');
    container.addEventListener('mouseenter', pauseToast);
    container.addEventListener('mouseleave', resumeToast);
    container.addEventListener('focusin', pauseToast);
    container.addEventListener('focusout', resumeToast);
})();

function toggleTheme() {
    themeChosenByUser = true;
    applyThemeUI(!isDarkMode);
    savePrefs();
}

if (systemDarkQuery && systemDarkQuery.addEventListener) {
    systemDarkQuery.addEventListener('change', e => {
        if (!themeChosenByUser) applyThemeUI(e.matches);
    });
}

function toggleSound() {
    applySoundUI(!soundEnabled);
    savePrefs();
    showToast(soundEnabled ? 'צלילי משוב הופעלו' : 'צלילי משוב הושתקו');
}

// ===== Rendering by section =====
// A change makes every section stale, but only the visible one is rebuilt now; a hidden
// section is rebuilt when it is opened. (Before, every change rebuilt all three sections,
// including both charts, even when only the tracker was on screen.)
const staleSections = new Set(['tracker', 'analytics', 'manage']);
// true while a section is drawn because it was just opened: "value changed" animations
// (ring fill, KPI fade) are skipped then, since the old values were never on screen
let renderingEntry = false;
const SECTION_RENDERERS = {
    tracker: () => {
        renderHeaderDateStrip();
        renderTrackerSummary();
        renderCategoryFilterBar('tracker');
        renderHabitsList();
    },
    analytics: () => {
        renderAnalytics();
        renderLeaderboard();
    },
    manage: () => {
        renderCategoryFilterBar('manage');
        renderManageSection();
    }
};

function renderGreeting() {
    const el = document.getElementById('greetingLabel');
    const text = getGreetingByHour();
    if (el.textContent !== text) el.textContent = text;
}

function renderSection(section, { force = false, entry = false } = {}) {
    if (!force && !staleSections.has(section)) return;
    staleSections.delete(section);
    renderingEntry = entry;
    try {
        SECTION_RENDERERS[section]();
    } finally {
        renderingEntry = false;
    }
}

// After the first paint, the two hidden sections are drawn once in idle time, so a section is
// never empty when it's revealed (an empty one would shrink the page and reset the scroll).
function prerenderHiddenSections() {
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 200));
    idle(() =>
        Object.keys(SECTION_RENDERERS).forEach(sec => {
            if (sec !== currentMainSection) renderSection(sec);
        })
    );
}

function renderAll() {
    renderGreeting();
    Object.keys(SECTION_RENDERERS).forEach(sec => staleSections.add(sec));
    renderSection(currentMainSection);
}

// Fade the far (left, in RTL) edge of a horizontal scroller only while
// there is still hidden content in that direction.
function updateScrollFades() {
    const els = [...document.querySelectorAll('.scroll-fade-x')];
    const overflowing = els.map(el => el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft) > 4); // read all
    els.forEach((el, i) => el.classList.toggle('is-overflowing', overflowing[i])); // then write
}

let scrollFadesFrame = 0;
function scheduleScrollFades() {
    if (scrollFadesFrame) return;
    scrollFadesFrame = requestAnimationFrame(() => {
        scrollFadesFrame = 0;
        updateScrollFades();
    });
}

// ===== Custom form controls (replace native <select> and date inputs) =====
// The native element stays in the DOM (hidden) and keeps the value, so existing code that
// reads/writes `.value` keeps working; the custom control mirrors it.
const CHEVRON_SVG =
    '<svg class="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400 transition-transform" data-chevron fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>';
const CALENDAR_SVG =
    '<svg class="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
let openSelectState = null; // { select, trigger, panel }

function watchValue(el, onChange) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    Object.defineProperty(el, 'value', {
        configurable: true,
        get() {
            return desc.get.call(this);
        },
        set(v) {
            desc.set.call(this, v);
            onChange();
        }
    });
}

function fireChange(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

function relabel(nativeId, triggerId) {
    document.querySelectorAll(`label[for="${nativeId}"]`).forEach(l => l.setAttribute('for', triggerId));
}

function enhanceSelect(select) {
    if (select.dataset.enhanced) return;
    select.dataset.enhanced = '1';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${select.id}_trigger`;
    trigger.className = select.className + ' flex items-center justify-between gap-2 text-right';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `<span class="truncate min-w-0" data-label></span>${CHEVRON_SVG}`;
    select.classList.add('hidden');
    select.tabIndex = -1;
    select.after(trigger);
    relabel(select.id, trigger.id);

    const sync = () => {
        const opt = select.options[select.selectedIndex];
        trigger.querySelector('[data-label]').textContent = opt ? opt.textContent : '';
        if (openSelectState && openSelectState.select === select) renderSelectPanel();
    };
    watchValue(select, sync);
    new MutationObserver(sync).observe(select, { childList: true, subtree: true });
    select.addEventListener('change', sync);
    sync();

    trigger.addEventListener('click', e => {
        e.stopPropagation();
        if (openSelectState && openSelectState.select === select) closeCustomSelect(true);
        else openCustomSelect(select, trigger);
    });
    trigger.addEventListener('keydown', e => {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
            e.preventDefault();
            openCustomSelect(select, trigger);
        }
    });
}

function openCustomSelect(select, trigger) {
    closeAllMenus();
    closeCustomSelect(false);
    const panel = document.createElement('div');
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('data-menu-panel', '');
    panel.setAttribute('aria-labelledby', trigger.id);
    panel.className =
        'fixed z-[80] p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl overflow-y-auto overscroll-contain';
    panel.addEventListener('click', e => e.stopPropagation());
    panel.addEventListener('keydown', e => {
        if (openSelectState && openSelectState.panel === panel) handleSelectPanelKeys(e);
    });
    document.body.appendChild(panel);
    openSelectState = { select, trigger, panel };
    trigger.setAttribute('aria-expanded', 'true');
    trigger.querySelector('[data-chevron]').classList.add('rotate-180');
    renderSelectPanel();
    positionSelectPanel();
    const current = panel.querySelector('[aria-selected="true"]') || panel.querySelector('[role="option"]');
    if (current) {
        current.focus();
        current.scrollIntoView({ block: 'nearest' });
    }
}

function renderSelectPanel() {
    const { select, panel } = openSelectState;
    const optionHtml = opt => {
        const sel = opt.value === select.value;
        return `<button type="button" role="option" aria-selected="${sel}" data-value="${escapeHtml(opt.value)}" class="w-full flex items-center justify-between gap-3 text-right px-3 py-2 rounded-lg text-sm transition focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 ${
            sel ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'font-normal text-slate-700 dark:text-slate-200'
        }"><span class="truncate">${escapeHtml(opt.textContent)}</span>${sel ? '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}</button>`;
    };
    let html = '';
    [...select.children].forEach(child => {
        if (child.tagName === 'OPTGROUP') {
            html += `<div class="px-3 pt-2.5 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">${escapeHtml(child.label)}</div>`;
            html += [...child.children].map(optionHtml).join('');
        } else if (child.tagName === 'OPTION') {
            html += optionHtml(child);
        }
    });
    panel.innerHTML = html;
    panel.querySelectorAll('[role="option"]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (openSelectState && openSelectState.panel === panel) chooseSelectOption(btn.dataset.value);
        });
    });
}

function positionSelectPanel() {
    if (!openSelectState) return;
    const { trigger, panel } = openSelectState;
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth,
        vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 200), vw - 16);
    const right = Math.min(Math.max(8, vw - r.right), vw - width - 8); // align to the trigger's right edge (RTL)
    panel.style.width = `${width}px`;
    panel.style.right = `${right}px`;
    panel.style.left = 'auto';
    const spaceBelow = vh - r.bottom - 8,
        spaceAbove = r.top - 8;
    const desired = Math.min(panel.scrollHeight, 288);
    if (spaceBelow >= Math.min(desired, 200) || spaceBelow >= spaceAbove) {
        panel.style.top = `${r.bottom + 6}px`;
        panel.style.bottom = 'auto';
        panel.style.transformOrigin = 'top right';
        panel.style.maxHeight = `${Math.max(120, Math.min(288, spaceBelow - 6))}px`;
    } else {
        panel.style.bottom = `${vh - r.top + 6}px`;
        panel.style.top = 'auto';
        panel.style.transformOrigin = 'bottom right';
        panel.style.maxHeight = `${Math.max(120, Math.min(288, spaceAbove - 6))}px`;
    }
}

function chooseSelectOption(value) {
    const { select } = openSelectState;
    const changed = select.value !== value;
    select.value = value;
    closeCustomSelect(true);
    if (changed) fireChange(select);
}

function closeCustomSelect(refocus) {
    if (!openSelectState) return;
    const { trigger, panel } = openSelectState;
    panel.inert = true; // a list that is fading out takes no clicks or keys
    if (prefersReducedMotion()) {
        panel.remove();
    } else {
        panel.classList.add('is-closing');
        setTimeout(() => panel.remove(), 100);
    }
    trigger.setAttribute('aria-expanded', 'false');
    trigger.querySelector('[data-chevron]').classList.remove('rotate-180');
    openSelectState = null;
    if (refocus) trigger.focus();
}

function handleSelectPanelKeys(e) {
    const opts = [...openSelectState.panel.querySelectorAll('[role="option"]')];
    const idx = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        (opts[idx + 1] || opts[0]).focus();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        (opts[idx - 1] || opts[opts.length - 1]).focus();
    } else if (e.key === 'Home') {
        e.preventDefault();
        opts[0].focus();
    } else if (e.key === 'End') {
        e.preventDefault();
        opts[opts.length - 1].focus();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeCustomSelect(true);
    } else if (e.key === 'Tab') {
        closeCustomSelect(false);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
        const start = idx + 1;
        const hit = [...opts.slice(start), ...opts.slice(0, start)].find(
            o =>
                o.textContent
                    .trim()
                    .replace(/^\S+\s/, '')
                    .startsWith(e.key) || o.textContent.trim().startsWith(e.key)
        );
        if (hit) hit.focus();
    }
}

// Clicks elsewhere, scrolling outside the panel, or resizing close an open list
document.addEventListener('click', () => closeCustomSelect(false));
document.addEventListener(
    'scroll',
    e => {
        if (openSelectState && !openSelectState.panel.contains(e.target)) closeCustomSelect(false);
    },
    { capture: true, passive: true }
);

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

// Keeps now / next / past current: refresh the daily list once a minute while it is on screen
setInterval(() => {
    if (document.hidden) return;
    if (currentMainSection !== 'tracker' || currentViewMode !== 'focus') return;
    if (selectedDateKey !== getDateKeyDaysAgo(0)) return;
    const modal = document.getElementById('habitModalBackdrop');
    if (modal && !modal.classList.contains('hidden')) return;
    if (!Store.habits.some(h => hasAnyTime(habitOn(h, selectedDateKey)))) return;
    renderHabitsList();
}, 60000);

window.addEventListener('DOMContentLoaded', () => {
    enhanceFormControls();
    loadState();
    switchMainSection(currentMainSection);
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
