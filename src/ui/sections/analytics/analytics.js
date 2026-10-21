// The analytics section: KPI tiles, the weekday insight and the chart for the range and filter.

import { HEBREW_DAYS_FULL } from '../../../config/hebrew.js';
import { getPreviousRangeBounds } from '../../../core/analytics-range.js';
import { buildDaysForRange, splitDaysIntoWeeks } from '../../../core/dates.js';
import { getHabitStreakUnit } from '../../../core/format.js';
import { isHabitActiveInDays, isHabitActiveOnKey, isHabitArchived } from '../../../core/habit.js';
import { getScheduleVersion } from '../../../core/schedule.js';
import { analytics } from '../../../state/analytics.js';
import { motion } from '../../../state/motion.js';
import { calculateBestStreak, calculateStreak, getDayStats, getHabitRangeProgress } from '../../../store/selectors.js';
import { Store } from '../../../store/store.js';
import { restartAnimationClasses } from '../../dom/animate.js';
import { escapeHtml } from '../../dom/html.js';
import { icon } from '../../dom/icons.js';
import { renderBarChart } from './bar-chart.js';
import { getAnalyticsFilterInfo, renderAnalyticsFilterSelect } from './filter.js';
import { renderHabitGrid } from './habit-grid.js';
import { renderChartLegend } from './legend.js';
import { renderLineChart } from './line-chart.js';
import { getAnalyticsDays, renderAnalyticsRangeControls } from './range-controls.js';

const KPI_IDS = ['weeklyRateValue', 'perfectDaysTileValue', 'bestStreakValue', 'attentionHabitBox'];

export function renderAnalytics() {
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
    const prevBounds = getPreviousRangeBounds(analytics.range);
    const prevDays = buildDaysForRange(prevBounds.start, prevBounds.end);
    const prev = rangeRate(
        prevDays,
        scope.filter(h => isHabitActiveInDays(h, prevDays))
    );
    const compareEl = document.getElementById('rateCompareText');
    if (cur.rate !== null && prev.rate !== null) {
        const diff = cur.rate - prev.rate;
        const prevWord =
            analytics.range.preset === 'week'
                ? 'שבוע קודם'
                : analytics.range.preset === 'month'
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
    if (!motion.renderingEntry) {
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
