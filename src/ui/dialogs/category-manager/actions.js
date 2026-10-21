// The category manager dialog: add, rename, delete (one or several), open and close.

import { UNCATEGORIZED_LABEL } from '../../../config/categories.js';
import { categoryManager } from '../../../state/categories.js';
import { manage } from '../../../state/manage.js';
import { tracker } from '../../../state/tracker.js';
import { createUndoSnapshot } from '../../../state/undo.js';
import { Store } from '../../../store/store.js';
import { renderAll } from '../../app/render.js';
import { hideModal, showModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { shakeField } from '../../dom/animate.js';
import { renderManageSection } from '../../sections/manage/manage-grid.js';
import { openConfirmModal } from '../confirm.js';
import { populateCategorySelectDropdown } from '../habit-form/category-select.js';
import { renderCategoryManagerItems } from './render.js';

function addCategory(rawName) {
    const name = String(rawName || '').trim();
    if (!name) return false;
    if (name === 'הכל' || name === UNCATEGORIZED_LABEL) {
        showToast(`השם "${name}" שמור למערכת`);
        return false;
    }
    if (Store.categories.includes(name)) {
        showToast('קטגוריה בשם זה כבר קיימת');
        return false;
    }
    Store.addCategory(name);
    populateCategorySelectDropdown(name);
    renderAll();
    renderCategoryManagerItems();
    showToast(`הקטגוריה "${name}" נוספה בהצלחה!`);
    return true;
}

export function handleModalAddCategory(event) {
    event.preventDefault();
    const input = document.getElementById('modalNewCategoryInput');
    if (!input) return;
    if (addCategory(input.value)) {
        input.value = '';
    } else {
        shakeField(input, !!input.value.trim());
    }
}

export function startCategoryRename(catName) {
    categoryManager.editingName = catName;
    renderManageSection();
    renderCategoryManagerItems();
    setTimeout(() => {
        const input = document.getElementById('activeCategoryRenameInput');
        if (input) {
            input.focus();
            input.select();
        }
    }, 30);
}

export function cancelCategoryRename() {
    categoryManager.editingName = null;
    renderManageSection();
    renderCategoryManagerItems();
}

export function saveCategoryRename(oldName) {
    const input = document.getElementById('activeCategoryRenameInput');
    if (!input) return;
    const newName = input.value.trim();
    if (!newName || newName === oldName) {
        cancelCategoryRename();
        return;
    }
    if (newName === 'הכל' || newName === UNCATEGORIZED_LABEL) {
        showToast(`השם "${newName}" שמור למערכת`);
        shakeField(input);
        return;
    }
    if (Store.categories.includes(newName)) {
        showToast('קטגוריה בשם זה כבר קיימת');
        shakeField(input);
        return;
    }

    if (tracker.selectedCategory === oldName) {
        tracker.selectedCategory = newName;
    }
    if (manage.selectedCategory === oldName) {
        manage.selectedCategory = newName;
    }
    categoryManager.editingName = null;
    Store.renameCategory(oldName, newName);
    populateCategorySelectDropdown(newName);
    renderAll();
    renderCategoryManagerItems();
    showToast(`שם הקטגוריה עודכן ל-"${newName}"`);
}

export function promptDeleteCategory(catName) {
    const affectedHabits = Store.habits.filter(h => (h.category || '').trim() === catName);

    const msg =
        affectedHabits.length > 0
            ? `לקטגוריה "${catName}" משויכים ${affectedHabits.length} הרגלים. מחיקתה תגדיר אותם כחסרי קטגוריה ("${UNCATEGORIZED_LABEL}"). האם להמשיך?`
            : `האם למחוק את הקטגוריה "${catName}" מהמערכת?`;

    openConfirmModal('מחיקת קטגוריה?', msg, () => {
        const snapshot = createUndoSnapshot();
        if (tracker.selectedCategory === catName) {
            tracker.selectedCategory = 'הכל';
        }
        if (manage.selectedCategory === catName) {
            manage.selectedCategory = 'הכל';
        }
        categoryManager.editingName = null;
        Store.deleteCategories([catName]);
        populateCategorySelectDropdown();
        renderAll();
        renderCategoryManagerItems();
        showToast(`הקטגוריה "${catName}" נמחקה`, snapshot);
    });
}

export function openCategoryManagerModal() {
    categoryManager.editingName = null;
    categoryManager.selectMode = false;
    categoryManager.selected.clear();
    renderCategoryManagerItems();
    showModal(document.getElementById('categoryModalBackdrop'));
}

export function closeCategoryManagerModal() {
    categoryManager.editingName = null;
    categoryManager.selectMode = false;
    categoryManager.selected.clear();
    hideModal(document.getElementById('categoryModalBackdrop'));
    renderAll();
}

export function toggleCategorySelectMode() {
    categoryManager.selectMode = !categoryManager.selectMode;
    categoryManager.selected.clear();
    categoryManager.editingName = null;
    renderCategoryManagerItems();
}

export function toggleCategorySelected(cat) {
    if (categoryManager.selected.has(cat)) categoryManager.selected.delete(cat);
    else categoryManager.selected.add(cat);
    renderCategoryManagerItems();
}

export function toggleSelectAllCategories() {
    const allSelected = Store.categories.every(c => categoryManager.selected.has(c));
    if (allSelected) categoryManager.selected.clear();
    else Store.categories.forEach(c => categoryManager.selected.add(c));
    renderCategoryManagerItems();
}

export function bulkDeleteSelectedCategories() {
    const cats = [...categoryManager.selected];
    if (cats.length === 0) return;
    const affected = Store.habits.filter(h => cats.includes((h.category || '').trim())).length;
    const what = cats.length === 1 ? `הקטגוריה "${cats[0]}"` : `${cats.length} קטגוריות`;
    const msg =
        affected > 0
            ? `${affected === 1 ? 'הרגל אחד משויך' : `${affected} הרגלים משויכים`} לקטגוריות שנבחרו. אחרי המחיקה ${affected === 1 ? 'הוא יוגדר' : 'הם יוגדרו'} כ"${UNCATEGORIZED_LABEL}".`
            : 'אין הרגלים שמשויכים לקטגוריות שנבחרו.';
    openConfirmModal(
        `מחיקת ${what}?`,
        msg,
        () => {
            const snapshot = createUndoSnapshot();
            if (cats.includes(tracker.selectedCategory)) tracker.selectedCategory = 'הכל';
            if (cats.includes(manage.selectedCategory)) manage.selectedCategory = 'הכל';
            categoryManager.selected.clear();
            categoryManager.selectMode = false;
            Store.deleteCategories(cats);
            populateCategorySelectDropdown();
            renderAll();
            renderCategoryManagerItems();
            showToast(`${cats.length === 1 ? 'הקטגוריה נמחקה' : `${cats.length} קטגוריות נמחקו`}`, snapshot);
        },
        { confirmLabel: 'מחיקה' }
    );
}
