// The habit form's schedule as the fields and the time model describe it.

import { MAX_SLOTS } from '../../../config/schedule.js';
import { normalizeScheduleFields, scheduleWeekdays } from '../../../core/schedule.js';
import { habitForm } from '../../../state/habit-form.js';

export function isPerDayTimesOn() {
    return !!document.getElementById('habitPerDayToggle')?.checked;
}

export function modalSlotCount() {
    return Math.max(1, Math.min(MAX_SLOTS, Number(document.getElementById('habitTimesPerDay')?.value) || 1));
}

export function modalActiveWeekdays() {
    return scheduleWeekdays({ goalType: habitForm.goalType, fixedDays: habitForm.fixedDays });
}

export function timeModelRow(day) {
    return isPerDayTimesOn() ? habitForm.timeModel.cells[day] : habitForm.timeModel.uniform;
}

export function readModalTime() {
    const n = modalSlotCount();
    const duration = Number(document.getElementById('habitDuration')?.value) || 0;
    if (isPerDayTimesOn())
        return { time: '', duration, slotTimes: null, dayTimes: habitForm.timeModel.cells.map(r => r.slice(0, n)) };
    if (n > 1) return { time: '', duration, dayTimes: null, slotTimes: habitForm.timeModel.uniform.slice(0, n) };
    const t = habitForm.timeModel.uniform[0] || '';
    return { time: t, duration: t ? duration : 0, dayTimes: null, slotTimes: null };
}

// Show the picked cell's time in the hour / minute fields
export function loadEditorFromCell() {
    const t = timeModelRow(habitForm.timeModel.day)[habitForm.timeModel.slot] || '';
    const hourEl = document.getElementById('habitTimeHour');
    const minEl = document.getElementById('habitTimeMinute');
    if (t) {
        const [h, m] = t.split(':');
        hourEl.value = h;
        ensureSelectOption(minEl, m, m);
        minEl.value = m;
    } else {
        hourEl.value = '';
        minEl.value = '00';
    }
}

export function focusAfterRender(id) {
    const el = document.getElementById(id);
    if (el) el.focus({ preventScroll: true });
}

export function setSelectDisabled(id, disabled) {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = disabled;
    const trigger = document.getElementById(`${id}_trigger`);
    if (trigger) trigger.disabled = disabled;
}

export function ensureSelectOption(select, value, label) {
    if (![...select.options].some(o => o.value === value)) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = label;
        const after = [...select.options].find(o => o.value !== '' && Number(o.value) > Number(value));
        select.insertBefore(opt, after || null);
    }
}

export function timeChipHtml(id, actionAttrs, selected, label, time, ariaLabel, extraCls = '') {
    return `<button type="button" id="${id}" ${actionAttrs} aria-pressed="${selected}" aria-label="${ariaLabel}" class="${extraCls} min-w-0 min-h-[44px] py-1.5 px-1 rounded-xl border text-center transition ${
        selected
            ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400'
    }"><span class="block text-xs font-semibold">${label}</span><span dir="ltr" class="block text-xs tabular-nums ${selected ? 'text-indigo-100' : time ? 'text-slate-600 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}">${time || '—'}</span></button>`;
}

export function getModalScheduleDef() {
    const goalType = habitForm.goalType;
    return normalizeScheduleFields({
        goalType,
        fixedDays: goalType === 'fixed_days' ? [...habitForm.fixedDays] : [],
        weeklyGoal: goalType === 'flexible' ? parseInt(document.getElementById('habitGoalInput')?.value, 10) || 4 : 7,
        ...readModalTime()
    });
}
