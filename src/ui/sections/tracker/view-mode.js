// The "daily list / weekly table" switch.

import { updateSegPill } from '../../components/segmented.js';

export function applyViewModeButtonsUI(mode) {
    const focusBtn = document.getElementById('viewModeFocusBtn');
    const gridBtn = document.getElementById('viewModeGridBtn');
    if (!focusBtn || !gridBtn) return;
    if (mode === 'focus') {
        focusBtn.className = 'tap-44 h-9 px-3.5 rounded-lg text-slate-900 dark:text-white flex items-center gap-1.5';
        gridBtn.className =
            'tap-44 h-9 px-3.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5';
    } else {
        gridBtn.className = 'tap-44 h-9 px-3.5 rounded-lg text-slate-900 dark:text-white flex items-center gap-1.5';
        focusBtn.className =
            'tap-44 h-9 px-3.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5';
    }
    focusBtn.setAttribute('aria-pressed', String(mode === 'focus'));
    gridBtn.setAttribute('aria-pressed', String(mode !== 'focus'));
    updateSegPill(focusBtn.parentElement);
}
