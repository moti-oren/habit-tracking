// "Which days does the change apply to?": shown when the schedule of a habit with past days changes.

import { addDaysToKey, getDateKeyDaysAgo } from '../../../core/dates.js';
import { describeScheduleVersion } from '../../../core/format.js';
import { getScheduleVersion, hasAnyTime, sameScheduleFields } from '../../../core/schedule.js';
import { habitForm } from '../../../state/habit-form.js';
import { Store } from '../../../store/store.js';
import { prefersReducedMotion, restartAnimationClass } from '../../dom/animate.js';
import { readStartDateInput } from './start-date.js';
import { getModalScheduleDef } from './time-model.js';

export function setScheduleScope(scope) {
    habitForm.scheduleScope = scope;
    updateScheduleScopeBox();
}

export function updateScheduleScopeBox() {
    const box = document.getElementById('scheduleScopeBox');
    if (!box) return;
    const id = document.getElementById('habitIdInput')?.value;
    const habit = id ? Store.habits.find(h => h.id === id) : null;
    const todayKey = getDateKeyDaysAgo(0);
    const startKey = habit ? readStartDateInput(habit) : todayKey;
    let show = false,
        prev = null,
        def = null;
    if (habit && startKey < todayKey) {
        def = getModalScheduleDef();
        show = !sameScheduleFields(def, getScheduleVersion(habit, todayKey));
        prev = getScheduleVersion(habit, addDaysToKey(todayKey, -1));
    }
    const wasHidden = box.classList.contains('hidden');
    box.classList.toggle('hidden', !show);
    if (!show) return;
    if (wasHidden) {
        restartAnimationClass(box, 'fade-in-quick');
        requestAnimationFrame(() =>
            box.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
        );
    }
    ['forward', 'all'].forEach(sc => {
        const btn = document.getElementById(`scopeBtn_${sc}`);
        const on = habitForm.scheduleScope === sc;
        btn.setAttribute('aria-checked', String(on));
        btn.classList.toggle('bg-white', on);
        btn.classList.toggle('dark:bg-slate-900', on);
        btn.classList.toggle('border-amber-400', on);
        btn.classList.toggle('dark:border-amber-600', on);
        btn.classList.toggle('text-amber-900', on);
        btn.classList.toggle('dark:text-amber-100', on);
        btn.classList.toggle('shadow-sm', on);
        btn.classList.toggle('border-amber-200', !on);
        btn.classList.toggle('dark:border-amber-900/60', !on);
        btn.classList.toggle('text-amber-800/80', !on);
        btn.classList.toggle('dark:text-amber-300/70', !on);
    });
    document.getElementById('scheduleScopeText').textContent =
        habitForm.scheduleScope === 'forward'
            ? `הימים שעברו יישארו לפי ההגדרה הקודמת (${describeScheduleVersion(prev, hasAnyTime(def))}), כך שהסטטיסטיקה שלהם לא תשתנה.`
            : 'ההגדרה החדשה תחול גם על כל הימים שעברו, והסטטיסטיקה שלהם תחושב מחדש. מתאים לתיקון טעות.';
}
