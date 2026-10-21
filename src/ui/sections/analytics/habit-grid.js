import { HEBREW_DAYS_SHORT, HEBREW_MONTHS } from '../../../config/hebrew.js';
import { addDaysToKey, buildDaysForRange, formatDateKey } from '../../../core/dates.js';
import { isHabitActiveOnKey } from '../../../core/habit.js';
import { isFlexibleOnKey, isHabitScheduledOnKey } from '../../../core/schedule.js';
import { motion } from '../../../state/motion.js';

// Calendar grid for one habit: columns are weeks (newest on the left), rows are weekdays.
export function renderHabitGrid(habit, days) {
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
        <div class="flex items-start justify-center py-2 ${motion.analyticsEntryAnim ? 'fade-in-quick' : ''}" style="gap:${gap}px">
            <div class="flex flex-col pl-1" style="gap:${gap}px"><span class="h-4"></span>${dayLabels}</div>
            ${cols}
        </div>`;
}
