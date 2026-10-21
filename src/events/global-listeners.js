// Listeners on the document and the window, and the app timers.

import { suspendAudio } from '../audio/feedback.js';
import { getDateKeyDaysAgo } from '../core/dates.js';
import { habitOn, hasAnyTime } from '../core/schedule.js';
import { app } from '../state/app.js';
import { manage } from '../state/manage.js';
import { tracker } from '../state/tracker.js';
import { Store } from '../store/store.js';
import { checkDayRollover } from '../ui/app/lifecycle.js';
import { closeCustomSelect, isCustomSelectOpen } from '../ui/components/custom-select.js';
import { getVisibleFocusables, hideModal, topModal } from '../ui/components/modal.js';
import { updateScrollFades } from '../ui/components/scroll-fades.js';
import { renderAnalytics } from '../ui/sections/analytics/analytics.js';
import { positionAvgLine } from '../ui/sections/analytics/bar-chart.js';
import { renderHabitsList } from '../ui/sections/tracker/habits-list.js';
import { MODAL_CLOSERS } from './modal-closers.js';

export function wireModalKeyboard() {
    document.addEventListener('keydown', e => {
        const top = topModal();
        if (!top || manage.drag.active) return;
        if (e.key === 'Escape') {
            if (isCustomSelectOpen() || document.querySelector('[data-menu-panel]:not(.hidden):not(.is-closing)'))
                return; // the open list closes first
            e.preventDefault();
            (MODAL_CLOSERS[top.id] || (() => hideModal(top)))();
        } else if (e.key === 'Tab') {
            const items = getVisibleFocusables(top);
            if (items.length === 0) return;
            const first = items[0],
                last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || !top.contains(document.activeElement))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !top.contains(document.activeElement))) {
                e.preventDefault();
                first.focus();
            }
        }
    });
}

let lineChartResizeTimer = null;

let resizeFrame = 0;

export function wireResize() {
    window.addEventListener('resize', () => {
        if (!resizeFrame) {
            resizeFrame = requestAnimationFrame(() => {
                resizeFrame = 0;
                closeCustomSelect(false);
                updateScrollFades();
                positionAvgLine();
            });
        }
        clearTimeout(lineChartResizeTimer);
        lineChartResizeTimer = setTimeout(() => {
            if (
                app.currentMainSection === 'analytics' &&
                (!document.getElementById('lineChartWrap').classList.contains('hidden') ||
                    !document.getElementById('habitGridWrap').classList.contains('hidden'))
            )
                renderAnalytics();
        }, 150);
    });
}

// Keeps now / next / past current: refresh the daily list once a minute while it is on screen
export function startMinuteRefresh() {
    setInterval(() => {
        if (document.hidden) return;
        if (app.currentMainSection !== 'tracker' || tracker.viewMode !== 'focus') return;
        if (tracker.selectedDateKey !== getDateKeyDaysAgo(0)) return;
        const modal = document.getElementById('habitModalBackdrop');
        if (modal && !modal.classList.contains('hidden')) return;
        if (!Store.habits.some(h => hasAnyTime(habitOn(h, tracker.selectedDateKey)))) return;
        renderHabitsList();
    }, 60000);
}

/** Coming back to the tab (and once a minute) checks whether the day changed; leaving it pauses audio. */
export function wireDayChecks() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkDayRollover();
        } else {
            suspendAudio();
        }
    });
    setInterval(checkDayRollover, 60000);
}
