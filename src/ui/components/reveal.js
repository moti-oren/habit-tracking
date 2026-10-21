// Blocks that open and close by height (.reveal: grid rows 0fr → 1fr) without re-rendering.

// Open/close a .reveal block in place (no re-render), so the height change can animate
export function setRevealOpen(revealEl, toggleBtn, open, openText, closedText) {
    if (!revealEl) return false;
    revealEl.classList.toggle('is-open', open);
    if (open) {
        revealEl.removeAttribute('inert');
        revealEl.classList.add('is-opening');
        clearTimeout(revealEl._openingTimer);
        revealEl._openingTimer = setTimeout(() => revealEl.classList.remove('is-opening'), 500);
    } else {
        revealEl.setAttribute('inert', '');
        revealEl.classList.remove('is-opening');
    }
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', String(open));
        const label = toggleBtn.querySelector('[data-toggle-text]');
        if (label) label.textContent = open ? openText : closedText;
        const chevron = toggleBtn.querySelector('[data-toggle-text] + svg');
        if (chevron) chevron.classList.toggle('rotate-180', open);
    }
    return true;
}
