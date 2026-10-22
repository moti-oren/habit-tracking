// Manage actions: open or select cards, archive, restore, delete, move between categories, reset.

import { UNCATEGORIZED_LABEL } from '../../../config/categories.js';
import { getDateKeyDaysAgo } from '../../../core/dates.js';
import { habitCountLabel } from '../../../core/format.js';
import { isHabitArchived } from '../../../core/habit.js';
import { manage } from '../../../state/manage.js';
import { motion } from '../../../state/motion.js';
import { setWeek, tracker } from '../../../state/tracker.js';
import { createUndoSnapshot } from '../../../state/undo.js';
import { getDefaultHabits } from '../../../store/sample-habits.js';
import { Store } from '../../../store/store.js';
import { renderAll } from '../../app/render.js';
import { closeAllMenus } from '../../components/menus.js';
import { setRevealOpen } from '../../components/reveal.js';
import { showToast } from '../../components/toast.js';
import { openConfirmModal } from '../../dialogs/confirm.js';
import { closeHabitModal, openHabitModal } from '../../dialogs/habit-form/habit-form.js';
import { animateOut, flashHabits, withFlip } from '../../dom/flip.js';
import { renderArchiveSection } from './archive.js';
import { renderManageSection } from './manage-grid.js';

export function handleManageCardClick(id) {
    if (manage.suppressNextCardClick) {
        manage.suppressNextCardClick = false;
        return;
    }
    if (manage.selectMode) {
        if (manage.selectedHabitIds.has(id)) manage.selectedHabitIds.delete(id);
        else manage.selectedHabitIds.add(id);
        motion.lastSelectToggledId = id;
        renderManageSection();
        motion.lastSelectToggledId = null;
    } else {
        openHabitModal(id);
    }
}

export function toggleManageSelectMode() {
    if (manage.selectMode) exitManageSelectMode();
    else {
        manage.selectMode = true;
        closeAllMenus();
        motion.selectModeJustChanged = true;
        renderManageSection();
        motion.selectModeJustChanged = false;
    }
}

export function exitManageSelectMode() {
    manage.selectMode = false;
    manage.selectedHabitIds.clear();
    renderManageSection();
}

export function toggleSelectAllManageHabits() {
    const allSelected =
        manage.visibleHabitIds.length > 0 && manage.visibleHabitIds.every(id => manage.selectedHabitIds.has(id));
    if (allSelected) manage.selectedHabitIds.clear();
    else manage.visibleHabitIds.forEach(id => manage.selectedHabitIds.add(id));
    renderManageSection();
}

function archiveHabitsByIds(ids) {
    animateOut(ids, () => archiveHabitsByIdsNow(ids));
}

function archiveHabitsByIdsNow(ids) {
    const snapshot = createUndoSnapshot();
    const count = Store.archiveHabits(ids, getDateKeyDaysAgo(0), getDateKeyDaysAgo(-1));
    if (!count) return;
    manage.selectMode = false;
    manage.selectedHabitIds.clear();
    showToast(`${habitCountLabel(count)} הועברו לארכיון`, snapshot);
    renderAll();
}

export function bulkArchiveSelectedHabits() {
    if (manage.selectedHabitIds.size === 0) return;
    archiveHabitsByIds([...manage.selectedHabitIds]);
}

export function bulkDeleteSelectedHabits() {
    const ids = [...manage.selectedHabitIds];
    if (ids.length === 0) return;
    const label = habitCountLabel(ids.length);
    openConfirmModal(
        `מחיקת ${label}?`,
        `${ids.length === 1 ? 'ההרגל שנבחר וכל ההיסטוריה שלו יימחקו' : `${label} וכל ההיסטוריה שלהם יימחקו`} גם מהימים הקודמים. אם רק הפסקתם לעקוב, עדיף להעביר לארכיון: ההיסטוריה נשמרת ואפשר לשחזר.`,
        () =>
            animateOut(ids, () => {
                const snapshot = createUndoSnapshot();
                manage.selectMode = false;
                manage.selectedHabitIds.clear();
                Store.deleteHabits(ids);
                showToast(`${label} נמחקו`, snapshot);
                renderAll();
            }),
        {
            confirmLabel: 'מחיקה לצמיתות',
            altLabel: 'העברה לארכיון במקום',
            onAlt: () => archiveHabitsByIds(ids)
        }
    );
}

export function moveHabitsToCategory(ids, targetCat) {
    const newCat = targetCat === UNCATEGORIZED_LABEL ? '' : targetCat;
    const toMove = Store.habits.filter(h => ids.includes(h.id) && (h.category || '').trim() !== newCat);
    if (toMove.length === 0) return;
    const apply = () => {
        const snapshot = createUndoSnapshot();
        Store.moveHabits(
            toMove.map(h => h.id),
            newCat
        );
        const what = toMove.length === 1 ? `"${toMove[0].name}" הועבר` : `${toMove.length} הרגלים הועברו`;
        showToast(`${what} ל"${targetCat}"`, snapshot);
        flashHabits(toMove.map(h => h.id));
        renderAll();
    };
    // If the current filter will hide them, let them leave; otherwise they stay and glow
    const staysVisible = manage.selectedCategory === 'הכל' || manage.selectedCategory === targetCat;
    if (staysVisible) withFlip(apply);
    else
        animateOut(
            toMove.map(h => h.id),
            apply
        );
}

export function promptDeleteHabitById(id) {
    const habit = Store.habits.find(h => h.id === id);
    if (!habit) return;

    const archived = isHabitArchived(habit);
    openConfirmModal(
        archived ? 'מחיקה לצמיתות?' : 'מחיקת הרגל?',
        archived
            ? `"${habit.name}" וכל ההיסטוריה שלו יימחקו, והימים הקודמים יחושבו כאילו ההרגל לא היה קיים.`
            : `"${habit.name}" וכל ההיסטוריה שלו יימחקו גם מהימים הקודמים. אם רק הפסקתם לעקוב אחריו, עדיף להעביר לארכיון: ההיסטוריה נשמרת ואפשר לשחזר.`,
        () => {
            closeHabitModal();
            animateOut([id], () => {
                const snapshot = createUndoSnapshot();
                Store.deleteHabits([id]);
                showToast(`ההרגל "${habit.name}" נמחק`, snapshot);
                renderAll();
            });
        },
        archived
            ? {}
            : {
                  confirmLabel: 'מחיקה לצמיתות',
                  altLabel: 'העברה לארכיון במקום',
                  onAlt: () => {
                      closeHabitModal();
                      archiveHabitById(id);
                  }
              }
    );
}

// Archive: the habit stops appearing from today on (from tomorrow if it was already
// checked today), while all of its past history keeps counting.
export function archiveHabitById(id) {
    const habit = Store.habits.find(h => h.id === id);
    if (!habit || isHabitArchived(habit)) return;
    animateOut([id], () => {
        const snapshot = createUndoSnapshot();
        Store.archiveHabits([id], getDateKeyDaysAgo(0), getDateKeyDaysAgo(-1));
        showToast(`"${habit.name}" הועבר לארכיון`, snapshot);
        renderAll();
    });
}

// Restore: the habit comes back from today on. The archived gap is remembered as a pause,
// so those days are not counted as missed.
export function restoreHabitById(id) {
    const habit = Store.habits.find(h => h.id === id);
    if (!habit || !isHabitArchived(habit)) return;
    animateOut([id], () => {
        const snapshot = createUndoSnapshot();
        Store.restoreHabit(id, getDateKeyDaysAgo(1));
        showToast(`"${habit.name}" שוחזר מהארכיון`, snapshot);
        flashHabits([id]);
        renderAll();
    });
}

export function toggleArchiveSection() {
    manage.archiveExpanded = !manage.archiveExpanded;
    if (
        !setRevealOpen(
            document.getElementById('archiveReveal'),
            document.getElementById('archiveToggle'),
            manage.archiveExpanded,
            'הסתר',
            'הצג'
        )
    ) {
        renderArchiveSection();
    }
}

/** Replaces the habits and categories with the sample data, and shows today. */
export function loadSampleData(message = 'נתוני הדוגמה שוחזרו') {
    setWeek(0);
    tracker.selectedCategory = 'הכל';
    manage.selectedCategory = 'הכל';
    tracker.selectedDateKey = getDateKeyDaysAgo(0);
    Store.resetToDefaults(getDefaultHabits);
    showToast(message);
    renderAll();
}

export function openResetModal() {
    openConfirmModal(
        'איפוס הרגלים לדוגמה?',
        'האם לשחזר את רשימת ההרגלים והקטגוריות לדוגמה ואת נתוני השבוע הנוכחי?',
        () => loadSampleData()
    );
}
