// Small overflow (⋯) menus.

import { prefersReducedMotion } from '../dom/animate.js';

// Small overflow (⋯) menus
export function closeAllMenus() {
    document.querySelectorAll('[data-menu-panel]').forEach(panel => {
        if (panel.getAttribute('role') === 'listbox') return; // custom selects close themselves
        if (panel.classList.contains('hidden') || panel.classList.contains('is-closing')) return;
        if (prefersReducedMotion()) {
            panel.classList.add('hidden');
            return;
        }
        panel.classList.add('is-closing');
        panel._closeTimer = setTimeout(() => {
            panel.classList.add('hidden');
            panel.classList.remove('is-closing');
        }, 100);
    });
    document.querySelectorAll('[aria-haspopup="menu"]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
}

export function toggleMenu(event, menuId, trigger) {
    event.stopPropagation();
    const panel = document.getElementById(menuId);
    if (!panel) return;
    const wasOpen = !panel.classList.contains('hidden') && !panel.classList.contains('is-closing');
    closeAllMenus();
    if (!wasOpen) {
        clearTimeout(panel._closeTimer);
        panel.classList.remove('hidden', 'is-closing');
        trigger.setAttribute('aria-expanded', 'true');
    }
}

export function wireMenus() {
    document.addEventListener('click', closeAllMenus);
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeAllMenus();
    });
}
