// The sample habits a new user starts with (and "reset to sample data" restores): five months of
// believable use, so every screen has something to show on the first visit. Between them they use
// every kind of schedule the app has: daily, fixed days, flexible weekly goals, several times a
// day, times that differ by weekday, a schedule change, a past pause and an archived habit.
//
// Histories are relative to today, and drawn from hashes rather than Math.random: the same day
// always gives the same data. It only looks random.

import { dowOfKey, getDateKeyDaysAgo } from '../core/dates.js';

const SUN_TO_THU = [0, 1, 2, 3, 4];
// A week away, about seven weeks ago: most habits slip, the easiest ones hold.
const VACATION = { from: 52, to: 46 };

/** A number in [0, 1) that depends only on its parts (FNV-1a, then MurmurHash3's final mix). */
function chance(...parts) {
    const s = parts.join('|');
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    // without the mix, keys that differ only at the end (consecutive dates) get close values
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 0x100000000;
}

/*
 * How each habit is used. Ages are in days before today.
 *   versions   schedule versions; `since` = from how many days ago (the first has none)
 *   rate       chance of doing it on a due day (of meeting the goal in a week, for a flexible
 *              goal): [when it started, today]; it improves over time
 *   weekend    added to the rate on Friday and Saturday
 *   streak     the last N due days before today are all done (full weeks, for a flexible goal)
 *   today      today's mark (true / false, or one per occurrence)
 *   slotRates  for several times a day: a rate per occurrence instead of `rate`
 *   paused     [from, to] days ago: archived for a while, then restored
 *   archived   archived since that many days ago
 *   vacation   how much of the rate is left during the vacation
 */
const SPECS = [
    {
        id: 'h1',
        name: 'שתיית 2.5 ליטר מים',
        category: 'בריאות',
        note: 'בקבוק ליד המחשב, ועוד אחד בתיק',
        icon: '💧',
        color: 'sky',
        started: 150,
        versions: [{ goalType: 'daily' }],
        rate: [0.82, 0.95],
        streak: 41,
        today: true,
        vacation: 0.85
    },
    {
        id: 'h2',
        name: 'אימון כוח',
        category: 'כושר',
        note: 'סקוואט, מתח, לחיצת חזה וליבה',
        icon: '🏋️',
        color: 'teal',
        started: 140,
        // twice a week at first, three times from five weeks ago
        versions: [
            { goalType: 'fixed_days', fixedDays: [0, 3], time: '07:00', duration: 45 },
            { since: 35, goalType: 'fixed_days', fixedDays: [0, 2, 4], time: '07:00', duration: 45 }
        ],
        rate: [0.6, 0.88],
        streak: 6,
        vacation: 0.2
    },
    {
        id: 'h3',
        name: 'ריצה',
        category: 'כושר',
        note: '5 ק״מ בקצב נוח, אינטרוולים פעם בשבוע',
        icon: '🏃',
        color: 'orange',
        started: 130,
        // earlier on weekdays, later on the weekend
        versions: [
            {
                goalType: 'flexible',
                weeklyGoal: 3,
                dayTimes: [['06:30'], ['06:30'], ['06:30'], ['06:30'], ['06:30'], ['08:00'], ['08:00']],
                duration: 40
            }
        ],
        rate: [0.62, 0.85],
        streak: 5,
        // a sprained ankle
        paused: [74, 60],
        vacation: 0.3
    },
    {
        id: 'h4',
        name: 'קריאה לפני השינה',
        category: 'למידה',
        note: '20 עמודים, בלי מסכים',
        icon: '📚',
        color: 'indigo',
        started: 150,
        versions: [{ goalType: 'daily', time: '22:00', duration: 30 }],
        rate: [0.5, 0.78],
        weekend: 0.12,
        streak: 4,
        vacation: 0.9
    },
    {
        id: 'h5',
        name: 'מדיטציה',
        category: 'מיינדפולנס',
        note: '10 דקות נשימה מודעת',
        icon: '🧘',
        color: 'purple',
        started: 45,
        versions: [{ goalType: 'daily', slotTimes: ['07:15', '21:30'], duration: 10 }],
        slotRates: [
            [0.55, 0.92],
            [0.4, 0.75]
        ],
        streak: 4,
        today: [true, false]
    },
    {
        id: 'h6',
        name: 'אנגלית באפליקציה',
        category: 'למידה',
        note: 'שיעור אחד ביום, חזרה על מילים בסופ״ש',
        icon: '🗣️',
        color: 'pink',
        started: 95,
        versions: [{ goalType: 'flexible', weeklyGoal: 5 }],
        rate: [0.7, 0.9],
        streak: 5,
        vacation: 0.6
    },
    {
        id: 'h7',
        name: 'עבודה עמוקה ללא טלפון',
        category: 'פוקוס',
        note: 'הטלפון בחדר אחר, התראות כבויות',
        icon: '🎯',
        color: 'teal',
        started: 120,
        versions: [{ goalType: 'fixed_days', fixedDays: SUN_TO_THU, time: '09:00', duration: 90 }],
        rate: [0.55, 0.82],
        vacation: 0
    },
    {
        id: 'h8',
        name: 'ויטמינים',
        category: 'בריאות',
        note: 'D3 ואומגה 3 עם ארוחת הבוקר',
        icon: '💊',
        color: 'sky',
        started: 110,
        versions: [{ goalType: 'daily', time: '08:00' }],
        rate: [0.88, 0.96],
        streak: 23,
        today: true,
        vacation: 0.7
    },
    {
        id: 'h9',
        name: 'בלי מתוק אחרי 20:00',
        category: 'בריאות',
        note: 'הוחלף בפרי או בתה',
        icon: '🍫',
        color: 'orange',
        started: 140,
        versions: [{ goalType: 'daily' }],
        rate: [0.45, 0.62],
        archived: 33,
        vacation: 0.3
    }
];

// The days of the week a version is due (a flexible goal can be met on any day)
const dueDays = v => (v.goalType === 'fixed_days' ? v.fixedDays : [0, 1, 2, 3, 4, 5, 6]);

function versionOn(spec, daysAgo) {
    let current = spec.versions[0];
    for (const v of spec.versions) if (v.since !== undefined && v.since >= daysAgo) current = v;
    return current;
}

const inVacation = daysAgo => daysAgo <= VACATION.from && daysAgo >= VACATION.to;

// The rate `daysAgo` days ago: it moves from the first value to the last as the habit matures.
function rateOn(spec, [first, last], daysAgo, key) {
    let p = first + (last - first) * (1 - daysAgo / spec.started);
    const dow = dowOfKey(key);
    if (spec.weekend && (dow === 5 || dow === 6)) p += spec.weekend;
    if (inVacation(daysAgo)) p *= spec.vacation ?? 0.5;
    return Math.min(1, Math.max(0, p));
}

/*
 * Marks that follow a rate closely without looking regular: what is owed carries over from day
 * to day (error diffusion), and a hashed threshold decides on which day it is paid. Independent
 * draws would leave a few weeks of history at the mercy of luck.
 */
function diffuser(...seed) {
    let owed = 0;
    return (p, key) => {
        const mark = owed + p >= 0.5 + (chance(...seed, key) - 0.5) * 0.9;
        owed += p - (mark ? 1 : 0);
        return mark;
    };
}

// Daily and fixed-days habits: each due day is done or not (or each occurrence of it)
function markDays(spec, days, history, slotHistory) {
    const draws = (spec.slotRates || [spec.rate]).map((_, i) => diffuser(spec.id, i));
    for (const { daysAgo, key } of days) {
        if (slotHistory) {
            const marks = spec.slotRates.map((r, i) => draws[i](rateOn(spec, r, daysAgo, key), key));
            slotHistory[key] = marks;
            if (marks.every(Boolean)) history[key] = true;
        } else if (draws[0](rateOn(spec, spec.rate, daysAgo, key), key)) {
            history[key] = true;
        }
    }
    // the streak: the last due days before today, all done
    const streakDays = spec.streak ? days.slice(-spec.streak) : [];
    for (const { key } of streakDays) {
        history[key] = true;
        if (slotHistory) slotHistory[key] = spec.slotRates.map(() => true);
    }
}

// Flexible habits: each week the goal is met (sometimes beaten) or missed, then the days are picked
function markWeeks(spec, days, history) {
    const weeks = new Map();
    for (const day of days) {
        const sunday = getDateKeyDaysAgo(day.daysAgo + dowOfKey(day.key));
        if (!weeks.has(sunday)) weeks.set(sunday, []);
        weeks.get(sunday).push(day);
    }
    const list = [...weeks.entries()];
    const thisWeek = getDateKeyDaysAgo(dowOfKey(getDateKeyDaysAgo(0)));
    let fullWeeksLeft = spec.streak || 0;
    for (let w = list.length - 1; w >= 0; w--) {
        const [sunday, weekDays] = list[w];
        const goal = versionOn(spec, weekDays[0].daysAgo).weeklyGoal;
        const full = sunday !== thisWeek && weekDays.length === 7;
        let count;
        if (!full) {
            // a week cut short (the first, the current one, or around a pause): its share of the goal
            count = Math.round((goal * weekDays.length) / 7);
        } else {
            const p = rateOn(spec, spec.rate, weekDays[3].daysAgo, weekDays[3].key);
            const met = fullWeeksLeft-- > 0 || chance(spec.id, sunday, 'met') < p;
            const extra = chance(spec.id, sunday, 'extra');
            count = met ? goal + (extra < 0.25 ? 1 : 0) : goal - (extra < 0.4 ? 2 : 1);
        }
        weekDays
            .map(day => ({ day, order: chance(spec.id, day.key, 'pick') }))
            .sort((a, b) => a.order - b.order)
            .slice(0, Math.max(0, count))
            .forEach(({ day }) => (history[day.key] = true));
    }
}

function buildHabit(spec) {
    const history = {};
    const slotHistory = spec.slotRates ? {} : null;

    // the due days before today, oldest first (none while paused or after the archive)
    const days = [];
    for (let daysAgo = spec.started; daysAgo >= 1; daysAgo--) {
        if (spec.archived !== undefined && daysAgo <= spec.archived) break;
        if (spec.paused && daysAgo <= spec.paused[0] && daysAgo >= spec.paused[1]) continue;
        const key = getDateKeyDaysAgo(daysAgo);
        if (dueDays(versionOn(spec, daysAgo)).includes(dowOfKey(key))) days.push({ daysAgo, key });
    }
    if (versionOn(spec, 0).goalType === 'flexible') markWeeks(spec, days, history);
    else markDays(spec, days, history, slotHistory);

    const todayKey = getDateKeyDaysAgo(0);
    if (Array.isArray(spec.today)) {
        slotHistory[todayKey] = spec.today;
        if (spec.today.every(Boolean)) history[todayKey] = true;
    } else if (spec.today) {
        history[todayKey] = true;
    }

    const schedule = spec.versions.map(({ since, ...fields }) => ({
        from: since === undefined ? null : getDateKeyDaysAgo(since),
        ...fields
    }));
    const startDate = getDateKeyDaysAgo(spec.started);
    const habit = {
        id: spec.id,
        name: spec.name,
        category: spec.category,
        note: spec.note,
        icon: spec.icon,
        color: spec.color,
        ...schedule[schedule.length - 1],
        schedule,
        startDate,
        history
    };
    delete habit.from;
    if (slotHistory) habit.slotHistory = slotHistory;
    if (spec.paused) habit.pausedRanges = [[getDateKeyDaysAgo(spec.paused[0]), getDateKeyDaysAgo(spec.paused[1])]];
    if (spec.archived !== undefined) habit.archivedSince = getDateKeyDaysAgo(spec.archived);
    return habit;
}

export function getDefaultHabits() {
    return SPECS.map(buildHabit);
}
