// One look for every "nothing here" in the app: an icon, what is missing, why, and what to do next.

const ICONS = {
    // the first habit: something new to begin
    sparkles:
        'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
    // a category filter with nothing in it
    tag: 'M7 7h.01M7 3h5c.51 0 1.02.2 1.41.59l7 7a2 2 0 010 2.82l-7 7a2 2 0 01-2.82 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z',
    // a day or week before the habits started
    calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    // analytics with nothing to measure
    chart: 'M4 19h16M7 15v-3m5 3V8m5 7v-5'
};

const BUTTON = {
    primary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-sm shadow-indigo-500/20',
    secondary:
        'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold'
};

/**
 * @param {object} o
 * @param {keyof ICONS} o.icon
 * @param {string} o.title   plain text or trusted HTML
 * @param {string} o.text    plain text or trusted HTML
 * @param {{ label: string, action: string, attrs?: string, primary?: boolean }[]} [o.actions]
 * @param {string} [o.className]  extra classes for the box (e.g. a grid span)
 */
export function emptyStateHtml({ icon, title, text, actions = [], className = '' }) {
    const buttons = actions
        .map(
            a =>
                `<button type="button" data-action="${a.action}" ${a.attrs || ''} class="h-11 px-5 rounded-xl text-sm transition ${a.primary ? BUTTON.primary : BUTTON.secondary}">${a.label}</button>`
        )
        .join('');
    return `
        <div class="view-fade ${className} bg-white dark:bg-slate-900 rounded-2xl px-6 py-12 sm:py-14 text-center border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div class="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
                <svg class="w-7 h-7 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${ICONS[icon]}"/></svg>
            </div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white">${title}</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">${text}</p>
            ${buttons ? `<div class="mt-6 flex flex-wrap items-center justify-center gap-2">${buttons}</div>` : ''}
        </div>`;
}

/** The first run, when there are no habits at all: start from scratch, or look around first. */
export function firstRunHtml(className = '') {
    return emptyStateHtml({
        icon: 'sparkles',
        title: 'בואו נתחיל לבנות הרגלים',
        text: 'הוסיפו את ההרגל הראשון שלכם, או טענו נתוני דוגמה כדי לראות איך האפליקציה נראית אחרי כמה חודשים של שימוש.',
        actions: [
            { label: '+ הרגל ראשון', action: 'newHabit', primary: true },
            { label: 'טעינת נתוני דוגמה', action: 'loadSampleData' }
        ],
        className
    });
}
