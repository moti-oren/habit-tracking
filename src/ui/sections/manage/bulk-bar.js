// The floating bar of selection mode (count, select all, archive, delete).

import { manage } from '../../../state/manage.js';

export function updateManageBulkBar() {
    const bar = document.getElementById('manageBulkBar');
    const toggle = document.getElementById('manageSelectToggleBtn');
    if (toggle) {
        toggle.textContent = manage.selectMode ? 'סיום' : 'בחירה';
        toggle.setAttribute('aria-pressed', String(manage.selectMode));
    }
    if (!bar) return;
    bar.classList.toggle('hidden', !manage.selectMode);
    const section = document.getElementById('section_manage');
    if (section) section.classList.toggle('pb-24', manage.selectMode);
    const n = manage.selectedHabitIds.size;
    document.getElementById('manageBulkCount').textContent = n === 0 ? 'בחרו הרגלים' : `נבחרו ${n}`;
    const allSelected =
        manage.visibleHabitIds.length > 0 && manage.visibleHabitIds.every(id => manage.selectedHabitIds.has(id));
    document.getElementById('manageBulkSelectAllBtn').textContent = allSelected ? 'ניקוי בחירה' : 'בחירת הכל';
    document.getElementById('manageBulkArchiveBtn').disabled = n === 0;
    document.getElementById('manageBulkDeleteBtn').disabled = n === 0;
}
