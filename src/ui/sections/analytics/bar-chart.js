// The bar chart of daily consistency (ranges up to two weeks) and its dashed average line.

import { isHabitActiveOnKey } from '../../../core/habit.js';
import { isFlexibleOnKey, isHabitScheduledOnKey } from '../../../core/schedule.js';
import { motion } from '../../../state/motion.js';
import { tracker } from '../../../state/tracker.js';
import { icon } from '../../dom/icons.js';

const prevBarHeights = {};

function barFrom(key) {
    return motion.analyticsEntryAnim ? 0 : prevBarHeights[key];
}

function barGrowClass(key, height) {
    const from = barFrom(key);
    return from !== undefined && from !== height ? 'bar-grow' : '';
}

function barGrowStyle(key, height, idx) {
    const from = barFrom(key);
    prevBarHeights[key] = height;
    if (from === undefined || from === height) return '';
    return `--bar-from:${from}%; animation-delay:${motion.analyticsEntryAnim ? Math.min(idx, 14) * 25 : 0}ms;`;
}

export function renderBarChart(dayStats, avgPct, single = null) {
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
            const isSelected = day.key === tracker.selectedDateKey;
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

export function schedulePositionAvgLine() {
    if (avgLineFrame) return;
    avgLineFrame = requestAnimationFrame(() => {
        avgLineFrame = 0;
        positionAvgLine();
    });
}

export function positionAvgLine() {
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
