// The full calendar dialog: month grid, year overview and the header of its picking modes.

import { HEBREW_DAYS_FULL, HEBREW_MONTHS_FULL } from '../../../config/hebrew.js';
import { formatDateKey, getDateKeyDaysAgo } from '../../../core/dates.js';
import { formatDateTriggerLabel } from '../../../core/format.js';
import { calendar } from '../../../state/calendar.js';
import { motion } from '../../../state/motion.js';
import { tracker } from '../../../state/tracker.js';
import { getDayStats } from '../../../store/selectors.js';
import { restartAnimationClasses } from '../../dom/animate.js';
import { icon } from '../../dom/icons.js';

const calendarChromeDefaults = {};

export function calendarMaxKey() {
    return calendar.picker ? calendar.picker.max || null : getDateKeyDaysAgo(0);
}

function calendarMinKey() {
    return calendar.picker ? calendar.picker.min || null : null;
}

export function isCalendarKeyAllowed(key) {
    const max = calendarMaxKey(),
        min = calendarMinKey();
    return (!max || key <= max) && (!min || key >= min);
}

export function applyCalendarModeChrome() {
    const title = document.getElementById('calendarTitleText');
    const sub = document.getElementById('calendarSubtitleText');
    const footer = document.getElementById('calendarFooter');
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

export function paintRangePreview(hoverKey) {
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

export function isCalendarViewAtCurrentMonth() {
    const max = calendarMaxKey();
    if (!max) return false;
    const [my, mm] = max.split('-').map(Number);
    return calendar.viewYear > my || (calendar.viewYear === my && calendar.viewMonth >= mm - 1);
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
                    ${perfectInMonth > 0 ? `<span class="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap" data-tip="ימים מושלמים">${icon('star', 'w-3.5 h-3.5', 2)} ${perfectInMonth}</span>` : ''}
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

export function renderFullCalendarGrid() {
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
