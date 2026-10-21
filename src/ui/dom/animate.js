// CSS animation helpers: reduced-motion check, restarting animation classes, field shake.

export const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Restart CSS animations on several elements with a single forced reflow
const RESTARTABLE_ANIMATIONS = ['slide-from-prev', 'slide-from-next', 'zoom-in', 'zoom-out', 'fade-in-quick'];

export function restartAnimationClasses(pairs) {
    if (prefersReducedMotion()) return;
    const list = pairs.filter(([el]) => el);
    if (!list.length) return;
    list.forEach(([el]) => el.classList.remove(...RESTARTABLE_ANIMATIONS));
    void list[0][0].offsetWidth;
    list.forEach(([el, cls]) => el.classList.add(cls));
}

export function restartAnimationClass(el, cls) {
    restartAnimationClasses([[el, cls]]);
}

export function shakeField(el, keepError = true) {
    if (!el) return;
    if (keepError) {
        el.classList.add('field-error');
        el.setAttribute('aria-invalid', 'true');
        el.addEventListener(
            'input',
            () => {
                el.classList.remove('field-error');
                el.removeAttribute('aria-invalid');
            },
            { once: true }
        );
    }
    if (prefersReducedMotion()) return;
    el.classList.remove('field-shake');
    void el.offsetWidth;
    el.classList.add('field-shake');
    setTimeout(() => el.classList.remove('field-shake'), 300);
}
