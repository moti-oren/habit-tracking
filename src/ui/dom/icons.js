// One icon language for the whole UI: 24px stroke SVGs (emoji are kept only for habit icons)

const ICON_PATHS = {
    check: 'M5 13l4 4L19 7',
    x: 'M6 18L18 6M6 6l12 12',
    chevronDown: 'M19 9l-7 7-7-7',
    arrowUp: 'M12 19V5m0 0l-6 6m6-6l6 6',
    arrowDown: 'M12 5v14m0 0l6-6m-6 6l-6-6',
    star: 'M11.48 3.5a.56.56 0 011.04 0l2.13 5.11 5.52.44c.5.04.7.66.32.98l-4.2 3.6 1.28 5.38a.56.56 0 01-.84.61L12 16.73l-4.73 2.89a.56.56 0 01-.84-.61l1.28-5.38-4.2-3.6a.56.56 0 01.32-.98l5.52-.44 2.13-5.11z'
};

export function icon(name, cls = 'w-4 h-4', strokeWidth = 2.5) {
    return `<svg class="${cls} shrink-0 inline-block" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="${ICON_PATHS[name]}"/></svg>`;
}

export const CHEVRON_SVG =
    '<svg class="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400 transition-transform" data-chevron fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>';

export const CALENDAR_SVG =
    '<svg class="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>';
