// Smoke tests of the production builds in a real browser.
import { test, expect } from '@playwright/test';
import {
    INTRO_SEEN_KEY,
    ORIGINAL_URL,
    PREVIEW_URL,
    SINGLE_FILE_URL,
    TIMEZONE,
    freezeClock,
    openApp,
    pick,
    press,
    settle,
    tap
} from './helpers.js';

const KEY = {
    habits: 'habit_tracker_he_v2',
    categories: 'habit_tracker_categories_he_v2',
    prefs: 'habit_tracker_prefs_he_v2'
};
const stored = (page, key = KEY.habits) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);

test.describe('the multi-file build (vite preview)', () => {
    test('boots without errors, without the Tailwind CDN, and shows the sample habits', async ({ browser }) => {
        const requests = [];
        const app = await openApp(browser, PREVIEW_URL);
        app.page.on('request', r => requests.push(r.url()));
        await app.page.reload();
        await settle(app.page, 1500);
        await expect(app.page.locator('#daySelectorStrip button')).toHaveCount(7);
        // the sample habits: meditation is done twice a day, so it has two marks
        await expect(app.page.locator('[data-action="toggleDay"]')).toHaveCount(9);
        await expect(app.page.locator('#greetingLabel')).toHaveText('בוקר טוב');
        expect(requests.some(u => u.includes('cdn.tailwindcss.com'))).toBe(false);
        expect(app.errors).toEqual([]);
        await app.context.close();
    });

    test('checking the last habits off completes the day, and undo restores a cleared day', async ({ browser }) => {
        const { context, page, errors } = await openApp(browser, PREVIEW_URL);
        // left for today in the sample data: deep work, reading, and the evening meditation
        await tap(page, '[data-action="toggleDay"][data-id="h7"]');
        await tap(page, '[data-action="toggleDay"][data-id="h4"]');
        await tap(page, '[data-action="toggleDay"][data-id="h5"][data-slot="1"]');
        await expect(page.locator('#toastMessage')).toHaveText('כל היעדים להיום הושלמו. כל הכבוד!');
        expect((await stored(page)).find(h => h.id === 'h5').history['2026-10-21']).toBe(true);
        await tap(page, '[data-action="toggleMenu"][data-arg="trackerActionsMenu"]');
        await tap(page, '#clearAllBtn');
        expect((await stored(page)).find(h => h.id === 'h5').history['2026-10-21']).toBe(false);
        await tap(page, '#toastUndoBtn');
        await expect(page.locator('#toastMessage')).toHaveText('הפעולה בוטלה והמצב הקודם שוחזר');
        expect((await stored(page)).find(h => h.id === 'h5').history['2026-10-21']).toBe(true);
        expect(errors).toEqual([]);
        await context.close();
    });

    test('a new habit from the form appears in manage and in the tracker', async ({ browser }) => {
        const { context, page, errors } = await openApp(browser, PREVIEW_URL);
        await tap(page, '[data-action="switchSection"][data-arg="manage"]');
        await tap(page, '#section_manage [data-action="newHabit"][aria-label]');
        await page.locator('#habitNameInput').fill('מדיטציה');
        await settle(page);
        await tap(page, '#habitTimeToggle');
        await tap(page, '#habitTimeHour_trigger');
        await pick(page, '07');
        await tap(page, '#saveHabitBtn');
        await expect(page.locator('#toastMessage')).toHaveText('הרגל חדש נוסף למערכת!');
        await expect(page.locator('#manageHabitsGrid')).toContainText('מדיטציה');
        await tap(page, '[data-action="switchSection"][data-arg="tracker"]');
        await expect(page.locator('#habitsListContainer')).toContainText('מדיטציה');
        await expect(page.locator('#habitsListContainer h3', { hasText: 'בוקר' }).first()).toBeVisible();
        expect((await stored(page)).find(h => h.name === 'מדיטציה').time).toBe('07:00');
        expect(errors).toEqual([]);
        await context.close();
    });

    test('analytics draws its charts for every preset', async ({ browser }) => {
        const { context, page, errors } = await openApp(browser, PREVIEW_URL);
        await tap(page, '[data-action="switchSection"][data-arg="analytics"]');
        await expect(page.locator('#weeklyBarChart [data-bar-track]')).toHaveCount(7);
        await tap(page, '[data-action="setPreset"][data-arg="30d"]');
        await expect(page.locator('#lineChartWrap svg')).toBeVisible();
        await tap(page, '[data-action="setPreset"][data-arg="7d"]');
        await expect(page.locator('#analyticsRangeLabel')).toHaveText('7 הימים האחרונים');
        expect(errors).toEqual([]);
        await context.close();
    });

    test('the chosen theme is applied before the first paint after a reload', async ({ browser }) => {
        const { context, page } = await openApp(browser, PREVIEW_URL);
        await tap(page, '#themeToggleBtn');
        await page.reload({ waitUntil: 'commit' });
        // the pre-paint script in <head> runs as soon as it is parsed, before the stylesheet and the app
        await page.waitForSelector('head > script', { state: 'attached' });
        expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
        await context.close();
    });

    test('the hidden sections are drawn in idle time after boot', async ({ browser }) => {
        const prefs = JSON.stringify({ currentMainSection: 'analytics' });
        const { context, page } = await openApp(browser, PREVIEW_URL, { storage: { [KEY.prefs]: prefs } });
        await expect(page.locator('#section_analytics')).toBeVisible();
        await expect(page.locator('#section_tracker [data-action="toggleDay"]')).toHaveCount(9);
        await expect(page.locator('#manageHabitsGrid [data-habit-card]')).toHaveCount(8);
        await context.close();
    });
});

test.describe('empty states', () => {
    test('with no habits, the first-run screen loads the sample data in one click', async ({ browser }) => {
        const { context, page, errors } = await openApp(browser, PREVIEW_URL, { storage: { [KEY.habits]: '[]' } });
        await expect(page.locator('#habitsListContainer')).toContainText('בואו נתחיל לבנות הרגלים');
        await tap(page, '[data-action="switchSection"][data-arg="manage"]');
        await expect(page.locator('#manageHabitsGrid')).toContainText('בואו נתחיל לבנות הרגלים');
        await tap(page, '[data-action="switchSection"][data-arg="analytics"]');
        await expect(page.locator('#analyticsEmptyState')).toBeVisible();
        await tap(page, '#analyticsEmptyState [data-action="loadSampleData"]');
        await expect(page.locator('#toastMessage')).toHaveText('נתוני הדוגמה נטענו');
        await expect(page.locator('#analyticsEmptyState')).toBeHidden();
        expect(await stored(page)).toHaveLength(9);
        await tap(page, '[data-action="switchSection"][data-arg="tracker"]');
        await expect(page.locator('[data-action="toggleDay"]')).toHaveCount(9);
        expect(errors).toEqual([]);
        await context.close();
    });

    test('an empty category says which one, and leads back to all habits', async ({ browser }) => {
        const categories = JSON.stringify(['בריאות', 'כושר', 'למידה', 'מיינדפולנס', 'פוקוס', 'ערב']);
        const { context, page, errors } = await openApp(browser, PREVIEW_URL, {
            storage: { [KEY.categories]: categories }
        });
        await tap(page, '[data-action="setCategoryFilter"][data-cat="ערב"][data-ctx="tracker"]');
        await expect(page.locator('#habitsListContainer')).toContainText('אין הרגלים בקטגוריה „ערב”');
        await tap(page, '#habitsListContainer [data-action="setCategoryFilter"][data-cat="הכל"]');
        await expect(page.locator('[data-action="toggleDay"]')).toHaveCount(9);
        expect(errors).toEqual([]);
        await context.close();
    });
});

test.describe('backup', () => {
    const openManageMenu = page => tap(page, '[data-action="toggleMenu"][data-arg="manageHeaderMenu"]');

    test('an exported backup restores everything in a new browser, and the import can be undone', async ({
        browser
    }) => {
        // export: some use first, so the backup is not just the sample data
        const first = await openApp(browser, PREVIEW_URL);
        await tap(first.page, '[data-action="toggleDay"][data-id="h4"]');
        await tap(first.page, '[data-action="switchSection"][data-arg="manage"]');
        await openManageMenu(first.page);
        const [download] = await Promise.all([
            first.page.waitForEvent('download'),
            first.page.locator('[data-action="exportBackup"]').click()
        ]);
        expect(download.suggestedFilename()).toBe('habit-tracker-backup-2026-10-21.json');
        const file = await download.path();
        const saved = await stored(first.page);
        const savedCategories = await stored(first.page, KEY.categories);
        await expect(first.page.locator('#toastMessage')).toHaveText('הגיבוי נשמר: 9 הרגלים');
        expect(first.errors).toEqual([]);

        // a new browser with no data: the first-run screen offers the backup
        const second = await openApp(browser, PREVIEW_URL, { storage: { [KEY.habits]: '[]' } });
        const [chooser] = await Promise.all([
            second.page.waitForEvent('filechooser'),
            second.page.locator('#habitsListContainer [data-action="importBackup"]').click()
        ]);
        await chooser.setFiles(file);
        await settle(second.page);
        await expect(second.page.locator('#confirmModalText')).toContainText('9 הרגלים');
        await tap(second.page, '#confirmModalActionBtn');
        await expect(second.page.locator('#toastMessage')).toHaveText('הגיבוי יובא: 9 הרגלים');
        expect(await stored(second.page)).toEqual(saved);
        expect(await stored(second.page, KEY.categories)).toEqual(savedCategories);
        await expect(second.page.locator('[data-action="toggleDay"][data-id="h4"]')).toHaveAttribute(
            'aria-pressed',
            'true'
        );

        // changed their mind: undo brings the empty app back
        await tap(second.page, '#toastUndoBtn');
        expect(await stored(second.page)).toEqual([]);
        await expect(second.page.locator('#habitsListContainer')).toContainText('בואו נתחיל לבנות הרגלים');
        expect(second.errors).toEqual([]);
        await first.context.close();
        await second.context.close();
    });

    test('a file that is not a backup is refused, and nothing changes', async ({ browser }) => {
        const { context, page, errors } = await openApp(browser, PREVIEW_URL);
        const before = await stored(page);
        await tap(page, '[data-action="switchSection"][data-arg="manage"]');
        await openManageMenu(page);
        const [chooser] = await Promise.all([
            page.waitForEvent('filechooser'),
            page.locator('[data-action="importBackup"]').click()
        ]);
        await chooser.setFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
        await settle(page);
        await expect(page.locator('#toastMessage')).toHaveText('זה לא קובץ גיבוי של מעקב ההרגלים.');
        await expect(page.locator('#confirmModalBackdrop')).toBeHidden();
        expect(await stored(page)).toEqual(before);
        expect(errors).toEqual([]);
        await context.close();
    });
});

test.describe('the single-file build opened from disk', () => {
    test('shows, and keeps byte for byte, the data the original file saved', async ({ browser }) => {
        // one context: like one browser, where every file:// page shares localStorage
        const context = await browser.newContext({ timezoneId: TIMEZONE, viewport: { width: 1280, height: 900 } });
        const page = await context.newPage();
        await freezeClock(page);
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));

        // the original file: some real use
        await page.goto(ORIGINAL_URL);
        await settle(page, 2000);
        await tap(page, '[data-action="toggleDay"][data-id="h5"]');
        await tap(page, '[data-action="switchSection"][data-arg="manage"]');
        await tap(page, '[data-action="openCategories"]');
        await page.locator('#modalNewCategoryInput').fill('ערב');
        await tap(page, '[data-action="addCategory"]');
        await tap(page, '[data-action="closeCategories"]');
        await tap(page, '[data-action="toggleMenu"][data-arg="habitMenu_h4"]');
        await tap(page, '[data-action="menuArchive"][data-id="h4"]');
        await settle(page, 5500); // the undo toast covers the header until it runs out
        await tap(page, '#themeToggleBtn');
        await settle(page, 3000);
        const saved = await page.evaluate(() => ({ ...localStorage }));

        // the new file, in place of the old one
        await page.goto(SINGLE_FILE_URL);
        await settle(page, 2000);
        // the intro screen is switched off: someone who used the original goes straight to their data
        await expect(page.locator('#intro')).toHaveCount(0);
        const after = await page.evaluate(() => ({ ...localStorage }));
        expect(after[KEY.habits]).toBe(saved[KEY.habits]);
        expect(after[KEY.categories]).toBe(saved[KEY.categories]);
        expect(JSON.parse(after[KEY.prefs])).toEqual(JSON.parse(saved[KEY.prefs]));
        expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
        await expect(page.locator('#section_manage')).toBeVisible();
        await expect(page.locator('#manageArchiveSection')).toContainText('ארכיון');
        await expect(page.locator('[data-action="setCategoryFilter"][data-cat="ערב"][data-ctx="manage"]')).toHaveCount(
            1
        );
        await tap(page, '[data-action="switchSection"][data-arg="tracker"]');
        await expect(page.locator('[data-action="toggleDay"][data-id="h5"]')).toHaveAttribute('aria-pressed', 'true');
        expect(errors).toEqual([]);
        await context.close();
    });
});

test.describe('the intro screen', () => {
    const introOpen = page => page.evaluate(() => !!document.getElementById('intro'));

    test('opens over an inert app, and a drag around the ring completes the week and opens the app', async ({
        browser
    }) => {
        const { context, page, errors } = await openApp(browser, PREVIEW_URL, { intro: true });
        await expect(page.locator('#intro')).toBeVisible();
        await expect(page.locator('#intro')).toHaveAttribute('aria-modal', 'true');
        expect(await page.evaluate(() => document.querySelector('header').closest('[inert]') !== null)).toBe(true);

        const box = await page.locator('[data-intro-dial]').boundingBox();
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;
        const r = box.width * 0.36;
        await page.mouse.move(cx, cy - r);
        await page.mouse.down();
        // clockwise from the top, half way: 3 of 7 days
        for (let i = 1; i <= 30; i++) {
            const a = (i / 60) * Math.PI * 2;
            await page.mouse.move(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
        }
        await settle(page, 100);
        await expect(page.locator('[data-intro-knob]')).toHaveAttribute('aria-valuenow', '3');
        await expect(page.locator('.intro-day.is-on')).toHaveCount(3);
        for (let i = 31; i <= 60; i++) {
            const a = (i / 60) * Math.PI * 2;
            await page.mouse.move(cx + Math.sin(a) * r, cy - Math.cos(a) * r);
        }
        await page.mouse.up();
        await settle(page, 2000);
        expect(await introOpen(page)).toBe(false);
        expect(await page.evaluate(() => document.querySelector('header').closest('[inert]'))).toBeNull();
        expect(await page.evaluate(k => localStorage.getItem(k), INTRO_SEEN_KEY)).toBe('1');

        // it opens only when asked: the plain address goes straight to the app, ?intro shows it again
        await page.goto(PREVIEW_URL);
        await settle(page, 1500);
        expect(await introOpen(page)).toBe(false);
        await page.goto(`${PREVIEW_URL}?intro`);
        await settle(page, 1500);
        expect(await introOpen(page)).toBe(true);
        expect(errors).toEqual([]);
        await context.close();
    });

    test('works from the keyboard, and Escape skips it', async ({ browser }) => {
        const { context, page, errors } = await openApp(browser, PREVIEW_URL, { intro: true });
        const knob = page.locator('[data-intro-knob]');
        await knob.focus();
        await press(page, 'ArrowRight');
        await press(page, 'ArrowRight');
        await press(page, 'ArrowLeft');
        await expect(knob).toHaveAttribute('aria-valuetext', '1 מתוך 7 ימים');
        await press(page, 'Enter');
        await settle(page, 2000);
        expect(await introOpen(page)).toBe(false);

        await page.goto(`${PREVIEW_URL}?intro`);
        await settle(page, 1500);
        await press(page, 'Escape');
        await settle(page, 1000);
        expect(await introOpen(page)).toBe(false);
        // the app's own Escape handling didn't run under it, and the app works
        await expect(page.locator('#daySelectorStrip button')).toHaveCount(7);
        expect(errors).toEqual([]);
        await context.close();
    });
});
