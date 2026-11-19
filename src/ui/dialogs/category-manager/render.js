// The category manager dialog: its list and its selection toolbar.

import { UNCATEGORIZED_LABEL } from '../../../config/categories.js';
import { categoryManager } from '../../../state/categories.js';
import { Store } from '../../../store/store.js';
import { escapeHtml } from '../../dom/html.js';
import { patchHTML } from '../../dom/patch.js';

function buildCategoryItemRowHtml(cat) {
    const count = Store.habits.filter(h => h.category === cat).length;
    const isEditing = categoryManager.editingName === cat;

    if (categoryManager.selectMode) {
        const sel = categoryManager.selected.has(cat);
        return `
            <button type="button" data-cat-select="${escapeHtml(cat)}" data-action="toggleCategorySelected" aria-pressed="${sel}" class="w-full text-right p-3 rounded-xl border flex items-center gap-3 transition ${
                sel
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400 dark:border-indigo-700'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-800'
            }">
                <span class="shrink-0 w-5 h-5 rounded-lg border-2 flex items-center justify-center ${sel ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}" aria-hidden="true">${sel ? '<svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}</span>
                <span class="flex-1 min-w-0 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(cat)}</span>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">${count} הרגלים</span>
            </button>
        `;
    }

    if (isEditing) {
        return `
            <div class="p-2.5 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-700 flex items-center gap-2">
                <input id="activeCategoryRenameInput" type="text" maxlength="25" value="${escapeHtml(cat)}" data-keydown="categoryRename" data-cat="${escapeHtml(cat)}" class="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 text-base sm:text-xs font-bold focus:outline-none">
                <button type="button" data-action="saveCategoryRename" data-cat="${escapeHtml(cat)}" class="tap-44 h-10 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">שמור</button>
                <button type="button" data-action="cancelCategoryRename" class="tap-44 h-10 px-3 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold">ביטול</button>
            </div>
        `;
    }

    return `
        <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
                <span class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(cat)}</span>
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">${count} הרגלים</span>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" data-action="startCategoryRename" data-cat="${escapeHtml(cat)}" data-tip="עריכת שם הקטגוריה" aria-label="עריכת הקטגוריה ${escapeHtml(cat)}" class="tap-44 w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg></button>
                <button type="button" data-action="deleteCategory" data-cat="${escapeHtml(cat)}" data-tip="מחיקת הקטגוריה" aria-label="מחיקת הקטגוריה ${escapeHtml(cat)}" class="tap-44 w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
            </div>
        </div>
    `;
}

export function renderCategoryManagerItems() {
    const listEl = document.getElementById('modalCategoriesList');
    if (!listEl) return;
    categoryManager.selected.forEach(c => {
        if (!Store.categories.includes(c)) categoryManager.selected.delete(c);
    });
    updateCategorySelectUi();
    if (Store.categories.length === 0) {
        patchHTML(
            listEl,
            `<p class="text-xs text-slate-500 dark:text-slate-400 text-center py-6">אין קטגוריות מוגדרות כרגע. כל ההרגלים משויכים ל"${UNCATEGORIZED_LABEL}".</p>`
        );
        return;
    }
    patchHTML(listEl, Store.categories.map(cat => buildCategoryItemRowHtml(cat)).join(''));
}

// --- Categories: multi-select delete (inside the category manager) ---
function updateCategorySelectUi() {
    const toggle = document.getElementById('categorySelectToggleBtn');
    const allBtn = document.getElementById('categorySelectAllBtn');
    const info = document.getElementById('categorySelectInfo');
    const delBtn = document.getElementById('categoryBulkDeleteBtn');
    const toolbar = document.getElementById('categorySelectToolbar');
    if (!toggle) return;
    if (Store.categories.length === 0 && categoryManager.selectMode) categoryManager.selectMode = false;
    toolbar.classList.toggle('hidden', Store.categories.length === 0);
    toggle.textContent = categoryManager.selectMode ? 'ביטול' : 'בחירה';
    allBtn.classList.toggle('hidden', !categoryManager.selectMode);
    const allSelected = Store.categories.length > 0 && Store.categories.every(c => categoryManager.selected.has(c));
    allBtn.textContent = allSelected ? 'ניקוי בחירה' : 'בחירת הכל';
    info.textContent = categoryManager.selectMode
        ? `נבחרו ${categoryManager.selected.size}`
        : `${Store.categories.length} קטגוריות`;
    delBtn.classList.toggle('hidden', !categoryManager.selectMode);
    delBtn.disabled = categoryManager.selected.size === 0;
    delBtn.textContent =
        categoryManager.selected.size > 1 ? `מחיקת ${categoryManager.selected.size} קטגוריות` : 'מחיקת הקטגוריה שנבחרה';
}
