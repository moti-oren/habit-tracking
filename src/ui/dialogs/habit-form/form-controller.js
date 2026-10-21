// Keeps the habit form consistent: the Save button, the time chips and fields, the hints.
// syncHabitTimeFields → togglePerDayTimes → updateHabitSaveState → syncHabitTimeFields is real
// recursion (per-day times while only one day is active), so the three stay in this module.

import { HEBREW_DAYS_FULL, HEBREW_DAYS_SHORT } from '../../../config/hebrew.js';
import { hasAnyTime } from '../../../core/schedule.js';
import { habitForm } from '../../../state/habit-form.js';
import { patchHTML } from '../../dom/patch.js';
import { updateScheduleScopeBox } from './schedule-scope.js';
import { updateHabitModalSummaries, updateHabitTimeHint } from './summaries.js';
import {
    getModalScheduleDef,
    isPerDayTimesOn,
    loadEditorFromCell,
    modalActiveWeekdays,
    modalSlotCount,
    readModalTime,
    setSelectDisabled,
    timeChipHtml,
    timeModelRow
} from './time-model.js';

export function getHabitFormState() {
    const goalType = habitForm.goalType;
    return JSON.stringify({
        name: (document.getElementById('habitNameInput')?.value || '').trim(),
        category: document.getElementById('habitCategoryInput')?.value || '',
        startDate: document.getElementById('habitStartDateInput')?.value || '',
        goalType,
        weeklyGoal: goalType === 'flexible' ? String(document.getElementById('habitGoalInput')?.value || '') : '',
        fixedDays: goalType === 'fixed_days' ? [...habitForm.fixedDays].sort((a, b) => a - b) : [],
        note: (document.getElementById('habitNoteInput')?.value || '').trim(),
        icon: habitForm.icon,
        color: habitForm.color,
        timing: (() => {
            const d = getModalScheduleDef();
            return [d.time, d.duration, d.dayTimes, d.slotTimes];
        })()
    });
}

// Switch on: every day starts from the shared times. Off: the first day with a time becomes the shared one.
export function togglePerDayTimes(on) {
    const active = modalActiveWeekdays();
    if (on) {
        habitForm.timeModel.cells = Array.from({ length: 7 }, () => [...habitForm.timeModel.uniform]);
        if (!active.includes(habitForm.timeModel.day)) habitForm.timeModel.day = active[0];
    } else {
        const src = active.find(d => habitForm.timeModel.cells[d].some(Boolean));
        habitForm.timeModel.uniform = [...habitForm.timeModel.cells[src !== undefined ? src : active[0]]];
    }
    loadEditorFromCell();
    syncHabitTimeFields();
    updateHabitSaveState();
}

// Renders the chips, the caption and the field states from the model
export function syncHabitTimeFields() {
    const dayChips = document.getElementById('timeDayChips');
    if (!dayChips) return;
    const active = modalActiveWeekdays();
    const n = modalSlotCount();
    // a different time per day only makes sense with 2+ active days
    const multiDay = active.length > 1;
    document.getElementById('habitPerDayToggleWrap').classList.toggle('hidden', !multiDay);
    if (!multiDay && isPerDayTimesOn()) {
        document.getElementById('habitPerDayToggle').checked = false;
        togglePerDayTimes(false); // the remaining day's times become the shared ones
        return;
    }
    const perDay = isPerDayTimesOn();
    let moved = false;
    if (perDay && !active.includes(habitForm.timeModel.day)) {
        habitForm.timeModel.day = active[0];
        moved = true;
    }
    if (habitForm.timeModel.slot >= n) {
        habitForm.timeModel.slot = 0;
        moved = true;
    }
    if (moved) loadEditorFromCell();

    dayChips.classList.toggle('hidden', !perDay);
    if (perDay) {
        dayChips.style.gridTemplateColumns = `repeat(${active.length}, minmax(0, 1fr))`;
        patchHTML(
            dayChips,
            active
                .map(d => {
                    const t = habitForm.timeModel.cells[d][habitForm.timeModel.slot] || '';
                    return timeChipHtml(
                        `timeDayChip_${d}`,
                        `data-action="pickTimeDay" data-arg="${d}"`,
                        d === habitForm.timeModel.day,
                        HEBREW_DAYS_SHORT[d],
                        t,
                        `${HEBREW_DAYS_FULL[d]}${n > 1 ? `, פעם ${habitForm.timeModel.slot + 1}` : ''}: ${t || 'ללא שעה'}`
                    );
                })
                .join('')
        );
    }
    const slotChips = document.getElementById('timeSlotChips');
    slotChips.classList.toggle('hidden', n < 2);
    if (n > 1) {
        const row = timeModelRow(habitForm.timeModel.day);
        patchHTML(
            slotChips,
            [...Array(n).keys()]
                .map(i =>
                    timeChipHtml(
                        `timeSlotChip_${i}`,
                        `data-action="pickTimeSlot" data-arg="${i}"`,
                        i === habitForm.timeModel.slot,
                        `פעם ${i + 1}`,
                        row[i] || '',
                        `פעם ${i + 1}${perDay ? `, ${HEBREW_DAYS_FULL[habitForm.timeModel.day]}` : ''}: ${row[i] || 'ללא שעה'}`,
                        'flex-1'
                    )
                )
                .join('')
        );
    }
    const caption = document.getElementById('timeEditCaption');
    caption.classList.toggle('hidden', !perDay && n < 2);
    caption.textContent = `השעה של ${[perDay ? HEBREW_DAYS_FULL[habitForm.timeModel.day] : '', n > 1 ? `פעם ${habitForm.timeModel.slot + 1}` : ''].filter(Boolean).join(', ')}:`;
    const copyBtn = document.getElementById('copyDayTimesBtn');
    copyBtn.classList.toggle('hidden', !perDay);
    copyBtn.textContent = `העתקת ${n > 1 ? 'השעות' : 'השעה'} של ${HEBREW_DAYS_FULL[habitForm.timeModel.day]} לכל הימים`;

    setSelectDisabled('habitTimeMinute', !document.getElementById('habitTimeHour').value);
    setSelectDisabled('habitDuration', !hasAnyTime(readModalTime()));
    document.getElementById('habitDurationEach').classList.toggle('hidden', n < 2);
    updateHabitTimeHint();
    updateHabitModalSummaries();
}

export function isHabitFormSaveable() {
    const name = (document.getElementById('habitNameInput')?.value || '').trim();
    if (!name) return false;
    const isEditing = !!document.getElementById('habitIdInput')?.value;
    if (!isEditing) return true;
    return habitForm.initialState === null || getHabitFormState() !== habitForm.initialState;
}

export function updateHabitSaveState() {
    const btn = document.getElementById('saveHabitBtn');
    if (btn) btn.disabled = !isHabitFormSaveable();
    syncHabitTimeFields();
    updateScheduleScopeBox();
}
