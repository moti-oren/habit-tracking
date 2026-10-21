// Seeded random habits for the logic parity test: valid, old-format, hand-edited and damaged.
// The same seed always produces the same data, so a failure can be replayed.

export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const NAMES = ['קריאה', 'ריצה', 'מים', 'מדיטציה', 'גיטרה', 'יומן', 'שינה', 'ויטמינים', 'Yoga', '10K steps', 'אנגלית'];
const CATEGORIES = ['כושר', 'בריאות', 'למידה', ' כושר ', '', 'ערב', 'פוקוס'];
const ICONS = ['🏋️', '📚', '💧', '🧘', '🎸', '✍️', '🏃‍♀️', '👨‍👩‍👧', '<b>', '', 'x'.repeat(40)];
const COLORS = ['indigo', 'teal', 'orange', 'pink', 'sky', 'purple', 'emerald', 'rose', 'cyan', 'amber', 'red', 7];
const TIMES = ['06:00', '07:30', '12:00', '12:15', '18:45', '21:00', '23:30', '', '7:00', '25:00', null];
const DURATIONS = [0, 5, 15, 30, 45, 60, 90, 2000, -5, '20', 'x', undefined];

export function makeGenerator(seed) {
    const rng = mulberry32(seed);
    const int = (a, b) => a + Math.floor(rng() * (b - a + 1));
    const pick = arr => arr[int(0, arr.length - 1)];
    const chance = p => rng() < p;
    const subset = (arr, p = 0.5) => arr.filter(() => chance(p));
    const pad = n => String(n).padStart(2, '0');
    // date keys around 21 Oct 2026, built without Date (no time zone involved)
    const keyAt = offset => {
        const t = Date.UTC(2026, 9, 21) + offset * 86400000;
        const d = new Date(t);
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    };
    const dateOrJunk = (from, to) => (chance(0.9) ? keyAt(int(from, to)) : pick(['2026-1-1', 'soon', 20261010, null]));

    function scheduleFields() {
        const f = {};
        if (chance(0.85)) f.goalType = pick(['daily', 'flexible', 'fixed_days', 'fixed_days', 'weird']);
        if (chance(0.7)) f.fixedDays = chance(0.02) ? [9] : subset([0, 1, 2, 3, 4, 5, 6], 0.45);
        if (chance(0.6)) f.weeklyGoal = pick([1, 2, 3, 4, 5, 6, 7, 9, 0, '3']);
        const shape = int(0, 9);
        if (shape <= 4) f.time = pick(TIMES);
        else if (shape <= 6) f.slotTimes = Array.from({ length: int(1, 5) }, () => pick(TIMES));
        else if (shape <= 8) {
            f.dayTimes = Array.from({ length: chance(0.95) ? 7 : 3 }, () =>
                chance(0.2) ? pick(TIMES) : Array.from({ length: int(0, 3) }, () => pick(TIMES))
            );
        }
        if (chance(0.7)) f.duration = pick(DURATIONS);
        return f;
    }

    function history(from, to, p) {
        const h = {};
        for (let o = from; o <= to; o++) if (chance(p)) h[keyAt(o)] = chance(0.8) ? true : pick([false, 0, 1, 'yes']);
        if (chance(0.1)) h.bad = true;
        return h;
    }

    function habit(i) {
        const h = {};
        h.id = chance(0.9) ? `h${i}` : pick([`h_${1767225600000 + i * 86400000}`, 'bad id', `h${i - 1}`, 42]);
        h.name = chance(0.92) ? `${pick(NAMES)} ${i}` : pick(['', '   ', 7, 'n'.repeat(130)]);
        if (chance(0.85)) h.category = pick(CATEGORIES);
        if (chance(0.4)) h.note = chance(0.9) ? `note ${i}` : pick([5, 'n'.repeat(320)]);
        h.icon = pick(ICONS);
        h.color = pick(COLORS);
        if (chance(0.45)) {
            Object.assign(h, scheduleFields());
        } else {
            h.schedule = Array.from({ length: int(1, 4) }, (_, j) => ({
                from: j === 0 && chance(0.7) ? null : dateOrJunk(-200, 5),
                ...scheduleFields()
            }));
            if (chance(0.05)) h.schedule.push(null, 'x');
        }
        h.history = chance(0.97) ? history(-150, 3, int(1, 9) / 10) : pick([[true], 'x', null]);
        if (chance(0.2)) {
            h.slotHistory = {};
            for (let o = -20; o <= 2; o++) {
                if (chance(0.4)) h.slotHistory[keyAt(o)] = Array.from({ length: int(1, 4) }, () => chance(0.6));
            }
            if (chance(0.1)) h.slotHistory.bad = [true];
            if (chance(0.05)) h.slotHistory = 'broken';
        }
        if (chance(0.75)) h.startDate = dateOrJunk(-180, 0);
        if (chance(0.15)) h.archivedSince = dateOrJunk(-60, 1);
        if (chance(0.15)) {
            h.pausedRanges = [
                [keyAt(int(-100, -60)), keyAt(int(-59, -30))],
                ...(chance(0.3) ? [['x'], [keyAt(-5)]] : [])
            ];
        }
        return h;
    }

    return {
        rng,
        int,
        pick,
        chance,
        keyAt,
        scheduleFields,
        habits: n => [...Array.from({ length: n }, (_, i) => habit(i)), ...(chance(0.3) ? [null, 'junk', []] : [])],
        categories: () => (chance(0.8) ? [...subset(CATEGORIES, 0.6), ...(chance(0.2) ? [5, null, 'הכל'] : [])] : 'x')
    };
}
