// Feedback sounds on / off.

import { app } from '../../state/app.js';
import { savePrefs } from '../../state/prefs.js';
import { showToast } from '../components/toast.js';

export function applySoundUI(enabled) {
    app.soundEnabled = !!enabled;
    const soundBtn = document.getElementById('soundToggleBtn');
    if (soundBtn) {
        soundBtn.setAttribute('aria-pressed', String(app.soundEnabled));
        soundBtn.setAttribute(
            'aria-label',
            app.soundEnabled ? 'צלילי משוב פעילים. השתקה' : 'צלילי משוב מושתקים. הפעלה'
        );
        soundBtn.title = app.soundEnabled ? 'השתקת צלילים' : 'הפעלת צלילים';
    }
    const container = document.getElementById('soundIconContainer');
    if (container) {
        container.className = app.soundEnabled
            ? 'text-indigo-600 dark:text-indigo-400'
            : 'text-slate-500 dark:text-slate-400';
        container.innerHTML = app.soundEnabled
            ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/></svg>'
            : '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/><path stroke-linecap="round" stroke-linejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/></svg>';
    }
}

export function toggleSound() {
    applySoundUI(!app.soundEnabled);
    savePrefs();
    showToast(app.soundEnabled ? 'צלילי משוב הופעלו' : 'צלילי משוב הושתקו');
}
