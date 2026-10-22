// The intro screen: before the app opens, the visitor completes a week by dragging a knob around a
// ring (or with the keyboard), and the app is revealed behind it.
//
// It is shown once: completing or skipping it is remembered under INTRO_SEEN_KEY. `?intro` in the
// URL shows it again. While it is open everything else on the page is inert, so focus and screen
// readers stay inside it. Dragging only moves a transform and a stroke offset, once per frame.

import { playFeedbackSound } from '../../audio/feedback.js';
import { INTRO_SEEN_KEY } from '../../config/storage-keys.js';

const TAU = Math.PI * 2;
const DAYS = 7;
const DAY_ANGLE = TAU / DAYS;
// Ring geometry, in the SVG's 280×280 viewBox
const SIZE = 280;
const RADIUS = 100;
const STROKE = 12;
// The ring is 7 arcs, one per day. The angle between two arcs leaves a visible gap of 10 units
// after the round caps (half a stroke each) reach into it.
const GAP = (10 + STROKE) / RADIUS;
const SEGMENTS = Array.from({ length: DAYS }, (_, i) => {
    const from = i * DAY_ANGLE + GAP / 2;
    const to = (i + 1) * DAY_ANGLE - GAP / 2;
    return { from, to, length: RADIUS * (to - from) };
});
// The last few degrees snap to full, so a quick drag doesn't stop just short of the top.
const SNAP = 0.985;

const reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const reducedMotion = () => !!(reducedMotionQuery && reducedMotionQuery.matches);

function wasSeen() {
    try {
        return localStorage.getItem(INTRO_SEEN_KEY) === '1';
    } catch {
        return false;
    }
}

function markSeen() {
    try {
        localStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {}
}

const pct = n => `${((n / SIZE) * 100).toFixed(3)}%`;

// A point on the ring: angle 0 at the top, growing clockwise.
const pointAt = a => `${(SIZE / 2 + Math.sin(a) * RADIUS).toFixed(2)} ${(SIZE / 2 - Math.cos(a) * RADIUS).toFixed(2)}`;

// Each day: a track arc, and a fill arc over it that its dash offset reveals from the start.
function segmentsHtml() {
    return SEGMENTS.map(({ from, to, length }, i) => {
        const d = `M ${pointAt(from)} A ${RADIUS} ${RADIUS} 0 0 1 ${pointAt(to)}`;
        return `<path class="intro-track" d="${d}"/>
            <path class="intro-day" data-intro-day="${i}" d="${d}"
                stroke-dasharray="${length.toFixed(2)}" stroke-dashoffset="${length.toFixed(2)}"/>`;
    }).join('');
}

function introHtml() {
    const knobTop = pct(SIZE / 2 - RADIUS);
    return `
    <div class="intro-bg" aria-hidden="true"></div>
    <div class="intro-brand intro-stagger">
        <span class="intro-logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></span>
        <span>מעקב הרגלים</span>
    </div>
    <button type="button" class="intro-skip" data-intro-skip>
        דילוג
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>
    </button>
    <div class="intro-content">
        <h2 id="introTitle" class="intro-title intro-stagger">בונים הרגלים.<span>יום אחרי יום.</span></h2>
        <div class="intro-dial intro-stagger" data-intro-dial>
            <svg class="intro-ring" viewBox="0 0 ${SIZE} ${SIZE}" stroke-width="${STROKE}" aria-hidden="true">
                ${segmentsHtml()}
            </svg>
            <div class="intro-center" aria-hidden="true">
                <span class="intro-count" data-intro-count>0</span>
                <span class="intro-count-label">מתוך ${DAYS} ימים</span>
                <svg class="intro-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
            </div>
            <div class="intro-orbit intro-hint" aria-hidden="true"><span class="intro-ghost" style="top:${knobTop}"></span></div>
            <div class="intro-orbit" data-intro-orbit>
                <span class="intro-knob" data-intro-knob role="slider" tabindex="0"
                    aria-label="השלמת שבוע" aria-describedby="introHow introKeys"
                    aria-valuemin="0" aria-valuemax="${DAYS}" aria-valuenow="0" aria-valuetext="0 מתוך ${DAYS} ימים"
                    style="top:${knobTop}"></span>
            </div>
        </div>
        <p id="introHow" class="intro-how intro-stagger">גררו את הנקודה סביב המעגל כדי להיכנס</p>
        <p id="introKeys" class="intro-keys">במקלדת: חיצים, או Enter להשלמה</p>
        <p class="intro-sr" aria-live="polite" data-intro-status></p>
    </div>`;
}

/** Shows the intro over the app, unless it was already seen (and `?intro` doesn't ask for it). */
export function showIntro() {
    const forced = new URLSearchParams(location.search).has('intro');
    if (!forced && wasSeen()) return;

    const root = document.createElement('div');
    root.id = 'intro';
    root.className = 'intro';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'introTitle');
    root.setAttribute('aria-describedby', 'introHow');
    root.tabIndex = -1;
    root.innerHTML = introHtml();

    const $ = sel => root.querySelector(sel);
    const dial = $('[data-intro-dial]');
    const orbit = $('[data-intro-orbit]');
    const knob = $('[data-intro-knob]');
    const count = $('[data-intro-count]');
    const status = $('[data-intro-status]');
    const dayEls = [...root.querySelectorAll('[data-intro-day]')];

    // Everything else on the page is inert while the intro is open.
    const madeInert = [...document.body.children].filter(el => !el.inert);
    madeInert.forEach(el => (el.inert = true));
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(root);
    root.focus({ preventScroll: true });

    let progress = 0; // radians, 0 … TAU
    let days = 0;
    let done = false;
    let frame = 0;
    let drag = null; // { pointerId, angle }

    function render() {
        frame = 0;
        orbit.style.transform = `rotate(${(progress * 180) / Math.PI}deg)`;
        let reached = 0;
        SEGMENTS.forEach(({ from, to, length }, i) => {
            const filled = done ? 1 : Math.max(0, Math.min(1, (progress - from) / (to - from)));
            if (filled === 1) reached++;
            dayEls[i].style.strokeDashoffset = String(length * (1 - filled));
            // an empty arc would still draw its round cap
            dayEls[i].style.visibility = filled > 0 ? 'visible' : 'hidden';
        });
        if (reached !== days) {
            if (reached > days && !done) {
                playFeedbackSound('check');
                if (navigator.vibrate) navigator.vibrate(8);
            }
            days = reached;
            count.textContent = String(days);
            knob.setAttribute('aria-valuenow', String(days));
            knob.setAttribute('aria-valuetext', `${days} מתוך ${DAYS} ימים`);
            dayEls.forEach((el, i) => el.classList.toggle('is-on', i < days));
        }
    }
    const scheduleRender = () => {
        if (!frame) frame = requestAnimationFrame(render);
    };

    function setProgress(value, { stepped = false } = {}) {
        if (done) return;
        root.classList.add('has-interacted');
        // keyboard steps glide; dragging follows the pointer directly
        dial.classList.toggle('is-stepping', stepped);
        progress = Math.max(0, Math.min(TAU, value));
        if (progress >= TAU * SNAP) {
            progress = TAU;
            complete();
        } else {
            scheduleRender();
        }
    }

    function complete() {
        done = true;
        cancelAnimationFrame(frame);
        render();
        markSeen();
        root.classList.add('is-complete');
        knob.setAttribute('aria-disabled', 'true');
        status.textContent = 'השבוע הושלם. נכנסים לאפליקציה';
        playFeedbackSound('celebrate');
        if (navigator.vibrate) navigator.vibrate([12, 40, 18]);
        setTimeout(close, reducedMotion() ? 500 : 950);
    }

    let closed = false;
    function close() {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKeydown, true);
        root.classList.add('is-leaving');
        madeInert.forEach(el => (el.inert = false));
        document.documentElement.style.overflow = prevOverflow;
        // the app is under it now: nothing inside the intro may keep focus
        if (root.contains(document.activeElement)) document.activeElement.blur();
        setTimeout(() => root.remove(), reducedMotion() ? 220 : 620);
    }

    function skip() {
        markSeen();
        close();
    }

    // The angle of a point around the dial's centre: 0 at the top, growing clockwise.
    function angleAt(e) {
        const r = dial.getBoundingClientRect();
        const a = Math.atan2(e.clientX - (r.left + r.width / 2), r.top + r.height / 2 - e.clientY);
        return a < 0 ? a + TAU : a;
    }

    dial.addEventListener('pointerdown', e => {
        if (done || e.button !== 0) return;
        e.preventDefault(); // no text selection or focus change while dragging
        dial.setPointerCapture(e.pointerId);
        drag = { pointerId: e.pointerId, angle: angleAt(e) };
        root.classList.add('has-interacted', 'is-dragging');
    });
    dial.addEventListener('pointermove', e => {
        if (!drag || e.pointerId !== drag.pointerId) return;
        const angle = angleAt(e);
        // only the change counts (unwrapped across the top), so the knob never jumps to the pointer
        let delta = angle - drag.angle;
        if (delta > Math.PI) delta -= TAU;
        else if (delta < -Math.PI) delta += TAU;
        drag.angle = angle;
        setProgress(progress + delta);
    });
    const endDrag = e => {
        if (!drag || e.pointerId !== drag.pointerId) return;
        drag = null;
        root.classList.remove('is-dragging');
    };
    dial.addEventListener('pointerup', endDrag);
    dial.addEventListener('pointercancel', endDrag);

    knob.addEventListener('keydown', e => {
        if (done) return;
        const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        if (step) {
            // from the progress, not `days`: that only updates on the next frame
            const current = Math.floor((progress + GAP / 2) / DAY_ANGLE + 1e-6);
            setProgress((current + step) * DAY_ANGLE, { stepped: true });
        } else if (e.key === 'Home') {
            setProgress(0, { stepped: true });
        } else if (e.key === 'End' || e.key === 'Enter' || e.key === ' ') {
            setProgress(TAU, { stepped: true });
        } else {
            return;
        }
        e.preventDefault();
    });

    function onKeydown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            skip();
        }
    }
    // capture: the app's own Escape handlers must not see it while the intro is open
    document.addEventListener('keydown', onKeydown, true);
    $('[data-intro-skip]').addEventListener('click', skip);
}
