// Validation of stored data: it may be old, edited by hand, or damaged.

import { UNCATEGORIZED_LABEL } from '../config/categories.js';
import { COLOR_OPTIONS } from '../config/colors.js';
import { ICON_OPTIONS } from '../config/icons.js';
import { isValidDateKey } from '../core/dates.js';
import { normalizeHabitGoal } from '../core/habit.js';

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ICON_UNSAFE_RE = /[<>&"'`\\]/;

function sanitizeIcon(v) {
    const icon = typeof v === 'string' ? v.trim() : '';
    return icon && icon.length <= 32 && !ICON_UNSAFE_RE.test(icon) ? icon : ICON_OPTIONS[0].emoji;
}
function sanitizeHistory(h) {
    const out = {};
    if (h && typeof h === 'object' && !Array.isArray(h)) {
        Object.keys(h).forEach(k => {
            if (isValidDateKey(k)) out[k] = !!h[k];
        });
    }
    return out;
}
// Fixes only what is invalid, so valid data keeps its exact shape and key order
export function sanitizeHabit(raw, index, seenIds) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const h = { ...raw };
    let id = typeof h.id === 'string' && ID_RE.test(h.id) ? h.id : null;
    if (!id || seenIds.has(id)) {
        id = `h_${Date.now()}_${index}`;
        while (seenIds.has(id)) id += 'x';
    }
    seenIds.add(id);
    if (h.id !== id) h.id = id;
    if (typeof h.name !== 'string' || !h.name.trim()) h.name = 'הרגל ללא שם';
    else if (h.name.length > 120) h.name = h.name.slice(0, 120);
    if (h.category !== undefined && typeof h.category !== 'string') h.category = '';
    if (h.note !== undefined && typeof h.note !== 'string') h.note = '';
    else if (typeof h.note === 'string' && h.note.length > 300) h.note = h.note.slice(0, 300);
    const icon = sanitizeIcon(h.icon);
    if (icon !== h.icon) h.icon = icon;
    if (typeof h.color !== 'string') h.color = COLOR_OPTIONS[0].id;
    const history = sanitizeHistory(h.history);
    if (JSON.stringify(history) !== JSON.stringify(h.history)) h.history = history;
    return normalizeHabitGoal(h);
}
export function sanitizeCategories(list) {
    if (!Array.isArray(list)) return null;
    const reserved = ['הכל', UNCATEGORIZED_LABEL];
    return [
        ...new Set(
            list
                .filter(c => typeof c === 'string' || typeof c === 'number')
                .map(c => String(c).trim())
                .filter(c => c && c.length <= 40 && !reserved.includes(c))
        )
    ];
}
