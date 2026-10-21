// ===== Sliding pill: one background that glides to the active option of a segmented control =====
// The active option is whichever child has aria-current="page", aria-selected="true" or aria-pressed="true".
// Several controls are measured together: all DOM writes that change layout first, then every
// read in one layout pass, then all the style writes (no read/write interleaving).
export function updateSegPills(containers) {
    const items = [];
    Array.from(containers).forEach(container => {
        if (!container || !container.classList || !container.classList.contains('seg')) return;
        let pill = container._pill;
        if (!pill) {
            pill = document.createElement('span');
            pill.className = `seg-pill seg-pill--${container.dataset.seg || 'raised'}`;
            pill.setAttribute('aria-hidden', 'true');
            container._pill = pill;
        }
        if (pill.parentElement !== container) container.prepend(pill); // survives innerHTML re-renders
        items.push({
            container,
            pill,
            active: container.querySelector('[aria-current="page"], [aria-selected="true"], [aria-pressed="true"]')
        });
    });
    // read
    items.forEach(item => {
        item.visible = !!item.active && item.container.offsetWidth !== 0;
        if (item.visible) {
            const a = item.active;
            item.box = { w: a.offsetWidth, h: a.offsetHeight, x: a.offsetLeft, y: a.offsetTop };
        }
    });
    // write
    const firstPlacement = [];
    items.forEach(({ pill, visible, box }) => {
        if (!visible) {
            pill.style.opacity = '0';
            pill.dataset.ready = '';
            return;
        }
        // first placement (or after being hidden): jump into place, don't slide in from the corner
        if (!pill.dataset.ready) {
            pill.classList.add('no-anim');
            firstPlacement.push(pill);
        }
        pill.style.width = `${box.w}px`;
        pill.style.height = `${box.h}px`;
        pill.style.transform = `translate(${box.x}px, ${box.y}px)`;
        pill.style.opacity = '1';
    });
    if (firstPlacement.length) {
        void firstPlacement[0].offsetWidth; // one reflow for all of them
        firstPlacement.forEach(pill => {
            pill.classList.remove('no-anim');
            pill.dataset.ready = '1';
        });
    }
}

export function updateSegPill(container) {
    updateSegPills([container]);
}

// Re-measure when a control appears (e.g. inside a modal that just opened) or the layout changes
const segResizeObserver =
    typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(entries => updateSegPills(entries.map(e => e.target)))
        : null;

export function initSegPills() {
    document.addEventListener('DOMContentLoaded', () => {
        const segs = document.querySelectorAll('.seg');
        updateSegPills(segs);
        if (segResizeObserver) segs.forEach(el => segResizeObserver.observe(el));
    });
}
