import { app } from '../../state/app.js';
import { motion } from '../../state/motion.js';
import { renderAnalytics } from '../sections/analytics/analytics.js';
import { renderLeaderboard } from '../sections/analytics/leaderboard.js';
import { renderCategoryFilterBar } from '../sections/category-filter-bar.js';
import { renderManageSection } from '../sections/manage/manage-grid.js';
import { renderHeaderDateStrip } from '../sections/tracker/date-strip.js';
import { renderHabitsList } from '../sections/tracker/habits-list.js';
import { renderTrackerSummary } from '../sections/tracker/summary.js';
import { renderGreeting } from '../shell/greeting.js';

// ===== Rendering by section =====
// A change makes every section stale, but only the visible one is rebuilt now; a hidden
// section is rebuilt when it is opened. (Before, every change rebuilt all three sections,
// including both charts, even when only the tracker was on screen.)
const staleSections = new Set(['tracker', 'analytics', 'manage']);

const SECTION_RENDERERS = {
    tracker: () => {
        renderHeaderDateStrip();
        renderTrackerSummary();
        renderCategoryFilterBar('tracker');
        renderHabitsList();
    },
    analytics: () => {
        renderAnalytics();
        renderLeaderboard();
    },
    manage: () => {
        renderCategoryFilterBar('manage');
        renderManageSection();
    }
};

export function renderSection(section, { force = false, entry = false } = {}) {
    if (!force && !staleSections.has(section)) return;
    staleSections.delete(section);
    motion.renderingEntry = entry;
    try {
        SECTION_RENDERERS[section]();
    } finally {
        motion.renderingEntry = false;
    }
}

// After the first paint, the two hidden sections are drawn once in idle time, so a section is
// never empty when it's revealed (an empty one would shrink the page and reset the scroll).
export function prerenderHiddenSections() {
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 200));
    idle(() =>
        Object.keys(SECTION_RENDERERS).forEach(sec => {
            if (sec !== app.currentMainSection) renderSection(sec);
        })
    );
}

export function renderAll() {
    renderGreeting();
    Object.keys(SECTION_RENDERERS).forEach(sec => staleSections.add(sec));
    renderSection(app.currentMainSection);
}
