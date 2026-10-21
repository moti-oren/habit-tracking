// The collapsible rows of the habit form.

import { prefersReducedMotion, restartAnimationClass } from '../../dom/animate.js';

export const HABIT_SECTIONS = {
    appearance: ['habitAppearanceBtn', 'habitAppearancePanel'],
    time: ['habitTimeToggle', 'habitTimePanel'],
    details: ['habitDetailsToggle', 'habitDetailsPanel']
};

export function toggleHabitSection(name, force) {
    const [btnId, panelId] = HABIT_SECTIONS[name];
    const btn = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    if (!btn || !panel) return;
    const open = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', String(open));
    const chev = btn.querySelector('[data-chevron]');
    if (chev) chev.classList.toggle('rotate-180', open);
    if (open && typeof force !== 'boolean') {
        if (!prefersReducedMotion()) restartAnimationClass(panel, 'fade-in-quick');
        requestAnimationFrame(() =>
            panel.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
        );
    }
}
