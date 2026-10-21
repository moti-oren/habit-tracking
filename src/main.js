// Entry point. Wires the app in exactly the order the original single-file script did.
//
// The order matters: listeners on the same target run in the order they were added. For example
// the dialog's Escape handler (wireModalKeyboard) must run before the menus' Escape handler
// (wireMenus), so that one Escape closes an open menu without also closing the dialog under it.
// No other module does anything when it is imported: every side effect is one of these calls.

import { wireDelegatedEvents } from './events/delegation.js';
import { startMinuteRefresh, wireDayChecks, wireModalKeyboard, wireResize } from './events/global-listeners.js';
import { app } from './state/app.js';
import { enhanceFormControls } from './ui/app/form-controls.js';
import { hideSkeleton, loadState } from './ui/app/lifecycle.js';
import { switchMainSection } from './ui/app/navigation.js';
import { prerenderHiddenSections } from './ui/app/render.js';
import { wireCustomSelectDismiss } from './ui/components/custom-select.js';
import { wireMenus } from './ui/components/menus.js';
import { wireScrollFadeListeners } from './ui/components/scroll-fades.js';
import { initSegPills } from './ui/components/segmented.js';
import { wireToastPause } from './ui/components/toast.js';
import { initTooltips } from './ui/components/tooltip.js';
import { wireRangePreview } from './ui/dialogs/calendar/calendar.js';
import { wireHabitDrag } from './ui/sections/manage/drag-drop.js';
import { initDeviceTheme, wireSystemTheme } from './ui/shell/theme.js';

initDeviceTheme();
initSegPills();
wireModalKeyboard();
wireRangePreview();
wireResize();
initTooltips();
wireMenus();
wireHabitDrag();
wireToastPause();
wireSystemTheme();
wireCustomSelectDismiss();
wireDelegatedEvents();
startMinuteRefresh();

// Everything else waits for the document (this module runs before DOMContentLoaded, like the
// original script at the end of <body>).
window.addEventListener('DOMContentLoaded', () => {
    enhanceFormControls();
    loadState();
    switchMainSection(app.currentMainSection);
    prerenderHiddenSections();

    wireScrollFadeListeners();
    wireDayChecks();
    hideSkeleton();
});
