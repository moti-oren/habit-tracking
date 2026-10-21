// The time editor: times per day, a different time per weekday, the hour/minute pair, copying.

import { MAX_SLOTS } from '../../../config/schedule.js';
import { habitForm } from '../../../state/habit-form.js';
import { syncHabitTimeFields, updateHabitSaveState } from './form-controller.js';
import {
    ensureSelectOption,
    focusAfterRender,
    loadEditorFromCell,
    modalActiveWeekdays,
    timeModelRow
} from './time-model.js';

// Hour / minute changed: write the picked cell
export function onTimeEditorChange() {
    const hour = document.getElementById('habitTimeHour').value;
    const minute = document.getElementById('habitTimeMinute').value || '00';
    timeModelRow(habitForm.timeModel.day)[habitForm.timeModel.slot] = hour ? `${hour}:${minute}` : '';
    syncHabitTimeFields();
}

export function pickTimeDay(d) {
    habitForm.timeModel.day = d;
    loadEditorFromCell();
    syncHabitTimeFields();
    focusAfterRender(`timeDayChip_${d}`);
}

export function pickTimeSlot(i) {
    habitForm.timeModel.slot = i;
    loadEditorFromCell();
    syncHabitTimeFields();
    focusAfterRender(`timeSlotChip_${i}`);
}

// Occurrences beyond the new count are cleared, so they don't come back unexpectedly
export function setModalTimesPerDay(n) {
    for (let i = n; i < MAX_SLOTS; i++) {
        habitForm.timeModel.uniform[i] = '';
        habitForm.timeModel.cells.forEach(r => {
            r[i] = '';
        });
    }
    if (habitForm.timeModel.slot >= n) habitForm.timeModel.slot = 0;
    loadEditorFromCell();
    syncHabitTimeFields();
    updateHabitSaveState();
}

export function copyDayTimesToAll() {
    const src = [...habitForm.timeModel.cells[habitForm.timeModel.day]];
    habitForm.timeModel.cells = habitForm.timeModel.cells.map(() => [...src]);
    syncHabitTimeFields();
    updateHabitSaveState();
}

export function setModalTime(time, duration, dayTimes = null, slotTimes = null) {
    const durEl = document.getElementById('habitDuration');
    if (!durEl) return;
    const n = dayTimes ? (Array.isArray(dayTimes[0]) ? dayTimes[0].length : 1) : slotTimes ? slotTimes.length : 1;
    document.getElementById('habitTimesPerDay').value = String(n);
    document.getElementById('habitPerDayToggle').checked = !!dayTimes;
    const pad = r => [...r, '', '', '', ''].slice(0, MAX_SLOTS);
    habitForm.timeModel.uniform = pad(slotTimes || [time || '']);
    habitForm.timeModel.cells = Array.from({ length: 7 }, (_, d) =>
        pad(dayTimes ? (Array.isArray(dayTimes[d]) ? dayTimes[d] : [dayTimes[d] || '']) : habitForm.timeModel.uniform)
    );
    habitForm.timeModel.day = modalActiveWeekdays()[0];
    habitForm.timeModel.slot = 0;
    const hasTime = !!time || !!dayTimes || !!slotTimes;
    ensureSelectOption(durEl, String(duration || 0), `${duration} דקות`);
    durEl.value = hasTime ? String(duration || 0) : '0';
    loadEditorFromCell();
    syncHabitTimeFields();
}
