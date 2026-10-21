// The full calendar dialog. Without a picker it navigates the tracker to the tapped day; with one
// (openDatePicker / openRangePicker) it picks a date or a range for a form field.

import {
    dayNumOf,
    dowOfDayNum,
    getDateKeyDaysAgo,
    isFutureDateKey,
    isValidDateKey,
    todayDayNum
} from '../../../core/dates.js';
import { app } from '../../../state/app.js';
import { calendar } from '../../../state/calendar.js';
import { motion } from '../../../state/motion.js';
import { setWeek, tracker } from '../../../state/tracker.js';
import { switchMainSection } from '../../app/navigation.js';
import { renderAll } from '../../app/render.js';
import { hideModal, showModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import {
    applyCalendarModeChrome,
    calendarMaxKey,
    isCalendarKeyAllowed,
    isCalendarViewAtCurrentMonth,
    paintRangePreview,
    renderFullCalendarGrid
} from './render.js';

export function openFullCalendarModal() {
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

export function closeFullCalendarModal() {
    hideModal(document.getElementById('fullCalendarModalBackdrop'));
    if (calendar.picker) {
        calendar.picker = null;
        // keep the picker header until the closing animation ends, so it doesn't swap mid-fade
        setTimeout(() => {
            if (!calendar.picker) applyCalendarModeChrome();
        }, 200);
    }
}

export function openDatePicker(opts) {
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
export function openRangePicker(opts) {
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

export function handleCalendarDayClick(dateKey) {
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

export function shiftCalendarMonth(delta) {
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

export function toggleCalendarYearView() {
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

export function openCalendarMonthFromYear(monthIdx) {
    motion.pendingCalSlide = 'zoom-in';
    calendar.viewMonth = monthIdx;
    calendar.viewMode = 'month';
    renderFullCalendarGrid();
}

export function jumpCalendarToCurrentMonth() {
    calendar.viewMode = 'month';
    const now = new Date();
    calendar.viewYear = now.getFullYear();
    calendar.viewMonth = now.getMonth();
    renderFullCalendarGrid();
}

export function selectDateFromCalendar(dateKey) {
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
