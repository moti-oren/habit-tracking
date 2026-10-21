// The legend under the analytics chart.

export function renderChartLegend(mode) {
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
