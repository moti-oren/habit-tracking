// The last undoable action, offered by the toast: the data and category filters before it.

import { Store } from '../store/store.js';
import { manage } from './manage.js';
import { tracker } from './tracker.js';

export const undo = Object.seal({
    /** { data: Store.snapshot(), trackerSelectedCategory, manageSelectedCategory } or null */
    snapshot: null
});

export function createUndoSnapshot() {
    return {
        data: Store.snapshot(),
        trackerSelectedCategory: tracker.selectedCategory,
        manageSelectedCategory: manage.selectedCategory
    };
}
