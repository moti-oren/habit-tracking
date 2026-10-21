// The tour the browser parity tests walk through: every section, the main dialogs and states.
// Each step is [name, async page => { ... }]; steps run in order on a fresh app.
import { pick, press, settle, tap } from './helpers.js';

export const STEPS = [
    ['tracker, today', async () => {}],
    ['a habit checked: day complete, toast', async p => tap(p, '[data-action="toggleDay"][data-id="h5"]')],
    ['weekly table', async p => tap(p, '#viewModeGridBtn')],
    ['daily list again', async p => tap(p, '#viewModeFocusBtn')],
    [
        'a past day: banner and rest-day group open',
        async p => {
            await tap(p, '#daySelectorStrip [data-key="2026-10-19"]');
            await tap(p, '#restGroupToggle');
        }
    ],
    [
        'filtered by a category',
        async p => tap(p, '[data-action="setCategoryFilter"][data-cat="כושר"][data-ctx="tracker"]')
    ],
    ['full calendar, month', async p => tap(p, '[data-action="openCalendar"]')],
    ['full calendar, year', async p => tap(p, '#calendarTitleBtn')],
    [
        'back to the tracker',
        async p => {
            await press(p, 'Escape');
            await tap(p, '#backToTodayBannerBtn');
            await tap(p, '[data-action="setCategoryFilter"][data-cat="הכל"][data-ctx="tracker"]');
        }
    ],
    ['analytics, this week', async p => tap(p, '[data-action="switchSection"][data-arg="analytics"]')],
    ['analytics, last 30 days (line chart)', async p => tap(p, '[data-action="setPreset"][data-arg="30d"]')],
    ['analytics, this month', async p => tap(p, '[data-action="setPreset"][data-arg="month"]')],
    ['analytics, filter list open', async p => tap(p, '#analyticsFilterSelect_trigger')],
    [
        'analytics, one flexible habit over 30 days (grid)',
        async p => {
            await pick(p, 'habit:h2');
            await tap(p, '[data-action="setPreset"][data-arg="30d"]');
        }
    ],
    ['analytics, one habit this week (bars)', async p => tap(p, '[data-action="setPreset"][data-arg="week"]')],
    [
        'analytics, custom range',
        async p => {
            await tap(p, '#analyticsFilterSelect_trigger');
            await pick(p, 'all');
            await tap(p, '[data-action="setPreset"][data-arg="custom"]');
        }
    ],
    ['manage', async p => tap(p, '[data-action="switchSection"][data-arg="manage"]')],
    [
        'manage, two habits selected',
        async p => {
            await tap(p, '#manageSelectToggleBtn');
            await tap(p, '[data-action="manageCard"][data-id="h1"]');
            await tap(p, '[data-action="manageCard"][data-id="h3"]');
        }
    ],
    [
        'manage, archive open',
        async p => {
            await tap(p, '#manageBulkArchiveBtn');
            // on a phone the undo toast appears under the pointer (which pauses it) and covers the
            // archive toggle: move away and let it run out, as a user would
            await p.mouse.move(1, 1);
            await settle(p, 5500);
            await tap(p, '#archiveToggle');
        }
    ],
    [
        'new habit form, every section open',
        async p => {
            await tap(p, '#section_manage [data-action="newHabit"][aria-label]');
            await p.locator('#habitNameInput').fill('מדיטציה');
            await settle(p);
            await tap(p, '#habitAppearanceBtn');
            await tap(p, '[data-action="toggleCustomIcons"]');
            await tap(p, '#goalTypeBtn_fixed_days');
            await tap(p, '#habitTimeToggle');
            await tap(p, '#habitTimesPerDay_trigger');
            await pick(p, '2');
            await tap(p, '#habitPerDayToggleWrap'); // the visible switch (a <label> for the hidden checkbox)
            await tap(p, '#habitDetailsToggle');
        }
    ],
    [
        'editing a habit: which days the change applies to',
        async p => {
            await press(p, 'Escape');
            await tap(p, '[data-action="manageCard"][data-id="h5"]');
            await tap(p, '#goalTypeBtn_daily');
        }
    ],
    [
        'category manager, renaming',
        async p => {
            await press(p, 'Escape');
            await tap(p, '[data-action="openCategories"]');
            await tap(p, '[data-action="startCategoryRename"][data-cat="כושר"]');
        }
    ],
    [
        'confirm dialog',
        async p => {
            await press(p, 'Escape');
            await tap(p, '[data-action="toggleMenu"][data-arg="manageHeaderMenu"]');
            await tap(p, '[data-action="resetData"]');
        }
    ]
];
