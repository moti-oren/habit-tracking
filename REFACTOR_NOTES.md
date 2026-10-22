# Refactor notes

The single-file app `legacy/habit_tracker_dashboard.html` (7,429 lines: inline CSS, the Tailwind
Play CDN, one 6,300-line script) became a Vite project of 102 ES modules. The goal was no change in
behaviour, appearance or stored data. This file records how that was done, the decisions made, what
could not be kept identical, and the bugs found but deliberately left alone.

The plan that was approved before any code was written is in
[docs/REFACTOR_PLAN.md](docs/REFACTOR_PLAN.md). This file supersedes it where they differ.

## After the refactor

The refactor is complete and verified at the git tag `refactor-verified`: there, every suite
described below passes (check out the tag, `npm ci`, then `npm run verify` and `npm run test:e2e`).

The app has been developed further since (an intro screen, new sample data, new empty states), so
the suites that required the interface to stay identical to the original were retired from the
regular runs: DOM parity, markup and CSS parity, the Tailwind class check, and visual parity in the
browser. They are kept at the tag. Still running on every change:

- the unit tests, against both the original and the refactored code;
- logic parity on random data (the logic layers have not changed);
- the browser smoke tests, including the single-file build taking over the original file's data.

To compare like with like, the suites that still run the original give the refactored code the
original's sample habits (`tests/harness/original-sample-habits.js`); the app's own sample data has
its own tests.

## How parity was established

1. **Characterization first.** Before any code moved, unit tests were written against the
   _original_ file. The test harness evaluates the original script, unchanged on disk, in jsdom, with
   one appended line that exposes its internals. Every suite then also runs against the refactored
   modules (`tests/unit`): 114 cases, so 228 runs, covering date math, DST, schedule
   normalization, streaks, range progress, labels, and the Store loading damaged data.
2. **Moved by tooling, not by hand.** Declarations were cut out of the original script by syntax
   tree and pasted byte for byte into modules. Imports were generated from scope analysis. The loose
   shared variables were rewritten into state objects by a scope-aware codemod that leaves same-named
   locals alone and expands shorthand properties, so stored key names stay the same. Hebrew text,
   emoji ZWJ sequences and the `⁦…⁩` isolates are therefore untouched.
3. **Checked after every step** (one commit per step):
   - DOM parity: the original and the production build run side by side in jsdom through 124 user
     steps in 6 scenarios. After every step the test compares DOM, form values, focus, localStorage,
     console output and errors (`tests/parity/dom.parity.test.js`).
   - Logic parity: 8 seeds × 120 random, partly damaged habits × 5 "todays", comparing every
     statistic and label (`tests/parity/logic.parity.test.js`).
   - Markup and CSS parity, and the Tailwind class check.
4. **In a real browser** (`e2e/`): the original file and the single-file build, both opened from
   `file://`, go through 23 states at desktop and phone width, in light and dark mode. Every element's
   computed style (with `::before`, `::after`, `::placeholder`) and the screenshots must be identical.
   A separate test opens the original, uses it, then opens the new file in its place. It checks that
   the new file shows the same data and leaves it byte for byte unchanged.

Several of these checks were themselves verified by planting a small change in the refactored code
and confirming the right step failed.

## Decisions

- **Architecture.** As planned, with these refinements:
  - Values cached on `Store.revision` live in `store/selectors.js`, next to the Store. `core/` keeps
    the pure `compute…` functions, so `core/` never depends on the Store.
  - The habit form, category manager, calendar and confirm dialog are feature dialogs, so they live
    in `ui/dialogs/`. `ui/components/` holds only the generic pieces.
  - The calendar is both the tracker's navigator and the date/range picker for forms. In navigation
    mode it closes itself and switches section, so it sits with the dialogs, not the components.
  - Drag & drop is specific to habit cards and categories, so it lives in `ui/sections/manage/`.
  - `ui/app/` holds render orchestration, section switching, boot, rollover and undo, so `main.js`
    only wires.
- **No side effects on import.** Every listener, observer and timer is started from `main.js`, in the
  exact order of the original script. The order matters: the dialog's Escape handler must run before
  the menus' Escape handler. ES module scripts run after parsing and before `DOMContentLoaded`, like
  the original script at the end of `<body>`.
- **State.** The 45 shared `let`s became properties of sealed objects (`state/*.js`). A misspelled
  property throws. Transitions that must stay consistent have setters (`setWeek(offset)` keeps the
  week offset and its days together). State used by a single module stays private to that module:
  toast timers, the modal stack, animation-frame handles, the charts' animation memory. Where another
  module needs to read it, there is a read-only accessor (`topModal()`, `isCustomSelectOpen()`).
- **Motion hints** (`state/motion.js`) are set and reset in exactly the same places and order as
  before.
- **Implicit inputs became parameters.** The callers now pass the value the old defaults read:
  `getWeeklyGoalForHabit(habit, days)`, `getWeeklyCountForHabit(habit, days)`,
  `getPreviousRangeBounds(range)`, `formatRangeLabel(range)`.
- **Markup.** `index.html` carries the original `<body>` byte for byte (a test enforces it; Prettier
  ignores the file). The pre-paint theme script and the skeleton's critical CSS stay inline.
- **CSS.** The `<style>` block was split into `src/styles/*.css`. Each file keeps the original order,
  and the reduced-motion rules come after everything they override. The custom CSS loads **before**
  Tailwind: the CDN appended its stylesheet after the page's own, so Tailwind wins every tie, and that
  is kept.
- **Tailwind** is pinned to 3.4.17, the version the CDN served. The inline config is ported 1:1, plus
  a safelist generated from `COLOR_OPTIONS`. `npm run check:css` proves every rule the original
  generated is still generated, with the same declarations.
- **Reproducing the CDN's quirks** (see `postcss.config.js`):
  - _Vendor prefixes._ The CDN ran autoprefixer only on its own output, with `remove: false` and a
    prefix table precompiled for its 2023 target browsers. The build does the same, with that exact
    table, extracted reproducibly by `scripts/extract-cdn-prefixes.mjs` into `build/`. This keeps,
    for example, `-webkit-backdrop-filter`. Without it, the blurred header and dialog backdrops would
    lose their blur on Safari/iOS before 18. Autoprefixer is pinned because its internal classes are
    used.
  - _Rule order among ties._ The CDN regenerated CSS whenever new classes appeared and appended each
    batch, so among tied utilities (same plugin and variant), a class first added by JavaScript came
    after one already in the markup. The build orders each run of tied rules the same way: classes
    from `index.html` first, JS-only classes after, alphabetical within each group. An audit of the
    original found 66 pairs of competing classes on real elements across the tour; with this rule
    every one resolves as in the original. Without it, two did not: a selected habit card in
    selection mode lost its tint, in light and dark.
- **CSS is not minified.** Vite 8's minifier (Lightning CSS) rewrites syntax, for example
  `@media (max-width: 767px)` into the range form `(width<=767px)`, which Safari before 16.4 ignores,
  and it reorders declarations. The CDN never minified either (about 16 kB gzipped).
- **Opening from disk.** Module scripts don't load from `file://`, so `npm run build:single` inlines
  everything into one `habit_tracker_dashboard.html`. Put it in place of the old file and the data
  carries over; this is verified in `e2e/smoke.spec.js`.
- **Dead code removed** (no observable effect):
  - `SCHEDULE_FIELDS` and `.ring-progress` (never used);
  - `focusOrderCache` (written, never read);
  - unused locals: `streak`, `weeklyPct`, `isWeeklyQuotaMet` and `goalLabel` in the habit card,
    `colorMeta` in the leaderboard, `color` in the habit grid, `isFlexible` in the weekly table;
  - three unused `getElementById`/`querySelector` results, and an unused parameter of `barFrom`;
  - `HEBREW_MONTHS_SHORT` was an exact copy of `HEBREW_MONTHS`, so it is now an alias.
- **Small mechanical changes:**
  - empty `catch (e) {}` became `catch {}`;
  - two `let`s that were never reassigned became `const`;
  - a never-read initial `let cls = ''` became `let cls;`;
  - Prettier formatting, with the original's quote style and 4-space indent.

## What could not be kept identical

- **First paint.** The CDN generated CSS asynchronously, after the page had started to render (that
  is what the skeleton covered). Now the stylesheet loads before the first paint, so the skeleton
  (same code) fades out almost at once. Also, the first time a class appeared later in a session (say,
  opening a dialog), the CDN needed a moment to generate it. That brief unstyled flash is gone.
- **Tie order is no longer session-dependent.** In the original, among tied utilities, the winner
  depended on the order in which classes first appeared during that session. The build fixes the
  order (see above). It matches the original for every competing pair seen in the tested states. A
  pair of JavaScript-only classes that compete in some state no test reaches would resolve
  alphabetically; the original could have resolved it either way.
- **Console.** The CDN's "should not be used in production" warning is gone.
- **`file://`.** The hosted build (`dist/`) needs a web server. Use the single-file build to open from
  disk.
- **`npm run dev`** loads each module separately, so in development only, boot is a little slower and
  idle-time work (prerendering hidden sections) can run later. Production builds are one script.

## Bugs and inconsistencies noticed (not fixed)

None of these were changed, because the refactor keeps behaviour identical. Several are pinned by
tests, so a future fix will show up as a deliberate test change.

1. **A stored weekday outside 0–6 deletes the habit.** For example, a hand-edited `fixedDays: [9]`
   makes schedule normalization throw. The habit is skipped on load ("Skipped a damaged habit"), and
   because loading commits, it is removed from storage.
2. **Reduced motion doesn't stop bar transitions.** `@media (prefers-reduced-motion)` sets
   `.bar-fill { transition: none }`, but an unconditional `.bar-fill { transition: … }` comes later
   with the same specificity and wins.
3. **The custom placeholder colour never applies in light mode.** `#5b6b82` (commented "4.9:1") loses
   to Tailwind's preflight `#9ca3af`, which the CDN injected after it.
4. **`.drop-chip`'s own transition** is overridden by the `.transition` utility on the same element.
5. **Categories with surrounding spaces count wrong.** Filtering trims the category
   (`getHabitCategoryDisplay`), but the counts on the filter pills and in the category manager compare
   the untrimmed value. `applyInvariants` adds the _trimmed_ name to the category list.
6. **Flexible streaks break on archived weeks.** A flexible habit's week streak breaks on weeks spent
   archived (paused), while a daily habit's streak skips paused days.
7. **Current and best streak disagree on long runs.** The current streak is capped at 365 days but
   the best streak looks back 730, so a long run can show a "record" larger than the current streak
   for the same run.
8. **Analytics presets don't follow midnight.** After midnight, `checkDayRollover` re-renders but
   doesn't recompute the analytics preset ranges ("השבוע", "7 ימים") until a reload.
9. **Unknown colour ids.** A stored colour id that isn't in `COLOR_OPTIONS` renders as indigo, but
   the habit form shows no colour selected, and saving keeps the unknown id.
10. **A list closes if opened mid-scroll.** Opening a list (custom select) while the habit form is
    still smooth-scrolling a section into view closes the list right away: any scroll outside an open
    list closes it.
11. **Dead parameter.** `selectDay(dateKey, jumpToTracker)`'s second parameter is never passed; the
    branch it guards is dead.
