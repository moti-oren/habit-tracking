// Date fields that open the calendar dialog instead of the native picker (the hidden native input keeps the value).

import { formatDateCompactLabel, formatDateTriggerLabel } from '../../../core/format.js';
import { closeCustomSelect, fireChange, relabel, watchValue } from '../../components/custom-select.js';
import { CALENDAR_SVG } from '../../dom/icons.js';
import { openDatePicker } from './calendar.js';

export function enhanceDateInput(input, title, customOpen) {
    if (input.dataset.enhanced) return;
    input.dataset.enhanced = '1';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${input.id}_trigger`;
    trigger.className =
        input.className.replace('habit-date-input', '').replace(/\bblock\b/, '') +
        ' flex items-center justify-between gap-2 text-right';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.innerHTML = `<span class="truncate min-w-0" data-label></span>${CALENDAR_SVG}`;
    input.classList.add('hidden');
    input.tabIndex = -1;
    input.after(trigger);
    relabel(input.id, trigger.id);

    const sync = () => {
        const label = input.dataset.compact ? formatDateCompactLabel(input.value) : formatDateTriggerLabel(input.value);
        const el = trigger.querySelector('[data-label]');
        el.textContent = label || 'בחירת תאריך';
        el.classList.toggle('text-slate-500', !label);
        el.classList.toggle('dark:text-slate-400', !label);
    };
    watchValue(input, sync);
    input.addEventListener('change', sync);
    sync();

    trigger.addEventListener('click', e => {
        e.stopPropagation();
        closeCustomSelect(false);
        if (customOpen) {
            customOpen(input);
            return;
        }
        openDatePicker({
            value: input.value,
            min: input.min || null,
            max: input.max || null,
            title,
            onPick: key => {
                if (input.value === key) return;
                input.value = key;
                fireChange(input);
            }
        });
    });
}
