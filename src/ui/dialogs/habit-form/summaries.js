// The hint under the time fields and the one-line summaries of the collapsed rows.

import { UNCATEGORIZED_LABEL } from '../../../config/categories.js';
import { formatDaySet, scheduleTimeSummary } from '../../../core/format.js';
import { hasAnyTime, slotCount } from '../../../core/schedule.js';
import { dayPartOf, timeRangeText } from '../../../core/time.js';
import { findTimeOverlaps } from '../../../store/selectors.js';
import { getModalScheduleDef } from './time-model.js';

export function updateHabitTimeHint() {
    const hint = document.getElementById('habitTimeHint');
    if (!hint) return;
    const def = getModalScheduleDef();
    hint.classList.remove('text-amber-700', 'dark:text-amber-400', 'font-semibold');
    if (!hasAnyTime(def)) {
        hint.textContent =
            slotCount(def) > 1
                ? `${slotCount(def)} פעמים ביום, בלי שעות. כל פעם תופיע ככרטיס נפרד.`
                : 'בלי שעה, ההרגל יופיע בכל שעה של היום.';
        return;
    }
    const overlaps = findTimeOverlaps(def, document.getElementById('habitIdInput')?.value || '');
    if (overlaps.length) {
        hint.classList.add('text-amber-700', 'dark:text-amber-400', 'font-semibold');
        hint.textContent =
            'חופף ל: ' +
            overlaps
                .map(
                    ({ h, days, time }) =>
                        `${h.icon} ${h.name} (${timeRangeText(time, h.duration)}${days.length < 7 ? `, ${formatDaySet(days)}` : ''})`
                )
                .join(' · ');
        return;
    }
    hint.textContent =
        def.dayTimes || def.slotTimes
            ? `יופיע במסך המעקב: ${scheduleTimeSummary(def)}`
            : `יופיע במסך המעקב ${dayPartOf(def.time).inLabel}, ${timeRangeText(def.time, def.duration)}`;
}

// One-line summaries on the collapsed rows, so nothing important is hidden
export function updateHabitModalSummaries() {
    const timeEl = document.getElementById('habitTimeSummary');
    if (timeEl) {
        const def = getModalScheduleDef();
        const n = slotCount(def);
        let text,
            warn = false;
        if (hasAnyTime(def)) {
            text = def.dayTimes || def.slotTimes ? scheduleTimeSummary(def) : timeRangeText(def.time, def.duration);
            if (findTimeOverlaps(def, document.getElementById('habitIdInput')?.value || '').length) {
                text = `חופף להרגל אחר · ${text}`;
                warn = true;
            }
        } else {
            text = n > 1 ? `${n} פעמים ביום, בלי שעה` : 'בלי שעה';
        }
        timeEl.textContent = text;
        timeEl.classList.toggle('text-amber-700', warn);
        timeEl.classList.toggle('dark:text-amber-400', warn);
        timeEl.classList.toggle('font-semibold', warn);
        timeEl.classList.toggle('text-slate-500', !warn);
        timeEl.classList.toggle('dark:text-slate-400', !warn);
    }
    const detailsEl = document.getElementById('habitDetailsSummary');
    if (detailsEl) {
        const sel = document.getElementById('habitCategoryInput');
        const cat =
            sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : UNCATEGORIZED_LABEL;
        const note = (document.getElementById('habitNoteInput')?.value || '').trim();
        detailsEl.textContent = `${cat} · ${note || 'בלי הערה'}`;
    }
}
