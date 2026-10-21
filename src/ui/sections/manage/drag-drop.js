// Drag a habit card onto a category (mouse: after a small move; touch: long-press, then drag).

import { UNCATEGORIZED_LABEL } from '../../../config/categories.js';
import { getHabitCategoryDisplay } from '../../../core/habit.js';
import { app } from '../../../state/app.js';
import { manage } from '../../../state/manage.js';
import { Store } from '../../../store/store.js';
import { closeAllMenus } from '../../components/menus.js';
import { escapeHtml } from '../../dom/html.js';
import { moveHabitsToCategory } from './actions.js';
import { renderManageSection } from './manage-grid.js';

// --- Drag & drop (mouse: drag after a small move; touch: long-press then drag) ---
function renderDropTray() {
    const list = document.getElementById('habitDropTrayList');
    const title = document.getElementById('habitDropTrayTitle');
    const dragged = Store.habits.filter(h => manage.drag.ids.includes(h.id));
    const currentCats = new Set(dragged.map(h => getHabitCategoryDisplay(h)));
    const singleCurrent = currentCats.size === 1 ? [...currentCats][0] : null;
    title.textContent = dragged.length > 1 ? `העברת ${dragged.length} הרגלים — שחררו על קטגוריה` : 'שחררו על קטגוריה';
    list.innerHTML = [...Store.categories, UNCATEGORIZED_LABEL]
        .map(cat => {
            const isCurrent = cat === singleCurrent;
            return `<span data-drop-category="${escapeHtml(cat)}" data-current="${isCurrent}" class="drop-chip px-3.5 py-2 rounded-xl text-sm font-bold transition ${
                isCurrent
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }">${escapeHtml(cat)}${isCurrent ? ' · כאן כעת' : ''}</span>`;
        })
        .join('');
}

function setDropTarget(el) {
    if (manage.drag.target === el) return;
    if (manage.drag.target) {
        manage.drag.target.classList.remove('bg-indigo-600', 'text-white', 'dark:text-white', 'scale-105');
    }
    manage.drag.target = el;
    if (el) el.classList.add('bg-indigo-600', 'text-white', 'dark:text-white', 'scale-105');
}

function moveGhost(x, y) {
    const ghost = document.getElementById('habitDragGhost');
    ghost.style.transform = `translate(${x + 12}px, ${y + 12}px) rotate(-2deg)`;
}

function startHabitDrag(x, y) {
    const p = manage.drag.pending;
    if (!p) return;
    const ids = manage.selectMode && manage.selectedHabitIds.has(p.id) ? [...manage.selectedHabitIds] : [p.id];
    manage.drag.active = true;
    manage.drag.ids = ids;
    closeAllMenus();
    const first = Store.habits.find(h => h.id === p.id);
    const ghost = document.getElementById('habitDragGhost');
    ghost.textContent = ids.length > 1 ? `${ids.length} הרגלים` : `${first.icon} ${first.name}`;
    ghost.classList.remove('hidden');
    moveGhost(x, y);
    renderDropTray();
    document.getElementById('habitDropTray').classList.remove('hidden');
    document.body.classList.add('is-dragging-habit');
    if (p.pointerType !== 'mouse' && navigator.vibrate) {
        try {
            navigator.vibrate(15);
        } catch {}
    }
    // Dim the dragged cards in place (no re-render: the touch target must stay in the DOM).
    document.querySelectorAll('[data-habit-card]').forEach(el => {
        if (ids.includes(el.dataset.habitCard)) el.classList.add('opacity-40');
    });
}

function endHabitDrag(drop) {
    const p = manage.drag.pending;
    if (p && p.timer) clearTimeout(p.timer);
    manage.drag.pending = null;
    detachDragListeners();
    if (dragFrame) {
        cancelAnimationFrame(dragFrame);
        dragFrame = 0;
    }
    // the drop target follows the last pointer position, even if its frame hadn't run yet
    if (manage.drag.active && dragPoint) updateDragPosition(dragPoint[0], dragPoint[1]);
    dragPoint = null;
    if (!manage.drag.active) return;
    const target = manage.drag.target;
    const ids = manage.drag.ids;
    setDropTarget(null);
    manage.drag.active = false;
    manage.drag.ids = [];
    document.getElementById('habitDragGhost').classList.add('hidden');
    document.getElementById('habitDropTray').classList.add('hidden');
    document.body.classList.remove('is-dragging-habit');
    manage.suppressNextCardClick = true;
    setTimeout(() => {
        manage.suppressNextCardClick = false;
    }, 400);
    if (drop && target && target.dataset.current !== 'true') {
        if (manage.selectMode) {
            manage.selectMode = false;
            manage.selectedHabitIds.clear();
        }
        moveHabitsToCategory(ids, target.dataset.dropCategory);
    } else {
        renderManageSection();
    }
}

// Only pointerdown listens all the time. The move / up / touch / Escape listeners exist only
// between pressing a card and the end of that press or drag, and are removed right after.
function onDragPointerMove(e) {
    const p = manage.drag.pending;
    if (!p) return;
    if (!manage.drag.active) {
        const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        if (p.pointerType === 'mouse') {
            if (moved > 6) startHabitDrag(e.clientX, e.clientY);
            else return;
        } else {
            if (moved > 10) {
                clearTimeout(p.timer);
                manage.drag.pending = null;
                detachDragListeners();
            }
            return;
        }
    }
    scheduleDragPosition(e.clientX, e.clientY);
}

function onDragPointerUp() {
    endHabitDrag(true);
}

function onDragPointerCancel() {
    // On touch, the browser cancels the pointer once the finger moves; the drag continues via touch events.
    const p = manage.drag.pending;
    if (manage.drag.active && p && p.pointerType !== 'mouse') return;
    endHabitDrag(false);
}

function onDragTouchMove(e) {
    if (!manage.drag.active) return;
    e.preventDefault();
    const t = e.touches[0];
    if (t) scheduleDragPosition(t.clientX, t.clientY);
}

function onDragTouchEnd() {
    if (manage.drag.active) endHabitDrag(true);
}

function onDragTouchCancel() {
    if (manage.drag.active) endHabitDrag(false);
}

function onDragContextMenu(e) {
    if (manage.drag.pending || manage.drag.active) e.preventDefault();
}

function onDragKeydown(e) {
    if (e.key === 'Escape' && manage.drag.active) endHabitDrag(false);
}

const DRAG_LISTENERS = [
    ['pointermove', onDragPointerMove, { passive: true }],
    ['pointerup', onDragPointerUp, undefined],
    ['pointercancel', onDragPointerCancel, undefined],
    ['touchmove', onDragTouchMove, { passive: false }],
    ['touchend', onDragTouchEnd, undefined],
    ['touchcancel', onDragTouchCancel, undefined],
    ['contextmenu', onDragContextMenu, undefined],
    ['keydown', onDragKeydown, undefined]
];

let dragListenersAttached = false;

function attachDragListeners() {
    if (dragListenersAttached) return;
    dragListenersAttached = true;
    DRAG_LISTENERS.forEach(([type, fn, opts]) => document.addEventListener(type, fn, opts));
}

function detachDragListeners() {
    if (!dragListenersAttached) return;
    dragListenersAttached = false;
    DRAG_LISTENERS.forEach(([type, fn, opts]) => document.removeEventListener(type, fn, opts));
}

export function wireHabitDrag() {
    document.addEventListener('pointerdown', e => {
        manage.suppressNextCardClick = false;
        const card = e.target.closest('[data-habit-card]');
        if (!card || app.currentMainSection !== 'manage') return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (e.target.closest('[aria-haspopup], [data-menu-panel]')) return;
        const p = { id: card.dataset.habitCard, x: e.clientX, y: e.clientY, pointerType: e.pointerType, timer: null };
        if (e.pointerType !== 'mouse') {
            p.timer = setTimeout(() => startHabitDrag(p.x, p.y), 380);
        }
        manage.drag.pending = p;
        attachDragListeners();
    });
}

// The ghost follows the pointer once per frame, however many move events arrive
let dragFrame = 0;

let dragPoint = null;

function scheduleDragPosition(x, y) {
    dragPoint = [x, y];
    if (dragFrame) return;
    dragFrame = requestAnimationFrame(() => {
        dragFrame = 0;
        if (manage.drag.active && dragPoint) updateDragPosition(dragPoint[0], dragPoint[1]);
    });
}

function updateDragPosition(x, y) {
    moveGhost(x, y);
    const el = document.elementFromPoint(x, y);
    setDropTarget(el ? el.closest('[data-drop-category]') : null);
}
