# מעקב הרגלים — Habit Tracker

A daily and weekly habit tracker dashboard, in Hebrew (RTL). You mark habits off per day, see your
week at a glance, follow streaks and trends in analytics, and manage habits and categories. Habits
can be every day, a number of days a week, or fixed weekdays, with optional times (also several
times a day, or a different time per weekday), and their schedule can change over time without
rewriting the past. Everything is stored in the browser's `localStorage`; there is no server.

It is vanilla JavaScript (ES modules), built with Vite and styled with Tailwind CSS. It was
refactored from a single 7,400-line HTML file (kept in `legacy/` as the reference) with no change
in behaviour, appearance or stored data. See [REFACTOR_NOTES.md](REFACTOR_NOTES.md).

## Using it

The app is a single page. You can open it from disk, like the original:

```bash
npm run build:single
```

This writes `dist-single/habit_tracker_dashboard.html`, one self-contained file. **Put it in place
of the old `habit_tracker_dashboard.html` (same folder, same name).** Your data is kept: browsers
store `localStorage` per origin, and for local files the safest way to keep the same origin is to
keep the same path. (Chrome and Edge share one storage for all local files; Firefox is stricter.)

To host it instead, `npm run build` writes a regular multi-file build to `dist/`. Data saved on one
origin (a URL, or local files) is not visible from another.

The fonts load from Google Fonts, so the first load needs internet, as before.

## Development

Requirements: Node.js 22.12 or newer.

```bash
npm install
```

```bash
npm run dev
```

| Command                           | What it does                                                     |
| --------------------------------- | ---------------------------------------------------------------- |
| `npm run dev`                     | Dev server with hot reload                                       |
| `npm run build`                   | Production build into `dist/`                                    |
| `npm run build:single`            | One self-contained HTML file in `dist-single/` (opens from disk) |
| `npm run preview`                 | Serves `dist/`                                                   |
| `npm run lint`                    | ESLint, including the import-layer rules below                   |
| `npm run format` / `format:check` | Prettier                                                         |
| `npm test`                        | Unit tests and logic parity (Vitest)                             |
| `npm run test:e2e`                | Browser tests (Playwright; needs internet, see below)            |
| `npm run check:deps`              | No circular imports (madge)                                      |
| `npm run verify`                  | All of the above except the browser tests, then both builds      |

Before the first `npm run test:e2e`, install the browser once:

```bash
npx playwright install chromium
```

## Folder structure

```
index.html            the page: markup, the pre-paint theme script and the skeleton's critical CSS
src/
  main.js             entry point: wires listeners in a fixed order, then boots
  config/             constants: storage keys, categories, icons, colours, Hebrew names, presets
  core/               pure logic, no DOM: dates, time, schedules, habits, statistics, overlaps,
                      analytics ranges, user-facing labels
  store/              the Store (data, validation, persistence, invariants) and values cached on it
  state/              UI state shared between modules (sealed objects) and the one-render motion hints
  audio/              feedback sounds
  ui/
    dom/              HTML helpers, icons, DOM patching, animation and FLIP helpers
    components/       modal, toast, tooltip, menus, segmented pill, reveal, scroll fades, custom select
    shell/            theme, sound, greeting
    sections/         tracker/, analytics/, manage/: renderers and actions
    dialogs/          habit form, category manager, calendar (also the date and range picker), confirm
    app/              render orchestration, section switching, boot and day rollover, undo
  events/             the action tables (data-action → function) and the global listeners
  styles/             custom CSS (tokens, base, components, animations, reduced motion), then Tailwind
tests/
  unit/core, unit/store     unit tests, each run against the original AND the refactored code
  parity/                   logic parity with the original on random data
  harness/                  loads the original file and the refactored modules side by side
e2e/                  Playwright smoke tests of both builds
scripts/              extraction of the CDN's prefix table
build/                autoprefixer's prefix table of the Tailwind CDN the original used
legacy/               the original single-file app (the reference for the parity tests)
```

## The dependency rule

Each layer may import only from the layers before it:

```
config → core → store → state → audio → ui → events → main
```

- `core/` (and `config/`, `state/`) cannot touch the DOM: ESLint gives them only the built-in
  JavaScript globals, so `document`, `window` or `localStorage` there is a lint error.
- Only `store/storage.js` reads or writes `localStorage` for data. The pre-paint theme script in
  `index.html` also reads the preferences, before anything else runs.
- Inside `ui/`: `dom → components → shell → renderers → app → actions and dialogs`. A renderer
  never imports an action, a dialog or `ui/app/`. That is what keeps `ui/` free of import cycles.
- No module does anything when it is imported. Every listener, observer and timer is started by a
  call in `src/main.js`, in a fixed order (listeners on the same target run in the order they were
  added, and the app relies on it).
- No circular imports: `npm run check:deps` and ESLint's `import-x/no-cycle` check it.

## How the code is organised

- **Rendering.** A change marks all three sections stale and redraws only the visible one
  (`ui/app/render.js`). Renderers build HTML strings and apply them with `patchHTML`
  (`ui/dom/patch.js`), which only touches nodes that changed, so focus, hover and running animations
  survive a re-render.
- **Events.** The markup names what should happen (`data-action`, `data-change`, `data-input`,
  `data-keydown`, `data-submit`), with arguments in `data-id`, `data-key`, `data-arg`, and so on.
  One delegated listener per event type looks the name up in `events/click-actions.js` and
  `events/form-actions.js`.
- **State.** Shared UI state lives in sealed objects in `state/`, so a misspelled property throws.
  Changes that must happen together have setters (for example `setWeek()`). Motion hints
  (`state/motion.js`) are set right before a render and reset right after; that timing drives the
  animations.
- **Data.** The Store (`store/store.js`) is the only owner of habits and categories. Every change
  goes through it, commits, and bumps a revision. Values computed from the data are cached on that
  revision (`store/selectors.js`).

## Tests

- **Unit tests** (`tests/unit`) run every case against both the original file and the refactored
  modules, so they also prove that both behave the same.
- **Logic parity** (`tests/parity`) compares every statistic and label with the original's on
  seeded random (and damaged) data.
- **Browser tests** (`e2e/`) cover the main flows on both builds, the intro screen, and the
  single-file build taking over the data the original file saved. They need internet (Google Fonts,
  and the original's Tailwind CDN).
- **The refactor itself** was verified by stricter suites that required the interface to stay
  identical to the original: DOM, markup and CSS parity, and pixel-level visual parity in the
  browser. The app has moved on since, so they live at the `refactor-verified` tag; see
  [REFACTOR_NOTES.md](REFACTOR_NOTES.md).
