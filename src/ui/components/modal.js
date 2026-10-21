import { prefersReducedMotion } from '../dom/animate.js';

// ===== Modals: animated open/close, focus in and back out, Escape, Tab stays inside =====
const openModalStack = [];

const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The dialog on top (the one that gets Escape and keeps Tab inside), or undefined. */
export function topModal() {
    return openModalStack[openModalStack.length - 1];
}

export function getVisibleFocusables(root) {
    return [...root.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length > 0 && !el.closest('.hidden'));
}

export function showModal(el) {
    if (!el) return;
    clearTimeout(el._closeTimer);
    const wasOpen = el.classList.contains('flex') && !el.classList.contains('is-closing');
    el.classList.remove('is-closing', 'hidden');
    el.classList.add('flex');
    const idx = openModalStack.indexOf(el);
    if (idx !== -1) openModalStack.splice(idx, 1);
    openModalStack.push(el);
    if (!wasOpen && !el.contains(document.activeElement)) el._returnFocus = document.activeElement;
    requestAnimationFrame(() => {
        if (el.contains(document.activeElement)) return;
        const target = el.querySelector('[data-autofocus]') || getVisibleFocusables(el)[0];
        if (target) target.focus({ preventScroll: true });
    });
}

export function hideModal(el) {
    if (!el || el.classList.contains('hidden') || el.classList.contains('is-closing')) return;
    const idx = openModalStack.indexOf(el);
    if (idx !== -1) openModalStack.splice(idx, 1);
    const focusWasInside = el.contains(document.activeElement) || document.activeElement === document.body;
    const finish = () => {
        el.classList.add('hidden');
        el.classList.remove('flex', 'is-closing');
    };
    if (prefersReducedMotion()) {
        finish();
    } else {
        el.classList.add('is-closing');
        el._closeTimer = setTimeout(finish, 180);
    }
    const back = el._returnFocus;
    el._returnFocus = null;
    if (focusWasInside && back && document.contains(back) && back.getClientRects().length) {
        back.focus({ preventScroll: true });
    }
}

// A click on the dimmed area of a decision dialog doesn't dismiss it; the panel shakes instead
export function nudgeModal(el) {
    const panel = el && el.querySelector('.modal-panel');
    if (!panel || prefersReducedMotion()) return;
    panel.classList.remove('is-shaking');
    void panel.offsetWidth;
    panel.classList.add('is-shaking');
    setTimeout(() => panel.classList.remove('is-shaking'), 240);
}
