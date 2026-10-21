// Undo from the toast: restores the data and the category filters saved before the action.

import { manage } from '../../state/manage.js';
import { tracker } from '../../state/tracker.js';
import { undo } from '../../state/undo.js';
import { Store } from '../../store/store.js';
import { showToast } from '../components/toast.js';
import { renderCategoryManagerItems } from '../dialogs/category-manager/render.js';
import { populateCategorySelectDropdown } from '../dialogs/habit-form/category-select.js';
import { withFlip } from '../dom/flip.js';
import { renderAll } from './render.js';

export function triggerToastUndo() {
    if (!undo.snapshot) return;
    const snap = undo.snapshot;
    undo.snapshot = null;
    tracker.selectedCategory = snap.trackerSelectedCategory || 'הכל';
    manage.selectedCategory = snap.manageSelectedCategory || 'הכל';
    Store.restore(snap.data);
    populateCategorySelectDropdown();
    withFlip(() => renderAll());
    renderCategoryManagerItems();
    showToast('הפעולה בוטלה והמצב הקודם שוחזר');
}
