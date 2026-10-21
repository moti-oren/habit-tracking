// Tracker actions: pick a day or a week, switch views, check habits off, mark or clear a day.

import { playFeedbackSound } from '../../../audio/feedback.js';
import { dayObjForKey, getDateKeyDaysAgo, isFutureDateKey } from '../../../core/dates.js';
import { formatStartDateLabel } from '../../../core/format.js';
import { hasAnyMarkOnDay, isHabitActiveOnKey } from '../../../core/habit.js';
import { isHabitScheduledOnKey } from '../../../core/schedule.js';
import { app } from '../../../state/app.js';
import { motion } from '../../../state/motion.js';
import { savePrefs } from '../../../state/prefs.js';
import { setWeek, tracker } from '../../../state/tracker.js';
import { createUndoSnapshot } from '../../../state/undo.js';
import { getDayStats } from '../../../store/selectors.js';
import { Store } from '../../../store/store.js';
import { switchMainSection } from '../../app/navigation.js';
import { renderAll } from '../../app/render.js';
import { setRevealOpen } from '../../components/reveal.js';
import { showToast } from '../../components/toast.js';
import { renderHabitsList } from './habits-list.js';
import { applyViewModeButtonsUI } from './view-mode.js';
import { getTrackerVisibleHabits } from './visible-habits.js';

export function selectDay(dateKey, jumpToTracker = false) {
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

export function setViewMode(mode) {
    tracker.viewMode = mode;
    applyViewModeButtonsUI(mode);
    savePrefs();
    renderHabitsList();
}

export function shiftWeek(delta) {
    const nextOffset = tracker.weekOffset + delta;
    if (nextOffset > 0) return;
    motion.pendingWeekSlide = delta < 0 ? 'prev' : 'next';
    setWeek(nextOffset);
    const todayMatch = tracker.weekDays.find(d => d.isToday);
    tracker.selectedDateKey = todayMatch ? todayMatch.key : tracker.weekDays[0].key;
    renderAll();
}

export function jumpToToday() {
    if (tracker.weekOffset < 0) motion.pendingWeekSlide = 'next';
    setWeek(0);
    tracker.selectedDateKey = getDateKeyDaysAgo(0);
    renderAll();
    showToast('חזרתם לשבוע הנוכחי (היום)');
}

export function toggleUnscheduledGroup() {
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

// slot: which occurrence, for a habit done several times a day (omit to toggle the whole day)
export function toggleHabitDay(habitId, dateKey, slot) {
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
        } catch {}
    }
    renderAll();
    motion.lastToggledHabitId = null;
    motion.lastToggle = null;
    motion.celebrateDayKey = null;
}

export function markAllForSelectedDay() {
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

export function clearAllForSelectedDay() {
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
