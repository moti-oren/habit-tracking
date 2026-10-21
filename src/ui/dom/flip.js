// Layout moves (FLIP): cards that stay glide to their new place, new ones fade in

import { prefersReducedMotion } from './animate.js';

const EASE_OUT_JS = 'cubic-bezier(0.22, 1, 0.36, 1)';

function captureFlip() {
    const map = new Map();
    document.querySelectorAll('[data-flip-key]').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width) map.set(el.dataset.flipKey, r);
    });
    return map;
}

function playFlip(before) {
    if (prefersReducedMotion() || !Element.prototype.animate) return;
    const measured = [...document.querySelectorAll('[data-flip-key]')].map(el => [el, el.getBoundingClientRect()]); // reads
    measured.forEach(([el, r]) => {
        // writes
        if (!r.width) return;
        const b = before.get(el.dataset.flipKey);
        if (!b) {
            el.animate(
                [
                    { opacity: 0, transform: 'scale(0.97)' },
                    { opacity: 1, transform: 'none' }
                ],
                { duration: 220, easing: EASE_OUT_JS }
            );
            return;
        }
        const dx = b.left - r.left,
            dy = b.top - r.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
            duration: 280,
            easing: EASE_OUT_JS
        });
    });
}

export function withFlip(mutate) {
    const before = captureFlip();
    mutate();
    playFlip(before);
}

// Fade/shrink the cards of these habits away, then apply the change and let the rest close the gap
export function animateOut(ids, mutate) {
    const els = ids
        .flatMap(id => [...document.querySelectorAll(`[data-flip-key$="-${CSS.escape(id)}"]`)])
        .filter(el => el.getClientRects().length);
    if (els.length === 0 || prefersReducedMotion() || !Element.prototype.animate) {
        withFlip(mutate);
        return;
    }
    const fades = els.map(el =>
        el.animate(
            [
                { opacity: 1, transform: 'none' },
                { opacity: 0, transform: 'scale(0.96)' }
            ],
            { duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }
        )
    );
    setTimeout(() => {
        withFlip(mutate);
        fades.forEach(a => a.cancel()); // nodes that were removed don't care; ones that stay become visible again
    }, 180);
}

export function flashHabits(ids) {
    flashHabitIds = new Set(ids);
    setTimeout(() => {
        flashHabitIds = new Set();
    }, 0);
}

// Habits that should briefly glow after the next render (just added, moved or restored)
let flashHabitIds = new Set();

export function flashClassFor(id) {
    return flashHabitIds.has(id) ? 'flash-highlight' : '';
}
