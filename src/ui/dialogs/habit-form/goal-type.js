// Every day / days a week / fixed days, and the weekday picker.

import { HEBREW_DAYS_FULL, HEBREW_DAYS_SHORT } from '../../../config/hebrew.js';
import { habitForm } from '../../../state/habit-form.js';
import { motion } from '../../../state/motion.js';
import { updateSegPill } from '../../components/segmented.js';
import { showToast } from '../../components/toast.js';
import { shakeField } from '../../dom/animate.js';
import { patchHTML } from '../../dom/patch.js';
import { updateHabitSaveState } from './form-controller.js';

export function setModalGoalType(type) {
    habitForm.goalType = type;
    const types = ['daily', 'flexible', 'fixed_days'];
    types.forEach(t => {
        const btn = document.getElementById(`goalTypeBtn_${t}`);
        const panel = document.getElementById(`goalPanel_${t}`);
        if (btn) {
            btn.className =
                t === type
                    ? 'min-h-[44px] flex items-center justify-center text-center whitespace-nowrap py-2 px-1.5 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400'
                    : 'min-h-[44px] flex items-center justify-center text-center whitespace-nowrap py-2 px-1.5 rounded-lg text-xs font-semibold transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
        }
        if (btn) btn.setAttribute('aria-pressed', String(t === type));
        if (panel) {
            panel.classList.toggle('hidden', t !== type);
        }
    });
    updateSegPill(document.getElementById('goalTypeBtn_daily').parentElement);
    renderFixedDaysPicker();
    updateHabitSaveState();
}

export function toggleModalFixedDay(dayIdx) {
    if (habitForm.fixedDays.includes(dayIdx)) {
        if (habitForm.fixedDays.length > 1) {
            habitForm.fixedDays = habitForm.fixedDays.filter(d => d !== dayIdx);
        } else {
            showToast('יש לבחור לפחות יום קבוע אחד בשבוע');
            shakeField(document.getElementById('fixedDaysPickerGrid'), false);
            return;
        }
    } else {
        habitForm.fixedDays.push(dayIdx);
        habitForm.fixedDays.sort((a, b) => a - b);
        motion.justPicked = dayIdx;
    }
    renderFixedDaysPicker();
    motion.justPicked = null;
    updateHabitSaveState();
}

function renderFixedDaysPicker() {
    const grid = document.getElementById('fixedDaysPickerGrid');
    const badge = document.getElementById('fixedDaysCountBadge');
    if (!grid || !badge) return;

    const count = habitForm.fixedDays.length;
    badge.textContent = count === 1 ? 'יום אחד נבחר' : `${count} ימים נבחרו`;

    patchHTML(
        grid,
        HEBREW_DAYS_SHORT.map((label, idx) => {
            const active = habitForm.fixedDays.includes(idx);
            return `
            <button type="button" data-action="toggleFixedDay" data-arg="${idx}" aria-pressed="${active}" aria-label="${HEBREW_DAYS_FULL[idx]}" data-cell-pop="${active && motion.justPicked === idx ? '1' : ''}" class="min-w-0 min-h-[44px] py-2.5 rounded-xl font-semibold text-xs border transition-all ${
                active
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
            }">
                ${label}
            </button>
        `;
        }).join('')
    );
}
