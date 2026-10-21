// The habit form's category list.

import { UNCATEGORIZED_LABEL } from '../../../config/categories.js';
import { Store } from '../../../store/store.js';
import { escapeHtml } from '../../dom/html.js';

export function populateCategorySelectDropdown(selectedValue = null) {
    const selectEl = document.getElementById('habitCategoryInput');
    if (!selectEl) return;
    const currentVal = selectedValue !== null ? selectedValue : (selectEl.value ?? '');
    const optionsHtml = [
        `<option value="">${UNCATEGORIZED_LABEL}</option>`,
        ...Store.categories.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
    ].join('');
    selectEl.innerHTML = optionsHtml;
    if (currentVal && Store.categories.includes(currentVal)) {
        selectEl.value = currentVal;
    } else {
        selectEl.value = '';
    }
}
