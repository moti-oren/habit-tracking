// Fade the far (left, in RTL) edge of a horizontal scroller only while
// there is still hidden content in that direction.
export function updateScrollFades() {
    const els = [...document.querySelectorAll('.scroll-fade-x')];
    const overflowing = els.map(el => el.scrollWidth - el.clientWidth - Math.abs(el.scrollLeft) > 4); // read all
    els.forEach((el, i) => el.classList.toggle('is-overflowing', overflowing[i])); // then write
}

let scrollFadesFrame = 0;

export function scheduleScrollFades() {
    if (scrollFadesFrame) return;
    scrollFadesFrame = requestAnimationFrame(() => {
        scrollFadesFrame = 0;
        updateScrollFades();
    });
}
