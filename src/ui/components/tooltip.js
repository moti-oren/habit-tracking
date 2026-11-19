// Tooltip: one element, 300ms hover delay with a mouse; tap-to-show on chart cells with touch.

export function initTooltips() {
    const tip = document.createElement('div');
    tip.id = 'appTooltip';
    tip.setAttribute('role', 'tooltip');
    tip.className = 'app-tooltip';
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(tip));
    let showTimer = null,
        hideTimer = null,
        current = null;

    function show(target) {
        const text = target.getAttribute('data-tip');
        if (!text) {
            hide(); // an empty data-tip means "no tip here", even mid-glide from a neighbour
            return;
        }
        current = target;
        const r = target.getBoundingClientRect(); // read (layout is clean here)
        const vw = window.innerWidth;
        tip.textContent = text; // writes
        tip.classList.remove('is-visible');
        tip.style.top = '-999px';
        tip.style.left = '-999px';
        const t = tip.getBoundingClientRect(); // the one forced layout: the tip's new size
        let top = r.top - t.height - 8;
        let below = false;
        if (top < 8) {
            top = r.bottom + 8;
            below = true;
        }
        const left = Math.min(vw - t.width - 8, Math.max(8, r.left + r.width / 2 - t.width / 2));
        tip.style.top = `${top}px`;
        tip.style.left = `${left}px`;
        tip.classList.toggle('is-below', below);
        tip.classList.add('is-visible'); // layout above already flushed the hidden state
    }
    function hide() {
        clearTimeout(showTimer);
        current = null;
        tip.classList.remove('is-visible');
    }
    document.addEventListener('pointerover', e => {
        if (e.pointerType !== 'mouse') return;
        const target = e.target.closest && e.target.closest('[data-tip]');
        if (!target || target === current) return;
        clearTimeout(showTimer);
        // moving between neighbouring cells keeps the tooltip and just moves it
        if (tip.classList.contains('is-visible')) show(target);
        else showTimer = setTimeout(() => show(target), 300);
    });
    document.addEventListener('pointerout', e => {
        if (e.pointerType !== 'mouse') return;
        const target = e.target.closest && e.target.closest('[data-tip]');
        if (!target) return;
        const to = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-tip]');
        if (to) return;
        hide();
    });
    document.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse') {
            hide();
            return;
        }
        const target = e.target.closest && e.target.closest('[data-tip-touch]');
        if (!target) {
            hide();
            return;
        }
        show(target);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, 1800);
    });
    let scrollHidePending = false;
    window.addEventListener(
        'scroll',
        () => {
            if (scrollHidePending || !current) return;
            scrollHidePending = true;
            requestAnimationFrame(() => {
                scrollHidePending = false;
                hide();
            });
        },
        { passive: true, capture: true }
    );
}
