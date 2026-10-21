// The add / edit habit dialog: open, Enter to save, save, close.

import { UNCATEGORIZED_LABEL } from '../../../config/categories.js';
import { COLOR_OPTIONS } from '../../../config/colors.js';
import { ICON_OPTIONS } from '../../../config/icons.js';
import { getDateKeyDaysAgo } from '../../../core/dates.js';
import { normalizeScheduleFields } from '../../../core/schedule.js';
import { app } from '../../../state/app.js';
import { habitForm } from '../../../state/habit-form.js';
import { manage } from '../../../state/manage.js';
import { tracker } from '../../../state/tracker.js';
import { Store } from '../../../store/store.js';
import { renderAll } from '../../app/render.js';
import { hideModal, showModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { prefersReducedMotion, shakeField } from '../../dom/animate.js';
import { flashHabits, withFlip } from '../../dom/flip.js';
import { renderModalPickers } from './appearance.js';
import { populateCategorySelectDropdown } from './category-select.js';
import { getHabitFormState, isHabitFormSaveable, updateHabitSaveState } from './form-controller.js';
import { setModalGoalType } from './goal-type.js';
import { HABIT_SECTIONS, toggleHabitSection } from './sections.js';
import { readStartDateInput, setupStartDateInput } from './start-date.js';
import { updateHabitModalSummaries } from './summaries.js';
import { setModalTime } from './time-editor.js';
import { readModalTime } from './time-model.js';

// Enter saves when possible; with an empty name it points at the field instead of doing nothing
export function handleHabitFormEnter(event) {
    if (event.key !== 'Enter' || event.target.tagName !== 'INPUT') return;
    event.preventDefault();
    if (!document.getElementById('saveHabitBtn').disabled) {
        saveHabitForm({ preventDefault() {} });
    } else if (!document.getElementById('habitNameInput').value.trim()) {
        const nameInput = document.getElementById('habitNameInput');
        shakeField(nameInput);
        nameInput.focus();
    }
}

export function openHabitModal(habitId = null) {
    const modal = document.getElementById('habitModalBackdrop');
    const titleEl = document.getElementById('modalTitle');

    populateCategorySelectDropdown();
    Object.keys(HABIT_SECTIONS).forEach(name => toggleHabitSection(name, false));
    document.getElementById('customIconPanel').classList.add('hidden');
    document.getElementById('customIconInput').value = '';

    if (habitId) {
        const habit = Store.find(habitId);
        if (!habit) return;
        titleEl.textContent = 'עריכת הרגל';
        document.getElementById('habitIdInput').value = habit.id;
        document.getElementById('habitNameInput').value = habit.name;
        populateCategorySelectDropdown(habit.category || '');
        document.getElementById('habitGoalInput').value = String(Math.min(6, Math.max(1, habit.weeklyGoal || 4)));
        document.getElementById('habitNoteInput').value = habit.note || '';
        habitForm.icon = habit.icon || ICON_OPTIONS[0].emoji;
        habitForm.color = habit.color || COLOR_OPTIONS[0].id;
        habitForm.goalType = habit.goalType || 'daily';
        habitForm.fixedDays =
            Array.isArray(habit.fixedDays) && habit.fixedDays.length > 0 ? [...habit.fixedDays] : [0, 2, 4];
        setupStartDateInput(habit.startDate, habit);
        setModalTime(habit.time, habit.duration, habit.dayTimes, habit.slotTimes);
    } else {
        titleEl.textContent = 'הרגל חדש';
        document.getElementById('habitIdInput').value = '';
        document.getElementById('habitNameInput').value = '';
        const activeCat = app.currentMainSection === 'manage' ? manage.selectedCategory : tracker.selectedCategory;
        const defaultCat =
            activeCat !== 'הכל' && activeCat !== UNCATEGORIZED_LABEL ? activeCat : Store.categories[0] || '';
        populateCategorySelectDropdown(defaultCat);
        document.getElementById('habitGoalInput').value = '4';
        document.getElementById('habitNoteInput').value = '';
        habitForm.icon = ICON_OPTIONS[0].emoji;
        habitForm.color = COLOR_OPTIONS[0].id;
        habitForm.goalType = 'daily';
        habitForm.fixedDays = [0, 2, 4];
        setupStartDateInput(getDateKeyDaysAgo(0), null);
        setModalTime('', 0);
    }
    habitForm.scheduleScope = 'forward';

    setModalGoalType(habitForm.goalType);
    renderModalPickers();
    habitForm.initialState = getHabitFormState();
    updateHabitSaveState();
    updateHabitModalSummaries();
    showModal(modal);
    const modalScroller = modal.querySelector('.themed-scroll');
    if (modalScroller) modalScroller.scrollTop = 0;
    if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        setTimeout(() => document.getElementById('habitNameInput').focus(), 60);
    }
}

export function closeHabitModal() {
    hideModal(document.getElementById('habitModalBackdrop'));
}

export function saveHabitForm(event) {
    event.preventDefault();
    const id = document.getElementById('habitIdInput').value.trim();
    const name = document.getElementById('habitNameInput').value.trim();
    const category = document.getElementById('habitCategoryInput').value;
    const note = document.getElementById('habitNoteInput').value.trim();

    if (!name || !isHabitFormSaveable()) return;

    let weeklyGoal = 7;
    let fixedDays = [0, 1, 2, 3, 4, 5, 6];

    if (habitForm.goalType === 'daily') {
        weeklyGoal = 7;
        fixedDays = [0, 1, 2, 3, 4, 5, 6];
    } else if (habitForm.goalType === 'flexible') {
        weeklyGoal = parseInt(document.getElementById('habitGoalInput').value, 10) || 4;
        fixedDays = [];
    } else if (habitForm.goalType === 'fixed_days') {
        fixedDays = [...habitForm.fixedDays].sort((a, b) => a - b);
        weeklyGoal = fixedDays.length;
    }

    const { time, duration, dayTimes, slotTimes } = readModalTime();
    const scheduleDef = normalizeScheduleFields({
        goalType: habitForm.goalType,
        fixedDays,
        weeklyGoal,
        time,
        duration,
        dayTimes,
        slotTimes
    });

    if (id) {
        const existing = Store.find(id);
        if (existing) {
            Store.updateHabit(
                id,
                {
                    name,
                    category,
                    note,
                    icon: habitForm.icon,
                    color: habitForm.color,
                    startDate: readStartDateInput(existing)
                },
                scheduleDef,
                habitForm.scheduleScope
            );
        }
        showToast('ההרגל עודכן בהצלחה');
    } else {
        const newHabit = Store.addHabit({
            id: 'h_' + Date.now(),
            name,
            category,
            ...scheduleDef,
            note,
            icon: habitForm.icon,
            color: habitForm.color,
            startDate: readStartDateInput(null),
            history: {}
        });
        flashHabits([newHabit.id]);
        showToast('הרגל חדש נוסף למערכת!');
    }

    closeHabitModal();
    const isNew = !id;
    withFlip(() => renderAll());
    if (isNew) {
        const card = [...document.querySelectorAll('.flash-highlight')].find(el => el.getClientRects().length);
        if (card) card.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
}
