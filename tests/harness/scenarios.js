// User scenarios for the DOM parity test (tests/parity/dom.parity.test.js).
//
// Every step runs on both apps (original and refactored) and is followed by `settle` ms of timers.
// `check` asserts on the ORIGINAL that the step really did what its name says, so a step can never
// pass by doing nothing in both apps.
import { createApp } from './app-window.js';

export const NOW = new Date(2026, 9, 21, 10, 0, 0); // Wednesday 21 Oct 2026, 10:00
const KEY = {
    habits: 'habit_tracker_he_v2',
    categories: 'habit_tracker_categories_he_v2',
    prefs: 'habit_tracker_prefs_he_v2',
    old: 'pulse_habit_tracker_he_v2'
};

const stored = (app, key = KEY.habits) => JSON.parse(app.window.localStorage.getItem(key));
const habit = (app, id) => stored(app).find(h => h.id === id);
const text = (app, selector) => app.$(selector).textContent.trim();
const visible = (app, selector) => !app.$(selector).classList.contains('hidden');
const toast = app => text(app, '#toastMessage');
const step = (name, run, check, settle) => ({ name, run, check, settle });
const s = (name, run, check, settle) => step(name, run, check, settle);

// ---------------------------------------------------------------------------------------------
// 1. A tour of every screen, dialog and interaction, starting from the sample data
// ---------------------------------------------------------------------------------------------
const tour = [
    // --- tracker: daily list
    s(
        'check off the last open habit of today (the day is complete)',
        a => a.click('[data-action="toggleDay"][data-id="h5"][data-key="2026-10-21"]'),
        (a, expect) => expect(toast(a)).toBe('כל היעדים להיום הושלמו. כל הכבוד!')
    ),
    s(
        'uncheck it',
        a => a.click('[data-action="toggleDay"][data-id="h5"][data-key="2026-10-21"]'),
        (a, expect) => expect(habit(a, 'h5').history['2026-10-21']).toBe(false)
    ),
    s(
        'tap a card body to check it',
        a => a.click('[data-action="toggleCardBody"][data-id="h2"]'),
        (a, expect) => expect(habit(a, 'h2').history['2026-10-21']).toBe(true)
    ),
    s(
        'open the overflow menu',
        a => a.click('[data-action="toggleMenu"][data-arg="trackerActionsMenu"]'),
        (a, expect) => expect(visible(a, '#trackerActionsMenu')).toBe(true)
    ),
    s(
        'mark everything for today',
        a => a.click('#markAllBtn'),
        (a, expect) => {
            expect(toast(a)).toBe('כל ההרגלים המתוכננים להיום סומנו!');
            expect(visible(a, '#toastUndoBtn')).toBe(true);
        }
    ),
    s(
        'undo from the toast',
        a => a.click('#toastUndoBtn'),
        (a, expect) => {
            expect(toast(a)).toBe('הפעולה בוטלה והמצב הקודם שוחזר');
            expect(habit(a, 'h5').history['2026-10-21']).toBe(false);
        }
    ),
    s(
        "clear today's marks",
        a => {
            a.click('[data-action="toggleMenu"][data-arg="trackerActionsMenu"]');
            a.click('#clearAllBtn');
        },
        (a, expect) => expect(habit(a, 'h1').history['2026-10-21']).toBe(false)
    ),
    s(
        'let the undo toast run out',
        () => {},
        (a, expect) => expect(a.$('#toastContainer').classList.contains('opacity-0')).toBe(true),
        5600
    ),
    s(
        'pick Monday in the day strip',
        a => a.click('#daySelectorStrip [data-action="selectDay"][data-key="2026-10-19"]'),
        (a, expect) => expect(a.$('#selectedDayBannerWrap').classList.contains('is-open')).toBe(true)
    ),
    s(
        'check a habit on a past day',
        a => a.click('[data-action="toggleDay"][data-id="h5"][data-key="2026-10-19"]'),
        (a, expect) => expect(habit(a, 'h5').history['2026-10-19']).toBe(true)
    ),
    s(
        'expand the rest-day group',
        a => a.click('#restGroupToggle'),
        (a, expect) => expect(a.$('#restGroupReveal').classList.contains('is-open')).toBe(true)
    ),
    s(
        'collapse it again',
        a => a.click('#restGroupToggle'),
        (a, expect) => expect(a.$('#restGroupReveal').hasAttribute('inert')).toBe(true)
    ),
    s(
        'back to today from the banner',
        a => a.click('#backToTodayBannerBtn'),
        (a, expect) => expect(toast(a)).toBe('חזרתם לשבוע הנוכחי (היום)')
    ),
    s(
        'previous week',
        a => a.click('[data-action="shiftWeek"][data-arg="-1"]'),
        (a, expect) => expect(text(a, '#weekRangeLabel').startsWith('השבוע')).toBe(false)
    ),
    s(
        'next week',
        a => a.click('#nextWeekBtn'),
        (a, expect) => expect(text(a, '#weekRangeLabel').startsWith('השבוע')).toBe(true)
    ),
    // --- tracker: weekly table
    s(
        'switch to the weekly table',
        a => a.click('#viewModeGridBtn'),
        (a, expect) => expect(a.has('#habitsListContainer table')).toBe(true)
    ),
    s(
        'toggle a table cell',
        a => a.click('table [data-action="toggleDay"][data-id="h4"][data-key="2026-10-18"]'),
        (a, expect) => expect(habit(a, 'h4').history['2026-10-18']).toBe(true)
    ),
    s(
        'pick a day from the table header',
        a => a.click('thead [data-action="selectDay"][data-key="2026-10-20"]'),
        (a, expect) => expect(a.$('thead [data-key="2026-10-20"]').getAttribute('aria-pressed')).toBe('true')
    ),
    s(
        'toggle a cell on the phone card',
        a => a.click('[class~="md:hidden"] [data-action="toggleDay"][data-id="h1"][data-key="2026-10-20"]'),
        (a, expect) => expect(habit(a, 'h1').history['2026-10-20']).toBe(false)
    ),
    s(
        'back to the daily list',
        a => a.click('#viewModeFocusBtn'),
        (a, expect) => expect(a.has('#habitsListContainer table')).toBe(false)
    ),
    // --- tracker: filters
    s(
        'filter the list by a category',
        a => a.click('[data-action="setCategoryFilter"][data-cat="כושר"][data-ctx="tracker"]'),
        (a, expect) => expect(visible(a, '#trackerActiveFilterIndicator')).toBe(true)
    ),
    s(
        'show all again from the filter line',
        a => a.click('#trackerActiveFilterIndicator [data-action="setCategoryFilter"]'),
        (a, expect) => expect(visible(a, '#trackerActiveFilterIndicator')).toBe(false)
    ),
    // --- full calendar
    s(
        'open the full calendar',
        a => a.click('[data-action="openCalendar"]'),
        (a, expect) => expect(a.$('#fullCalendarModalBackdrop').classList.contains('flex')).toBe(true)
    ),
    s(
        'previous month',
        a => a.click('#calendarPrevBtn'),
        (a, expect) => {
            expect(text(a, '#calendarMonthYearTitle')).toBe('ספטמבר 2026');
        }
    ),
    s(
        'year view',
        a => a.click('#calendarTitleBtn'),
        (a, expect) => expect(visible(a, '#fullCalendarYearGrid')).toBe(true)
    ),
    s(
        'previous year and back',
        a => {
            a.click('#calendarPrevBtn');
            a.click('#calendarNextMonthBtn');
        },
        (a, expect) => expect(text(a, '#calendarMonthYearTitle')).toBe('2026')
    ),
    s(
        'open August from the year',
        a => a.click('[data-action="openMonthFromYear"][data-arg="7"]'),
        (a, expect) => expect(text(a, '#calendarMonthYearTitle')).toBe('אוגוסט 2026')
    ),
    s(
        'next month',
        a => a.click('#calendarNextMonthBtn'),
        (a, expect) => expect(text(a, '#calendarMonthYearTitle')).toBe('ספטמבר 2026')
    ),
    s(
        'pick a day in the calendar',
        a => a.click('#fullCalendarGrid [data-cal-key="2026-09-15"]'),
        (a, expect) => expect(text(a, '#weekRangeLabel')).toContain('ספטמבר')
    ),
    s(
        'reopen, jump to this month, close with Escape',
        a => {
            a.click('[data-action="openCalendar"]');
            a.click('[data-action="calendarToday"]');
            a.key(null, 'Escape');
        },
        (a, expect) => expect(a.$('#fullCalendarModalBackdrop').classList.contains('hidden')).toBe(true)
    ),
    s(
        'go back to today',
        a => a.click('#backToTodayBannerBtn'),
        (a, expect) => expect(text(a, '#weekRangeLabel').startsWith('השבוע')).toBe(true)
    ),
    // --- analytics
    s(
        'open analytics',
        a => a.click('#navTab_analytics'),
        (a, expect) => expect(visible(a, '#section_analytics')).toBe(true)
    ),
    s(
        'last 7 days',
        a => a.click('[data-action="setPreset"][data-arg="7d"]'),
        (a, expect) => expect(text(a, '#analyticsRangeLabel')).toBe('7 הימים האחרונים')
    ),
    s(
        'last 30 days (line chart)',
        a => a.click('[data-action="setPreset"][data-arg="30d"]'),
        (a, expect) => expect(a.has('#lineChartWrap svg')).toBe(true)
    ),
    s(
        'previous range, then next',
        a => {
            a.click('[data-action="shiftRange"][data-arg="-1"]');
            a.click('#analyticsNextRangeBtn');
        },
        (a, expect) => expect(text(a, '#analyticsRangeLabel')).toBe('30 הימים האחרונים')
    ),
    s(
        'this month',
        a => a.click('[data-action="setPreset"][data-arg="month"]'),
        (a, expect) => expect(text(a, '#analyticsRangeLabel')).toBe('אוקטובר')
    ),
    s(
        'a custom range picked in the calendar',
        a => {
            a.click('[data-action="setPreset"][data-arg="custom"]');
            a.click('#analyticsRangeStart_trigger');
            a.click('#fullCalendarGrid [data-cal-key="2026-10-05"]');
            a.dispatch(
                '#fullCalendarGrid [data-cal-key="2026-10-09"]',
                new a.window.MouseEvent('mouseover', { bubbles: true })
            );
            a.click('#fullCalendarGrid [data-cal-key="2026-10-12"]');
        },
        (a, expect) => expect(a.$('#analyticsRangeEnd').value).toBe('2026-10-12')
    ),
    s(
        'analytics of one habit',
        a => a.choose('analyticsFilterSelect', 'habit:h1'),
        (a, expect) => expect(visible(a, '#analyticsLeaderboardCard')).toBe(false)
    ),
    s(
        'analytics of one category',
        a => a.choose('analyticsFilterSelect', 'cat:כושר'),
        (a, expect) => expect(a.$('#analyticsFilterSelect').value).toBe('cat:כושר')
    ),
    s(
        'one flexible habit over 30 days (calendar grid)',
        a => {
            a.choose('analyticsFilterSelect', 'habit:h2');
            a.click('[data-action="setPreset"][data-arg="30d"]');
        },
        (a, expect) => expect(visible(a, '#habitGridWrap')).toBe(true)
    ),
    s(
        'all habits this week, then jump from a bar to the tracker',
        a => {
            a.choose('analyticsFilterSelect', 'all');
            a.click('[data-action="setPreset"][data-arg="week"]');
            a.click('[data-action="barSelectDay"][data-key="2026-10-19"]');
        },
        (a, expect) => expect(visible(a, '#section_tracker')).toBe(true)
    ),
    s(
        'Enter on a bar jumps too',
        a => {
            a.click('#navTab_analytics');
            a.key('[data-action="barSelectDay"][data-key="2026-10-20"]', 'Enter');
        },
        (a, expect) => expect(visible(a, '#section_tracker')).toBe(true)
    ),
    s(
        'back to today and check a habit (it gets archived later)',
        a => {
            a.click('#backToTodayBannerBtn');
            a.click('[data-action="toggleDay"][data-id="h2"][data-key="2026-10-21"]');
        },
        (a, expect) => expect(habit(a, 'h2').history['2026-10-21']).toBe(true)
    ),
    // --- manage
    s(
        'open manage',
        a => a.click('#mobileNav_manage'),
        (a, expect) => expect(visible(a, '#section_manage')).toBe(true)
    ),
    s(
        'filter manage by a category and back',
        a => {
            a.click('[data-action="setCategoryFilter"][data-cat="בריאות"][data-ctx="manage"]');
            a.click('[data-action="setCategoryFilter"][data-cat="הכל"][data-ctx="manage"]');
        },
        (a, expect) => expect(text(a, '#manageHabitsSubtitle')).toBe('מוצגים 5 מתוך 5 הרגלים')
    ),
    s(
        'selection mode: pick two habits',
        a => {
            a.click('#manageSelectToggleBtn');
            a.click('[data-action="manageCard"][data-id="h1"]');
            a.click('[data-action="manageCard"][data-id="h3"]');
        },
        (a, expect) => expect(text(a, '#manageBulkCount')).toBe('נבחרו 2')
    ),
    s(
        'select all, then clear',
        a => {
            a.click('#manageBulkSelectAllBtn');
            a.click('#manageBulkSelectAllBtn');
        },
        (a, expect) => expect(text(a, '#manageBulkCount')).toBe('בחרו הרגלים')
    ),
    s(
        'archive two selected habits',
        a => {
            a.click('[data-action="manageCard"][data-id="h1"]');
            a.click('[data-action="manageCard"][data-id="h3"]');
            a.click('#manageBulkArchiveBtn');
        },
        (a, expect) => expect(habit(a, 'h1').archivedSince).toBeTruthy()
    ),
    s(
        'open the archive',
        a => a.click('#archiveToggle'),
        (a, expect) => expect(a.$('#archiveReveal').classList.contains('is-open')).toBe(true)
    ),
    s(
        'restore a habit',
        a => a.click('[data-action="restoreHabit"][data-id="h1"]'),
        (a, expect) => expect(habit(a, 'h1').archivedSince).toBe(undefined)
    ),
    s(
        'delete an archived habit for good',
        a => {
            a.click('[data-action="deleteHabit"][data-id="h3"]');
            a.click('#confirmModalActionBtn');
        },
        (a, expect) => expect(habit(a, 'h3')).toBe(undefined)
    ),
    s(
        'undo the delete',
        a => a.click('#toastUndoBtn'),
        (a, expect) => expect(habit(a, 'h3')).toBeTruthy()
    ),
    s(
        'card menu: archive',
        a => {
            a.click('[data-action="toggleMenu"][data-arg="habitMenu_h2"]');
            a.click('[data-action="menuArchive"][data-id="h2"]');
        },
        // checked today, so it still counts today and leaves from tomorrow
        (a, expect) => expect(habit(a, 'h2').archivedSince).toBe('2026-10-22')
    ),
    s(
        'card menu: delete, then "archive instead"',
        a => {
            a.click('[data-action="toggleMenu"][data-arg="habitMenu_h4"]');
            a.click('[data-action="menuDelete"][data-id="h4"]');
            a.click('#confirmModalAltBtn');
        },
        (a, expect) => expect(habit(a, 'h4').archivedSince).toBeTruthy()
    ),
    s(
        'restore the archived habits',
        a => {
            a.click('[data-action="restoreHabit"][data-id="h2"]');
            a.click('[data-action="restoreHabit"][data-id="h3"]');
            a.click('[data-action="restoreHabit"][data-id="h4"]');
        },
        (a, expect) => expect(stored(a).every(h => !h.archivedSince)).toBe(true)
    ),
    // --- new habit with every option
    s(
        'open the new-habit form',
        a => a.click('#section_manage [data-action="newHabit"][aria-label]'),
        (a, expect) => expect(text(a, '#modalTitle')).toBe('הרגל חדש')
    ),
    s(
        'name it',
        a => a.type('#habitNameInput', 'מדיטציה בוקר'),
        (a, expect) => expect(a.$('#saveHabitBtn').disabled).toBe(false)
    ),
    s(
        'pick an icon and a colour',
        a => {
            a.click('#habitAppearanceBtn');
            a.click('#iconPickerGrid [data-action="selectIcon"][aria-label="אייקון: קריאה"]');
            a.click('[data-action="selectColor"][data-arg="pink"]');
        },
        (a, expect) => expect(a.$('#habitPreviewIcon').textContent).toBe('📚')
    ),
    s(
        'more icons, then a custom emoji',
        a => {
            a.click('[data-action="toggleCustomIcons"]');
            a.click('#moreIconsGrid [data-action="selectIcon"]:nth-child(5)');
            a.type('#customIconInput', 'abc🎯');
        },
        (a, expect) => expect(a.$('#habitPreviewIcon').textContent).toBe('🎯')
    ),
    s(
        'fixed days',
        a => {
            a.click('#goalTypeBtn_fixed_days');
            a.click('[data-action="toggleFixedDay"][data-arg="6"]');
            a.click('[data-action="toggleFixedDay"][data-arg="0"]');
        },
        (a, expect) => expect(text(a, '#fixedDaysCountBadge')).toBe('3 ימים נבחרו')
    ),
    s(
        'the last fixed day cannot be removed',
        a => {
            a.click('[data-action="toggleFixedDay"][data-arg="2"]');
            a.click('[data-action="toggleFixedDay"][data-arg="4"]');
            a.click('[data-action="toggleFixedDay"][data-arg="6"]');
        },
        (a, expect) => expect(toast(a)).toBe('יש לבחור לפחות יום קבוע אחד בשבוע')
    ),
    s(
        'add days back',
        a => {
            a.click('[data-action="toggleFixedDay"][data-arg="1"]');
            a.click('[data-action="toggleFixedDay"][data-arg="3"]');
        },
        (a, expect) => expect(text(a, '#fixedDaysCountBadge')).toBe('3 ימים נבחרו')
    ),
    s(
        'twice a day, a different time per day',
        a => {
            a.click('#habitTimeToggle');
            a.choose('habitTimesPerDay', '2');
            a.click('#habitPerDayToggle');
        },
        (a, expect) => expect(visible(a, '#timeDayChips')).toBe(true)
    ),
    s(
        'set the times of Wednesday and copy them to every day',
        a => {
            a.click('[data-action="pickTimeDay"][data-arg="3"]');
            a.choose('habitTimeHour', '07');
            a.choose('habitTimeMinute', '30');
            a.click('[data-action="pickTimeSlot"][data-arg="1"]');
            a.choose('habitTimeHour', '19');
            a.choose('habitDuration', '30');
            a.click('#copyDayTimesBtn');
        },
        (a, expect) => expect(text(a, '#habitTimeSummary')).toContain('2 פעמים ביום')
    ),
    s(
        'give Saturday its own morning time',
        a => {
            a.click('[data-action="pickTimeDay"][data-arg="6"]');
            a.click('[data-action="pickTimeSlot"][data-arg="0"]');
            a.choose('habitTimeHour', '09');
        },
        (a, expect) => expect(text(a, '#habitTimeSummary')).toContain('ש׳')
    ),
    s(
        'category and note',
        a => {
            a.click('#habitDetailsToggle');
            a.choose('habitCategoryInput', 'פוקוס');
            a.type('#habitNoteInput', '10 דקות');
        },
        (a, expect) => expect(text(a, '#habitDetailsSummary')).toBe('פוקוס · 10 דקות')
    ),
    s(
        'start date from the date picker',
        a => {
            a.click('#habitStartDateInput_trigger');
            a.click('#fullCalendarGrid [data-cal-key="2026-10-19"]');
        },
        (a, expect) => expect(a.$('#habitStartDateInput').value).toBe('2026-10-19')
    ),
    s(
        'save the new habit',
        a => a.click('#saveHabitBtn'),
        (a, expect) => {
            expect(toast(a)).toBe('הרגל חדש נוסף למערכת!');
            expect(stored(a).some(h => h.name === 'מדיטציה בוקר' && h.dayTimes)).toBe(true);
        }
    ),
    s(
        'edit a habit: change its schedule (asks which days it applies to)',
        a => {
            a.click('[data-action="manageCard"][data-id="h5"]');
            a.click('#goalTypeBtn_daily');
        },
        (a, expect) => expect(visible(a, '#scheduleScopeBox')).toBe(true)
    ),
    s(
        'switch the scope back and forth, then save from today on',
        a => {
            a.click('#scopeBtn_all');
            a.click('#scopeBtn_forward');
            a.click('#saveHabitBtn');
        },
        (a, expect) => expect(habit(a, 'h5').schedule).toHaveLength(2)
    ),
    s(
        'Enter with an empty name shakes the field',
        a => {
            a.click('#section_manage [data-action="newHabit"][aria-label]');
            a.key('#habitNameInput', 'Enter');
        },
        (a, expect) => expect(a.$('#habitNameInput').classList.contains('field-error')).toBe(true),
        100
    ),
    s(
        'Escape closes an open list before the dialog',
        a => {
            a.click('#habitDetailsToggle');
            a.click('#habitCategoryInput_trigger');
            a.key(null, 'Escape');
        },
        (a, expect) => expect(a.$('#habitModalBackdrop').classList.contains('hidden')).toBe(false)
    ),
    s(
        'Escape again closes the dialog',
        a => a.key(null, 'Escape'),
        (a, expect) => expect(a.$('#habitModalBackdrop').classList.contains('hidden')).toBe(true)
    ),
    // --- categories
    s(
        'open the category manager and add a category',
        a => {
            a.click('[data-action="openCategories"]');
            a.type('#modalNewCategoryInput', 'שינה');
            a.click('[data-action="addCategory"]');
        },
        (a, expect) => expect(stored(a, KEY.categories)).toContain('שינה')
    ),
    s(
        'adding it twice is refused',
        a => {
            a.type('#modalNewCategoryInput', 'שינה');
            a.key('#modalNewCategoryInput', 'Enter');
        },
        (a, expect) => expect(toast(a)).toBe('קטגוריה בשם זה כבר קיימת')
    ),
    s(
        'start renaming it',
        a => a.click('[data-action="startCategoryRename"][data-cat="שינה"]'),
        (a, expect) => expect(a.has('#activeCategoryRenameInput')).toBe(true)
    ),
    s(
        'rename it with Enter',
        a => {
            a.type('#activeCategoryRenameInput', 'מנוחה');
            a.key('#activeCategoryRenameInput', 'Enter');
        },
        (a, expect) => expect(stored(a, KEY.categories)).toContain('מנוחה')
    ),
    s(
        'delete it',
        a => {
            a.click('[data-action="deleteCategory"][data-cat="מנוחה"]');
            a.click('#confirmModalActionBtn');
        },
        (a, expect) => expect(stored(a, KEY.categories)).not.toContain('מנוחה')
    ),
    s(
        'select two categories and delete them',
        a => {
            a.click('#categorySelectToggleBtn');
            a.click('[data-cat-select="למידה"]');
            a.click('[data-cat-select="פוקוס"]');
            a.click('#categoryBulkDeleteBtn');
            a.click('#confirmModalActionBtn');
        },
        (a, expect) => expect(stored(a, KEY.categories)).not.toContain('פוקוס')
    ),
    s(
        'undo the category delete',
        a => a.click('#toastUndoBtn'),
        (a, expect) => expect(stored(a, KEY.categories)).toContain('פוקוס')
    ),
    s(
        'close the category manager',
        a => a.click('[data-action="closeCategories"]'),
        (a, expect) => expect(a.$('#categoryModalBackdrop').classList.contains('hidden')).toBe(true)
    ),
    // --- drag & drop
    s(
        'drag a habit card onto another category',
        a => {
            a.pointer('pointerdown', '[data-habit-card="h2"]', 100, 100);
            a.pointer('pointermove', null, 120, 110);
            a.document.elementFromPoint = () => a.document.querySelector('[data-drop-category="בריאות"]');
            a.pointer('pointermove', null, 140, 120);
            a.pointer('pointerup', null, 140, 120, { buttons: 0 });
        },
        (a, expect) => {
            expect(habit(a, 'h2').category).toBe('בריאות');
            expect(a.$('#habitDropTray').classList.contains('hidden')).toBe(true);
        }
    ),
    s(
        'a drag cancelled with Escape changes nothing',
        a => {
            a.pointer('pointerdown', '[data-habit-card="h1"]', 100, 100);
            a.pointer('pointermove', null, 130, 130);
            a.key(null, 'Escape');
        },
        (a, expect) => expect(habit(a, 'h1').category).toBe('כושר')
    ),
    // --- the day plan by time, now/next/past, the minute refresh and midnight
    s(
        'back to today in the tracker: the timed habit splits the day into parts',
        a => {
            a.click('#navTab_tracker');
            a.click('#backToTodayBannerBtn');
        },
        (a, expect) => {
            const headings = [...a.document.querySelectorAll('#habitsListContainer h3')].map(h => h.textContent.trim());
            expect(headings).toEqual(expect.arrayContaining(['בוקר', 'ערב', 'בכל שעה']));
        }
    ),
    s(
        'check the morning occurrence of a twice-a-day habit',
        a => a.click('[data-action="toggleDay"][data-slot="0"]'),
        (a, expect) => expect(stored(a).find(h => h.slotHistory && h.slotHistory['2026-10-21'])).toBeTruthy()
    ),
    s(
        'the minute refresh moves "now" along',
        a => a.setTime(new Date(2026, 9, 21, 19, 10)),
        (a, expect) => expect(a.$('#habitsListContainer').textContent).toContain('עכשיו'),
        60000
    ),
    s(
        'midnight rolls over to the next day',
        a => a.setTime(new Date(2026, 9, 22, 0, 0, 30)),
        (a, expect) => expect(a.$('#daySelectorStrip [aria-current="date"]').dataset.key).toBe('2026-10-22'),
        60000
    ),
    s(
        'coming back to the tab re-checks the day',
        a => a.document.dispatchEvent(new a.window.Event('visibilitychange')),
        (a, expect) => expect(text(a, '#greetingLabel')).toBe('לילה טוב')
    ),
    // --- header
    s(
        'toggle the theme and the sound',
        a => {
            a.click('#themeToggleBtn');
            a.click('#soundToggleBtn');
        },
        (a, expect) => {
            expect(a.document.documentElement.classList.contains('dark')).toBe(true);
            expect(stored(a, KEY.prefs)).toMatchObject({ isDarkMode: true, soundEnabled: false });
        }
    ),
    // --- reset and dialogs
    s(
        'a decision dialog shakes on a backdrop click instead of closing',
        a => {
            a.click('#navTab_manage');
            a.click('[data-action="toggleMenu"][data-arg="manageHeaderMenu"]');
            a.click('[data-action="resetData"]');
            a.click('#confirmModalBackdrop');
        },
        (a, expect) => expect(a.$('#confirmModalBackdrop > .modal-panel').classList.contains('is-shaking')).toBe(true),
        100
    ),
    s(
        'confirm the reset to the sample data',
        a => a.click('#confirmModalActionBtn'),
        (a, expect) => {
            expect(toast(a)).toBe('נתוני הדוגמה שוחזרו');
            expect(
                stored(a)
                    .map(h => h.id)
                    .sort()
            ).toEqual(['h1', 'h2', 'h3', 'h4', 'h5']);
        }
    )
];

// ---------------------------------------------------------------------------------------------
// Walk through every section (used after loading other data)
// ---------------------------------------------------------------------------------------------
const walkthrough = [
    s('open analytics', a => a.click('#navTab_analytics')),
    s('analytics: last 30 days', a => a.click('[data-action="setPreset"][data-arg="30d"]')),
    s('analytics: this week', a => a.click('[data-action="setPreset"][data-arg="week"]')),
    s('open manage', a => a.click('#navTab_manage')),
    s('open the archive if there is one', a => {
        if (a.has('#archiveToggle')) a.click('#archiveToggle');
    }),
    s('open the category manager', a => a.click('[data-action="openCategories"]')),
    s('close it', a => a.click('[data-action="closeCategories"]')),
    s('back to the tracker', a => a.click('#navTab_tracker')),
    s('weekly table', a => a.click('#viewModeGridBtn')),
    s('daily list', a => a.click('#viewModeFocusBtn')),
    s('previous week', a => a.click('[data-action="shiftWeek"][data-arg="-1"]'))
];

// Data recorded by running the ORIGINAL app (only), to be loaded later by both.
async function storageWrittenByTheOriginal() {
    const app = await createApp('legacy', { now: new Date(2026, 9, 12, 9, 0) });
    const run = async (fn, ms = 600) => {
        fn(app);
        await app.settle(ms);
    };
    await run(a => a.click('[data-action="toggleDay"][data-id="h5"]'));
    await run(a => a.click('#mobileNav_manage'));
    await run(a => {
        a.click('[data-action="openCategories"]');
        a.type('#modalNewCategoryInput', 'ערב');
        a.click('[data-action="addCategory"]');
        a.click('[data-action="closeCategories"]');
    });
    await run(a => {
        a.click('#section_manage [data-action="newHabit"][aria-label]');
        a.type('#habitNameInput', 'יומן');
        a.click('#goalTypeBtn_flexible');
        a.click('#habitTimeToggle');
        a.choose('habitTimeHour', '21');
        a.choose('habitDuration', '15');
        a.click('#habitDetailsToggle');
        a.choose('habitCategoryInput', 'ערב');
        a.click('#saveHabitBtn');
    });
    await run(a => {
        a.click('[data-action="toggleMenu"][data-arg="habitMenu_h4"]');
        a.click('[data-action="menuArchive"][data-id="h4"]');
    });
    await run(a => {
        a.click('[data-action="manageCard"][data-id="h1"]');
        a.click('#goalTypeBtn_flexible');
        a.click('#saveHabitBtn');
    });
    await run(a => a.click('#themeToggleBtn'));
    await run(a => a.click('#navTab_analytics'));
    await run(a => a.click('[data-action="setPreset"][data-arg="custom"]'));
    const storage = { ...app.window.localStorage };
    app.close();
    return storage;
}

// Old-format, hand-edited and damaged data, stored under the OLD key.
const OLD_AND_DAMAGED = {
    [KEY.old]: JSON.stringify([
        {
            id: 'o1',
            name: 'הליכה',
            category: 'כושר',
            icon: '🚶',
            color: 'emerald',
            fixedDays: [0, 2, 4],
            history: { '2026-10-18': true, '2026-10-20': true, '2026-11-02': true }
        },
        { id: 'o2', name: 'ויטמינים', icon: '💊', color: 'rose', weeklyGoal: 3, history: { '2026-10-19': true } },
        { id: 'o3', name: 'מים', icon: '💧', color: 'cyan', history: { '2026-10-21': 1, bad: true } },
        {
            id: 'o4',
            name: 'פעמיים ביום',
            icon: '🦷',
            slotTimes: ['21:00', '07:00'],
            duration: 5,
            slotHistory: { '2026-10-20': [true, false], x: [true] }
        },
        {
            id: 'o5',
            name: 'שעות שונות',
            icon: '📚',
            goalType: 'fixed_days',
            fixedDays: [1, 3],
            dayTimes: [[], ['08:00'], [], ['18:30'], [], [], []],
            startDate: '2026-10-01'
        },
        {
            id: 'o6',
            name: 'גרסאות',
            icon: '🎸',
            startDate: '2026-09-01',
            schedule: [
                { from: null, goalType: 'daily' },
                { from: '2026-10-01', goalType: 'flexible', weeklyGoal: 2 }
            ],
            history: { '2026-09-30': true, '2026-10-15': true }
        },
        {
            id: 'o7',
            name: 'בארכיון',
            icon: '🌱',
            archivedSince: '2026-10-10',
            pausedRanges: [['2026-09-01', '2026-09-05']],
            startDate: '2026-08-01'
        },
        { id: 'bad id', name: '', icon: '<script>', color: 9, note: 7, category: 3 },
        { id: 'o9', name: 'יום לא חוקי', fixedDays: [9], goalType: 'fixed_days' },
        null,
        'garbage',
        { id: 'o1', name: 'כפילות' }
    ]),
    [KEY.categories]: JSON.stringify(['כושר', ' כושר ', 'הכל', 7, null, 'בריאות']),
    [KEY.prefs]: JSON.stringify({
        isDarkMode: true,
        currentMainSection: 'analytics',
        analyticsRange: { preset: 'custom', start: '2026-10-01', end: '2026-10-20' },
        analyticsFilter: 'habit:missing',
        currentViewMode: 'grid'
    })
};

export const SCENARIOS = [
    {
        name: 'a tour of every screen and interaction, from the sample data',
        setup: async () => ({ now: NOW }),
        bootCheck: (app, expect) => {
            expect(app.document.querySelectorAll('[data-action="toggleDay"]').length).toBeGreaterThan(4);
            expect(text(app, '#greetingLabel')).toBe('בוקר טוב');
            expect(app.window.localStorage.getItem(KEY.habits)).toContain('"h1"');
        },
        steps: tour
    },
    {
        name: 'data saved by the original app, opened nine days later',
        setup: async () => ({ now: NOW, storage: await storageWrittenByTheOriginal() }),
        bootCheck: (app, expect) => {
            expect(app.window.localStorage.getItem(KEY.habits)).toContain('יומן');
            expect(app.document.documentElement.classList.contains('dark')).toBe(true);
            expect(visible(app, '#section_analytics')).toBe(true);
        },
        steps: walkthrough
    },
    {
        name: 'old-format, hand-edited and damaged data under the old key',
        setup: async () => ({ now: NOW, storage: OLD_AND_DAMAGED }),
        bootCheck: (app, expect) => {
            const ids = stored(app).map(h => h.id);
            expect(ids).toContain('o6');
            expect(ids).not.toContain('o9');
            expect(app.consoleLog.some(l => l.startsWith('warn: Skipped a damaged habit'))).toBe(true);
        },
        steps: walkthrough
    },
    {
        name: 'no habits at all, then the first one',
        setup: async () => ({ now: NOW, storage: { [KEY.habits]: '[]', [KEY.categories]: '[]' } }),
        bootCheck: (app, expect) => expect(text(app, '#habitsListContainer')).toContain('עוד אין לכם הרגלים'),
        steps: [
            s(
                'analytics empty state',
                a => a.click('#navTab_analytics'),
                (a, expect) => expect(visible(a, '#analyticsEmptyState')).toBe(true)
            ),
            s('manage empty state', a => a.click('#navTab_manage')),
            s('category manager with no categories', a => a.click('[data-action="openCategories"]')),
            s('close it', a => a.click('[data-action="closeCategories"]')),
            s(
                'create the first habit',
                a => {
                    a.click('#section_manage [data-action="newHabit"][aria-label]');
                    a.type('#habitNameInput', 'ראשון');
                    a.click('#saveHabitBtn');
                },
                (a, expect) => expect(stored(a)).toHaveLength(1)
            ),
            s('back to the tracker', a => a.click('#navTab_tracker'))
        ]
    },
    {
        name: 'saved preferences: dark theme, weekly table, manage section',
        setup: async () => ({
            now: NOW,
            storage: {
                [KEY.prefs]: JSON.stringify({
                    isDarkMode: true,
                    soundEnabled: false,
                    currentViewMode: 'grid',
                    currentMainSection: 'manage',
                    analyticsRange: { preset: '30d' },
                    analyticsFilter: 'cat:כושר'
                })
            }
        }),
        bootCheck: (app, expect) => {
            expect(visible(app, '#section_manage')).toBe(true);
            expect(app.$('#soundToggleBtn').getAttribute('aria-pressed')).toBe('false');
        },
        steps: [
            s(
                'analytics keeps the saved range and filter',
                a => a.click('#navTab_analytics'),
                (a, expect) => expect(a.$('#analyticsFilterSelect').value).toBe('cat:כושר')
            ),
            s(
                'tracker opens in the weekly table',
                a => a.click('#navTab_tracker'),
                (a, expect) => expect(a.has('#habitsListContainer table')).toBe(true)
            ),
            s('back to the light theme', a => a.click('#themeToggleBtn'))
        ]
    },
    {
        name: 'browser storage is full',
        setup: async () => ({
            now: NOW,
            beforeBoot: window => {
                const setItem = window.Storage.prototype.setItem;
                window.Storage.prototype.setItem = function (key, value) {
                    if (window.__storageFull) throw new window.DOMException('full', 'QuotaExceededError');
                    return setItem.call(this, key, value);
                };
            }
        }),
        steps: [
            s(
                'check a habit while storage is full',
                a => {
                    a.window.__storageFull = true;
                    a.click('[data-action="toggleDay"][data-id="h5"][data-key="2026-10-21"]');
                },
                (a, expect) => expect(toast(a)).toBe('האחסון בדפדפן מלא — השינויים נשמרים רק עד לסגירת הדף')
            ),
            s(
                'storage works again: the next change is saved',
                a => {
                    a.window.__storageFull = false;
                    a.click('[data-action="toggleDay"][data-id="h2"][data-key="2026-10-21"]');
                },
                (a, expect) => expect(habit(a, 'h5').history['2026-10-21']).toBe(true)
            )
        ]
    }
];
