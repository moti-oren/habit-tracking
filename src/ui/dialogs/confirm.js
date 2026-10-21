// The confirmation dialog ("are you sure?"), with an optional alternative action.

import { hideModal, showModal } from '../components/modal.js';

export function openConfirmModal(title, message, onConfirm, options = {}) {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalText').textContent = message;
    const actionBtn = document.getElementById('confirmModalActionBtn');
    actionBtn.textContent = options.confirmLabel || 'אישור';
    const hasAlt = !!(options.altLabel && typeof options.onAlt === 'function');
    confirmHandlers = { onConfirm, onAlt: hasAlt ? options.onAlt : null };
    const altBtn = document.getElementById('confirmModalAltBtn');
    if (altBtn) {
        if (hasAlt) {
            altBtn.textContent = options.altLabel;
            altBtn.classList.remove('hidden');
        } else {
            altBtn.classList.add('hidden');
        }
    }
    showModal(document.getElementById('confirmModalBackdrop'));
}

export function closeConfirmModal() {
    hideModal(document.getElementById('confirmModalBackdrop'));
}

// A second click while the dialog closes can't run the action twice
let confirmHandlers = { onConfirm: null, onAlt: null };

export function runConfirm(which) {
    const fn = confirmHandlers[which];
    if (!fn) return;
    confirmHandlers = { onConfirm: null, onAlt: null };
    closeConfirmModal();
    fn();
}
