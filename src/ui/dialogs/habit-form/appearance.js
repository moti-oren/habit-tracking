// Icon and colour: the pickers, the custom emoji field and the preview.

import { COLOR_OPTIONS } from '../../../config/colors.js';
import { ICON_OPTIONS, MORE_ICONS } from '../../../config/icons.js';
import { getGraphemes } from '../../../core/text.js';
import { habitForm } from '../../../state/habit-form.js';
import { motion } from '../../../state/motion.js';
import { escapeHtml } from '../../dom/html.js';
import { icon } from '../../dom/icons.js';
import { patchHTML } from '../../dom/patch.js';
import { updateHabitSaveState } from './form-controller.js';

export function toggleCustomIconPanel() {
    const panel = document.getElementById('customIconPanel');
    const opening = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !opening);
    if (opening) {
        const moreList = [...new Set([...ICON_OPTIONS.slice(10).map(i => i.emoji), ...MORE_ICONS])];
        document.getElementById('moreIconsGrid').innerHTML = moreList
            .map(
                e =>
                    `<button type="button" data-action="selectIcon" class="h-9 rounded-lg text-lg flex items-center justify-center hover:bg-slate-200/70 dark:hover:bg-slate-700 transition">${e}</button>`
            )
            .join('');
    }
    renderModalPickers();
}

export function handleCustomIconInput(input) {
    const chars = getGraphemes(input.value);
    if (chars.length === 0) return;
    // Keep only the last emoji typed or pasted.
    const last = chars[chars.length - 1];
    if (/^[\p{L}\p{N}\s]+$/u.test(last)) {
        input.value = '';
        return;
    } // letters/digits are not icons
    input.value = last;
    habitForm.icon = last;
    renderModalPickers();
    updateHabitSaveState();
}

export function renderModalPickers() {
    const iconGrid = document.getElementById('iconPickerGrid');
    // 11 icons + the "+" tile fill two clean rows of 6. If the chosen icon is not among
    // them, it takes the last icon slot (the replaced one stays reachable from the "+" list).
    const iconList = ICON_OPTIONS.slice(0, 11).map(i => ({ emoji: i.emoji, label: i.label }));
    if (!iconList.some(i => i.emoji === habitForm.icon)) {
        const known = ICON_OPTIONS.find(i => i.emoji === habitForm.icon);
        iconList[10] = { emoji: habitForm.icon, label: known ? known.label : 'אייקון מותאם אישית' };
    }
    const panelOpen = !document.getElementById('customIconPanel').classList.contains('hidden');
    const plusTile = `
            <button type="button" data-action="toggleCustomIcons" data-tip="אייקון אחר" aria-label="בחירת אייקון אחר" aria-expanded="${panelOpen}" class="h-11 rounded-xl flex items-center justify-center border border-dashed transition ${
                panelOpen
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10'
                    : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600'
            }"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14m7-7H5"/></svg></button>`;
    patchHTML(
        iconGrid,
        iconList
            .map(item => {
                const active = item.emoji === habitForm.icon;
                return `
            <button type="button" data-action="selectIcon" data-tip="${escapeHtml(item.label)}" aria-label="אייקון: ${escapeHtml(item.label)}" aria-pressed="${active}" data-cell-pop="${active && motion.justPicked === 'icon' ? '1' : ''}" class="h-11 rounded-xl text-xl flex items-center justify-center border transition ${
                active
                    ? 'border-indigo-500 bg-indigo-500/15 ring-2 ring-indigo-500/30'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-700'
            }">
                ${escapeHtml(item.emoji)}
            </button>
        `;
            })
            .join('') + plusTile
    );

    const colorGrid = document.getElementById('colorPickerGrid');
    patchHTML(
        colorGrid,
        COLOR_OPTIONS.map(c => {
            const active = c.id === habitForm.color;
            return `
            <button type="button" data-action="selectColor" data-arg="${c.id}" data-tip="${c.name}" aria-label="צבע ${c.name}" aria-pressed="${active}" data-cell-pop="${active && motion.justPicked === 'color' ? '1' : ''}" class="tap-44 w-10 h-10 shrink-0 rounded-full ${c.bg} flex items-center justify-center text-white text-sm font-bold transition ${
                active
                    ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-slate-900'
                    : 'opacity-75 hover:opacity-100'
            }">
                ${active ? icon('check', 'w-4 h-4', 3) : ''}
            </button>
        `;
        }).join('')
    );
    updateHabitPreview();
}

// ---- Habit modal: preview + collapsible sections ----
function updateHabitPreview() {
    const prev = document.getElementById('habitPreviewIcon');
    const btn = document.getElementById('habitAppearanceBtn');
    if (!prev || !btn) return;
    const c = COLOR_OPTIONS.find(x => x.id === habitForm.color) || COLOR_OPTIONS[0];
    prev.className = `w-12 h-12 rounded-xl flex items-center justify-center text-2xl border-2 ${c.softBg} ${c.border}`;
    prev.textContent = habitForm.icon;
    const known = ICON_OPTIONS.find(i => i.emoji === habitForm.icon);
    btn.setAttribute(
        'aria-label',
        `מראה ההרגל: ${known ? known.label : 'אייקון מותאם'}, צבע ${c.name}. שינוי אייקון וצבע`
    );
}

export function selectModalIcon(emoji) {
    habitForm.icon = emoji;
    motion.justPicked = 'icon';
    renderModalPickers();
    motion.justPicked = null;
    updateHabitSaveState();
}

export function selectModalColor(colorId) {
    habitForm.color = colorId;
    motion.justPicked = 'color';
    renderModalPickers();
    motion.justPicked = null;
    updateHabitSaveState();
}
