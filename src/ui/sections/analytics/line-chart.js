// The line chart of daily consistency for longer ranges, with a 7-day moving average.

import { addDaysToKey, buildDaysForRange } from '../../../core/dates.js';
import { motion } from '../../../state/motion.js';
import { getDayStats } from '../../../store/selectors.js';
import { Store } from '../../../store/store.js';

export function renderLineChart(days, avgPct, scope = Store.habits) {
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
            <path d="${areaPaths}" class="fill-indigo-500/10 dark:fill-indigo-400/10 ${motion.analyticsEntryAnim ? 'fade-in-quick' : ''}"/>
            <path d="${dailyLine}" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.5" stroke-linejoin="round" class="${motion.analyticsEntryAnim ? 'fade-in-quick' : ''}"/>
            <line x1="${pad.left}" x2="${pad.left + plotW}" y1="${avgY}" y2="${avgY}" stroke="currentColor" class="text-slate-500 dark:text-slate-400" stroke-width="1.5" stroke-dasharray="5 4"/>
            ${maLine
                .split('M')
                .filter(Boolean)
                .map(
                    seg =>
                        `<path d="M${seg}" pathLength="1" class="${motion.analyticsEntryAnim ? 'line-draw' : ''}" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
                )
                .join('')}
            ${perfectDots}
            ${xLabels}
            ${hits}
        </svg>
    `;
}
