// The date navigator: the week label and the strip of 7 days with their progress rings.

import { HEBREW_MONTHS_FULL } from '../../../config/hebrew.js';
import { formatWeekRangeText } from '../../../core/format.js';
import { motion } from '../../../state/motion.js';
import { tracker } from '../../../state/tracker.js';
import { getDayStats } from '../../../store/selectors.js';
import { restartAnimationClasses } from '../../dom/animate.js';
import { patchHTML } from '../../dom/patch.js';
import { renderGreeting } from '../../shell/greeting.js';

const prevRingPct = {}; // day key -> % shown in the day strip ring last time

export function renderHeaderDateStrip() {
    renderGreeting();

    const first = tracker.weekDays[0];
    const last = tracker.weekDays[6];
    const formattedRange = formatWeekRangeText(first, last);

    const nextWeekBtn = document.getElementById('nextWeekBtn');
    if (nextWeekBtn) nextWeekBtn.disabled = tracker.weekOffset >= 0;
    const rangeLabel = document.getElementById('weekRangeLabel');
    if (rangeLabel) rangeLabel.textContent = tracker.weekOffset === 0 ? `השבוע · ${formattedRange}` : formattedRange;

    const strip = document.getElementById('daySelectorStrip');
    if (!strip) return;
    const weekSlide = motion.pendingWeekSlide;
    motion.pendingWeekSlide = null;

    patchHTML(
        strip,
        tracker.weekDays
            .map(day => {
                const isSelected = day.key === tracker.selectedDateKey;
                const { totalScheduled, pct, allDone } = getDayStats(day);
                const ringPct = day.isFuture || totalScheduled === 0 ? 0 : pct;
                const ringLen = 37.7; // 2 * PI * 6
                const prevPct = motion.renderingEntry ? undefined : prevRingPct[day.key];
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
            <button type="button" ${day.isFuture ? 'disabled' : `data-action="selectDay" data-key="${day.key}"`} data-tip="${day.isFuture ? 'תאריך עתידי — לא ניתן לבחור' : `${day.dayFull} · ${totalScheduled > 0 ? `${pct}%` : 'אין יעדים מתוכננים'}`}" aria-pressed="${isSelected ? 'true' : 'false'}" ${day.isToday ? 'aria-current="date"' : ''} aria-label="${day.isToday ? 'היום, ' : ''}${day.dayFull}, ${day.dayNum} ב${HEBREW_MONTHS_FULL[day.dateObj.getMonth()]}${day.isFuture ? ', תאריך עתידי' : totalScheduled > 0 ? `, ${pct}% הושלמו` : ', אין יעדים'}" class="${day.key === motion.celebrateDayKey ? 'day-celebrate' : ''} relative flex flex-col items-center justify-center gap-1 sm:gap-1.5 py-2 sm:py-2.5 rounded-xl transition-colors text-center ${
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
