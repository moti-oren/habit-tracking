// Backups: the habits and categories as one JSON file, and reading such a file back. A backup is
// checked the way stored data is on load (sanitize.js): it may be old, edited by hand, or not a
// backup at all, and nothing reaches the Store until it has been read in full.

import { getDateKeyDaysAgo } from '../core/dates.js';
import { sanitizeCategories, sanitizeHabit } from './sanitize.js';

export const BACKUP_FORMAT = 'habit-tracker-backup';
export const BACKUP_VERSION = 1;
// Far above any real data (five months of nine habits is about 16 KB), far below a stuck tab
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/** The backup of a Store snapshot ({ habits, categories }), as the text of the file. */
export function createBackup(snapshot, exportedAt = new Date()) {
    const backup = {
        format: BACKUP_FORMAT,
        version: BACKUP_VERSION,
        exportedAt: exportedAt.toISOString(),
        habits: snapshot.habits,
        categories: snapshot.categories
    };
    return JSON.stringify(backup, null, 2);
}

/** The name the backup is saved under, with today's date. */
export function backupFileName() {
    return `habit-tracker-backup-${getDateKeyDaysAgo(0)}.json`;
}

const fail = error => ({ ok: false, error });

/**
 * Reads the text of a backup file.
 * Also accepts a bare array of habits: the value the app keeps in localStorage.
 * @returns {{ ok: true, habits: object[], categories: string[] | null, exportedAt: string | null,
 *             summary: { habits: number, archived: number, marks: number } } | { ok: false, error: string }}
 */
export function parseBackup(text) {
    if (typeof text === 'string' && text.length > MAX_BACKUP_BYTES) {
        return fail('הקובץ גדול מדי בשביל גיבוי של האפליקציה.');
    }
    if (typeof text !== 'string' || !text.trim()) return fail('הקובץ ריק.');
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        return fail('הקובץ אינו קובץ JSON תקין.');
    }

    let rawHabits;
    let rawCategories = null;
    let exportedAt = null;
    if (Array.isArray(data)) {
        rawHabits = data;
    } else if (data && typeof data === 'object' && data.format === BACKUP_FORMAT) {
        if (!Number.isInteger(data.version) || data.version < 1) return fail('גרסת הגיבוי בקובץ אינה תקינה.');
        if (data.version > BACKUP_VERSION) {
            return fail('הגיבוי נוצר בגרסה חדשה יותר של האפליקציה, ואי אפשר לקרוא אותו כאן.');
        }
        if (!Array.isArray(data.habits)) return fail('בקובץ הגיבוי חסרה רשימת ההרגלים.');
        rawHabits = data.habits;
        rawCategories = data.categories;
        if (typeof data.exportedAt === 'string' && !isNaN(Date.parse(data.exportedAt))) exportedAt = data.exportedAt;
    } else {
        return fail('זה לא קובץ גיבוי של מעקב ההרגלים.');
    }

    // a damaged entry is skipped on its own, as on load; a file of nothing but damage is refused
    const seen = new Set();
    const habits = rawHabits
        .map((item, i) => {
            try {
                return sanitizeHabit(item, i, seen);
            } catch {
                return null;
            }
        })
        .filter(Boolean);
    if (rawHabits.length > 0 && habits.length === 0) return fail('לא נמצאו בקובץ הרגלים תקינים.');

    const marks = habits.reduce((n, h) => n + Object.values(h.history).filter(Boolean).length, 0);
    return {
        ok: true,
        habits,
        categories: sanitizeCategories(rawCategories),
        exportedAt,
        summary: { habits: habits.length, archived: habits.filter(h => h.archivedSince).length, marks }
    };
}
