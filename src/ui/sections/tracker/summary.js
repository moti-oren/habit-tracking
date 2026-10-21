// The line above the list ("3/4 הושלמו"), the past-day banner and the overflow menu items.

import { isFutureDateKey } from '../../../core/dates.js';
import { hasAnyMarkOnDay } from '../../../core/habit.js';
import { isHabitScheduledOnKey } from '../../../core/schedule.js';
import { motion } from '../../../state/motion.js';
import { tracker } from '../../../state/tracker.js';
import { getDayStats, getLiveHabits } from '../../../store/selectors.js';
import { setRevealOpen } from '../../components/reveal.js';
import { getTrackerVisibleHabits } from './visible-habits.js';

export function renderTrackerSummary() {
    const totalHabits = getLiveHabits().length;
    const selectedDayObj = tracker.weekDays.find(d => d.key === tracker.selectedDateKey) || tracker.weekDays[0];
    const isSelectedFuture = isFutureDateKey(tracker.selectedDateKey);

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
            progressEl.innerHTML = `<span class="${selectedPct >= 100 ? 'text-emerald-700 dark:text-emerald-400' : ''} ${motion.celebrateDayKey === tracker.selectedDateKey ? 'text-pop' : ''}">${selectedDone}/${selectedTarget} הושלמו</span>${selectedBonus > 0 ? ` · <bdi dir="ltr">+${selectedBonus}</bdi> בונוס` : ''}`;
        }
    }

    // Update Selected Day Banner (Amber warning when reporting on a past day)
    const bannerTextEl = document.getElementById('selectedDayBannerText');

    const bannerWrap = document.getElementById('selectedDayBannerWrap');
    const showBanner = !(selectedDayObj.isToday || isSelectedFuture);
    if (bannerWrap.classList.contains('is-open') !== showBanner) setRevealOpen(bannerWrap, null, showBanner);
    if (showBanner) {
        bannerTextEl.textContent = `מדווחים על ${selectedDayObj.dayFull}, ${selectedDayObj.dayNum} ב${selectedDayObj.monthShort}`;
    }

    // Separate "Mark All" & secondary "Clear Checks" buttons
    const visibleHabits = getTrackerVisibleHabits();
    const scheduledForSelected = visibleHabits.filter(h =>
        isHabitScheduledOnKey(h, tracker.selectedDateKey, selectedDayObj.dateObj.getDay())
    );
    const anyCheckedOnDay = visibleHabits.some(h => hasAnyMarkOnDay(h, tracker.selectedDateKey));
    const filterSuffix = tracker.selectedCategory !== 'הכל' ? ` (${tracker.selectedCategory})` : '';
    const allScheduledChecked =
        scheduledForSelected.length > 0 &&
        scheduledForSelected.every(h => h.history && h.history[tracker.selectedDateKey]);

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
