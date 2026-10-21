// Toast: short entry, undo countdown bar, pauses while hovered or focused

import { undo } from '../../state/undo.js';

let toastTimer = null;

let toastEndsAt = 0;

let toastRemaining = 0;

const TOAST_HIDDEN = ['opacity-0', 'translate-y-2', 'scale-[0.96]', 'lg:-translate-y-2', 'pointer-events-none'];

const TOAST_SHOWN = ['opacity-100', 'translate-y-0', 'scale-100'];

function hideToast() {
    const container = document.getElementById('toastContainer');
    container.classList.add(...TOAST_HIDDEN);
    container.classList.remove(...TOAST_SHOWN, 'pointer-events-auto', 'toast-paused');
    document.getElementById('toastProgress').classList.remove('is-running');
    undo.snapshot = null;
    toastTimer = null;
}

function scheduleToastHide(ms) {
    clearTimeout(toastTimer);
    toastEndsAt = Date.now() + ms;
    toastTimer = setTimeout(hideToast, ms);
}

export function showToast(message, undoSnapshot = null) {
    const container = document.getElementById('toastContainer');
    const undoBtn = document.getElementById('toastUndoBtn');
    const progress = document.getElementById('toastProgress');
    const msgEl = document.getElementById('toastMessage');
    const wasVisible = container.classList.contains('opacity-100');
    msgEl.textContent = message;
    // the toast is already up: swap the text softly instead of re-entering
    if (wasVisible) msgEl.classList.remove('toast-text-in');

    if (undoSnapshot) {
        undo.snapshot = undoSnapshot;
        undoBtn.classList.remove('hidden');
        container.classList.remove('pointer-events-none');
        container.classList.add('pointer-events-auto');
    } else {
        undo.snapshot = null;
        undoBtn.classList.add('hidden');
        container.classList.remove('pointer-events-auto');
    }

    container.classList.remove(...TOAST_HIDDEN, 'toast-paused');
    if (!undoSnapshot) container.classList.add('pointer-events-none');
    container.classList.add(...TOAST_SHOWN);

    // restart the countdown bar only for toasts that can be undone
    progress.classList.remove('is-running');
    progress.classList.toggle('hidden', !undoSnapshot);
    if (wasVisible || undoSnapshot) {
        void container.offsetWidth; // one reflow restarts both animations below
        if (wasVisible) msgEl.classList.add('toast-text-in');
        if (undoSnapshot) progress.classList.add('is-running');
    }

    scheduleToastHide(undoSnapshot ? 5000 : 2400);
}

function pauseToast() {
    const container = document.getElementById('toastContainer');
    if (!toastTimer || !undo.snapshot) return;
    clearTimeout(toastTimer);
    toastTimer = null;
    toastRemaining = Math.max(800, toastEndsAt - Date.now());
    container.classList.add('toast-paused');
}

function resumeToast() {
    const container = document.getElementById('toastContainer');
    if (!container.classList.contains('toast-paused')) return;
    container.classList.remove('toast-paused');
    scheduleToastHide(toastRemaining);
}

export function wireToastPause() {
    const container = document.getElementById('toastContainer');
    container.addEventListener('mouseenter', pauseToast);
    container.addEventListener('mouseleave', resumeToast);
    container.addEventListener('focusin', pauseToast);
    container.addEventListener('focusout', resumeToast);
}
