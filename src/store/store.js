// The Store: the only owner of the data (habits + categories), of every change to it, and of its
// sync to localStorage. The view reads through it and asks it to change things; it never edits the
// arrays or touches storage itself.

import { DEFAULT_CATEGORIES, UNCATEGORIZED_LABEL } from '../config/categories.js';
import { CATEGORIES_STORAGE_KEY, LEGACY_HABITS_KEY, PREFS_STORAGE_KEY, STORAGE_KEY } from '../config/storage-keys.js';
import { getDateKeyDaysAgo } from '../core/dates.js';
import { hasAnyMarkOnDay, isHabitArchived, isSlotDone, normalizeHabitGoal } from '../core/habit.js';
import { applyScheduleEdit, getScheduleVersion, slotCount } from '../core/schedule.js';
import { compareByName } from '../core/sort.js';
import { sanitizeCategories, sanitizeHabit } from './sanitize.js';
import { readItem, readJson, setPersistErrorHandler, writeItem } from './storage.js';

const KEYS = { habits: STORAGE_KEY, categories: CATEGORIES_STORAGE_KEY, prefs: PREFS_STORAGE_KEY };
let habits = [];
let categories = [...DEFAULT_CATEGORIES];
let revision = 0; // bumps on every commit
let revCounter = 0; // per-habit revisions come from here, so they are never reused
const habitRevs = new Map(); // id -> revision of that habit's content
const habitJson = new Map(); // id -> last serialized form (dirty checking)
let liveCache = { revision: -1, list: Object.freeze([]) };
let prefsProvider = () => null;

// ---- invariants + persistence ----
// Every habit's category exists, and both lists stay in alphabetical (Hebrew) order.
// This is part of the data model, applied explicitly on commit — never inside a read or a save.
function applyInvariants() {
    habits.forEach(h => {
        const cat = (h.category || '').trim();
        if (cat && cat !== UNCATEGORIZED_LABEL && !categories.includes(cat)) categories.push(cat);
    });
    habits.sort((a, b) => compareByName(a.name, b.name));
    categories.sort(compareByName);
}

// Serializes each habit once: the same strings are compared with the previous commit
// (dirty checking -> per-habit revisions) and joined into the stored array.
function persist() {
    const ids = new Set();
    const parts = habits.map(h => {
        const json = JSON.stringify(h);
        ids.add(h.id);
        if (habitJson.get(h.id) !== json) {
            habitJson.set(h.id, json);
            habitRevs.set(h.id, ++revCounter);
        }
        return json;
    });
    for (const id of habitJson.keys()) {
        if (!ids.has(id)) {
            habitJson.delete(id);
            habitRevs.delete(id);
        }
    }
    writeItem(KEYS.habits, `[${parts.join(',')}]`);
    writeItem(KEYS.categories, JSON.stringify(categories));
    const prefs = prefsProvider();
    if (prefs) writeItem(KEYS.prefs, JSON.stringify(prefs));
}

function commit() {
    applyInvariants();
    revision++;
    persist();
}

function find(id) {
    return habits.find(h => h.id === id) || null;
}

export const Store = {
    // ---- reads ----
    get habits() {
        return habits;
    },
    get categories() {
        return categories;
    },
    get revision() {
        return revision;
    },
    habitRevision(id) {
        return habitRevs.get(id);
    },
    find,
    liveHabits() {
        if (liveCache.revision !== revision) {
            liveCache = { revision, list: Object.freeze(habits.filter(h => !isHabitArchived(h))) };
        }
        return liveCache.list;
    },
    snapshot() {
        return { habits: JSON.parse(JSON.stringify(habits)), categories: JSON.parse(JSON.stringify(categories)) };
    },

    // ---- setup ----
    configure(opts) {
        if (opts.prefsProvider) prefsProvider = opts.prefsProvider;
        if (opts.onPersistError) setPersistErrorHandler(opts.onPersistError);
    },
    loadPrefs() {
        const prefs = readJson(KEYS.prefs);
        return prefs && typeof prefs === 'object' && !Array.isArray(prefs) ? prefs : null;
    },
    savePrefs(prefs) {
        writeItem(KEYS.prefs, JSON.stringify(prefs));
    },
    load(defaults) {
        const cats = sanitizeCategories(readJson(KEYS.categories));
        if (cats) categories = cats;
        let loaded = null;
        let raw = readItem(KEYS.habits);
        if (raw === null) raw = readItem(LEGACY_HABITS_KEY);
        if (raw !== null) {
            let parsed;
            try {
                parsed = JSON.parse(raw);
            } catch (e) {
                console.warn('Ignoring damaged habits data', e);
            }
            if (Array.isArray(parsed)) {
                const seen = new Set();
                // a damaged entry is skipped on its own instead of discarding everything
                loaded = parsed
                    .map((item, i) => {
                        try {
                            return sanitizeHabit(item, i, seen);
                        } catch (e) {
                            console.warn('Skipped a damaged habit', e);
                            return null;
                        }
                    })
                    .filter(Boolean);
            }
        }
        habits = loaded || defaults().map(normalizeHabitGoal);
        this.stripFuture(getDateKeyDaysAgo(0), false);
        commit();
    },

    // ---- mutations: each one changes the data and commits ----
    stripFuture(todayKey, save = true) {
        let removed = false;
        habits.forEach(h => {
            if (h.slotHistory)
                Object.keys(h.slotHistory).forEach(k => {
                    if (k > todayKey) {
                        delete h.slotHistory[k];
                        removed = true;
                    }
                });
            if (h.history && typeof h.history === 'object') {
                Object.keys(h.history).forEach(k => {
                    if (k > todayKey) {
                        delete h.history[k];
                        removed = true;
                    }
                });
            }
        });
        if (removed && save) commit();
    },
    toggleDay(id, dateKey, slot) {
        const habit = find(id);
        if (!habit) return null;
        if (!habit.history) habit.history = {};
        const n = slotCount(getScheduleVersion(habit, dateKey));
        let on, slotUsed;
        if (typeof slot === 'number' && n > 1) {
            // one occurrence; the day itself counts as done only when every occurrence is
            const marks = Array.from({ length: n }, (_, i) => isSlotDone(habit, dateKey, i));
            marks[slot] = !marks[slot];
            on = marks[slot];
            slotUsed = slot;
            if (!habit.slotHistory) habit.slotHistory = {};
            habit.slotHistory[dateKey] = marks;
            habit.history[dateKey] = marks.every(Boolean);
        } else {
            on = !habit.history[dateKey];
            habit.history[dateKey] = on;
            if (habit.slotHistory) delete habit.slotHistory[dateKey];
        }
        commit();
        return { on, slot: slotUsed };
    },
    markDay(ids, dateKey) {
        habits.forEach(h => {
            if (!ids.includes(h.id)) return;
            if (!h.history) h.history = {};
            h.history[dateKey] = true;
            if (h.slotHistory) delete h.slotHistory[dateKey];
        });
        commit();
    },
    clearDay(ids, dateKey) {
        habits.forEach(h => {
            if (!ids.includes(h.id) || !hasAnyMarkOnDay(h, dateKey)) return;
            if (!h.history) h.history = {};
            h.history[dateKey] = false;
            if (h.slotHistory) delete h.slotHistory[dateKey];
        });
        commit();
    },
    addHabit(draft) {
        const habit = normalizeHabitGoal(draft);
        habits.unshift(habit);
        commit();
        return habit;
    },
    updateHabit(id, fields, scheduleDef, scope) {
        const habit = find(id);
        if (!habit) return null;
        Object.assign(habit, fields);
        // scheduling fields only change through `schedule`
        applyScheduleEdit(habit, scheduleDef, scope);
        commit();
        return habit;
    },
    deleteHabits(ids) {
        habits = habits.filter(h => !ids.includes(h.id));
        commit();
    },
    archiveHabits(ids, todayKey, tomorrowKey) {
        let count = 0;
        ids.forEach(id => {
            const habit = find(id);
            if (!habit || isHabitArchived(habit)) return;
            habit.archivedSince = habit.history && habit.history[todayKey] ? tomorrowKey : todayKey;
            count++;
        });
        if (count) commit();
        return count;
    },
    restoreHabit(id, yesterdayKey) {
        const habit = find(id);
        if (!habit || !isHabitArchived(habit)) return false;
        if (habit.archivedSince <= yesterdayKey) {
            habit.pausedRanges = [...(habit.pausedRanges || []), [habit.archivedSince, yesterdayKey]];
        }
        delete habit.archivedSince;
        commit();
        return true;
    },
    moveHabits(ids, newCategory) {
        habits.forEach(h => {
            if (ids.includes(h.id)) h.category = newCategory;
        });
        commit();
    },
    addCategory(name) {
        categories.push(name);
        commit();
    },
    renameCategory(oldName, newName) {
        const idx = categories.indexOf(oldName);
        if (idx !== -1) categories[idx] = newName;
        habits.forEach(h => {
            if (h.category === oldName) h.category = newName;
        });
        commit();
    },
    deleteCategories(names) {
        categories = categories.filter(c => !names.includes(c));
        habits.forEach(h => {
            if (names.includes((h.category || '').trim())) h.category = '';
        });
        commit();
    },
    restore(snapshot) {
        habits = snapshot.habits.map(normalizeHabitGoal);
        categories = snapshot.categories;
        commit();
    },
    resetToDefaults(defaults) {
        categories = [...DEFAULT_CATEGORIES];
        habits = defaults().map(normalizeHabitGoal);
        commit();
    }
};
