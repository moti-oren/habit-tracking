// Shared helpers for the end-to-end tests.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ORIGINAL_URL = pathToFileURL(path.join(ROOT, 'legacy/habit_tracker_dashboard.html')).href;
export const SINGLE_FILE_URL = pathToFileURL(path.join(ROOT, 'dist-single/habit_tracker_dashboard.html')).href;
export const PREVIEW_URL = 'http://localhost:4173/';
export const INTRO_SEEN_KEY = 'habit_tracker_intro_seen_v1';

/** Wednesday 21 Oct 2026, 10:00 in Israel (the time zone of every context). */
export const NOW = new Date('2026-10-21T10:00:00+03:00');
export const TIMEZONE = 'Asia/Jerusalem';

export const VIEWPORTS = {
    desktop: { width: 1280, height: 900 },
    mobile: { width: 390, height: 844 }
};

/**
 * Installs a fake clock at NOW and pauses it (installed alone, fake time flows with real time). It
 * drives every JavaScript timer (timeouts, intervals, animation frames, idle callbacks), holds
 * across navigations and reloads, and from now on only moves in settle().
 */
export async function freezeClock(page) {
    await page.clock.install({ time: NOW });
    await page.clock.pauseAt(NOW);
}

/**
 * A context + page for one app, with a frozen clock (see freezeClock) and an error log. Two apps
 * compared side by side live on exactly the same timeline.
 */
export async function openApp(
    browser,
    url,
    { viewport = VIEWPORTS.desktop, colorScheme = 'light', storage, intro = false } = {}
) {
    const context = await browser.newContext({
        viewport,
        colorScheme,
        timezoneId: TIMEZONE,
        reducedMotion: 'no-preference',
        isMobile: viewport.width < 768,
        hasTouch: false
    });
    // The intro screen (new, the original has none) is skipped unless a test is about it.
    if (!intro) {
        await context.addInitScript(key => {
            if (!localStorage.getItem(key)) localStorage.setItem(key, '1');
        }, INTRO_SEEN_KEY);
    }
    if (storage) {
        await context.addInitScript(entries => {
            if (sessionStorage.getItem('__seeded')) return;
            for (const [k, v] of Object.entries(entries)) localStorage.setItem(k, v);
            sessionStorage.setItem('__seeded', '1');
        }, storage);
    }
    // counts scroll events (passive, observes only) so settle() can wait for smooth scrolls to end
    await context.addInitScript(() => {
        window.__scrollEvents = 0;
        addEventListener('scroll', () => window.__scrollEvents++, { capture: true, passive: true });
    });
    const page = await context.newPage();
    await freezeClock(page);
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    });
    await page.goto(url);
    // boot: first render, idle-time prerender of the hidden sections, skeleton fade
    for (let i = 0; i < 40; i++) {
        await settle(page, 100);
        if (await page.evaluate(() => !document.getElementById('appSkeleton'))) break;
    }
    await settle(page, 1000);
    return { context, page, errors };
}

/**
 * Moves the fake clock by `ms` (timers, frames and idle callbacks run), waits a little real time
 * for what timers don't drive (smooth scrolling, fonts, the CDN's asynchronous CSS generation in
 * the original), then finishes every finite animation so a state can be compared.
 */
export async function settle(page, ms = 700) {
    await page.clock.runFor(ms);
    await page.waitForTimeout(150);
    for (let i = 0, last = -1; i < 30; i++) {
        const n = await page.evaluate(() => window.__scrollEvents);
        if (n === last) break;
        last = n;
        await page.waitForTimeout(120);
    }
    await page.evaluate(async () => {
        await document.fonts.ready;
        for (const a of document.getAnimations()) {
            try {
                if (a.effect && a.effect.getComputedTiming().endTime !== Infinity) a.finish();
            } catch {
                // an animation can end between listing and finishing it
            }
        }
    });
    await page.clock.runFor(50);
}

/**
 * Clicks the first visible element matching the selector (sections and nav bars hide by viewport),
 * then lets the app settle, as a person's taps are spaced: opening a form section smooth-scrolls the
 * dialog, and a scroll outside an open list closes it (in both apps).
 */
export async function tap(page, selector) {
    await page.locator(`${selector}:visible`).first().click();
    await settle(page);
}

/** Presses a key, then lets the app settle. */
export async function press(page, key) {
    await page.keyboard.press(key);
    await settle(page);
}

/**
 * Picks an option of the open custom list. A real click would first scroll the option into view, and
 * any scroll outside the list closes it (in both apps), so the option gets the click event directly.
 */
export async function pick(page, value) {
    await page.locator('[role="listbox"]').last().locator(`[data-value="${value}"]`).dispatchEvent('click');
    await settle(page);
}
