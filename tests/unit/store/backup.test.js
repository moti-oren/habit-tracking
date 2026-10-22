// Backups: what is exported reads back as the same data, and a file that is not a usable backup is
// refused with a message saying why. "Today" is Wednesday 21 Oct 2026.
import { describe, expect, it, vi } from 'vitest';
import { NOW } from '../../harness/impls.js';
import {
    BACKUP_FORMAT,
    BACKUP_VERSION,
    MAX_BACKUP_BYTES,
    backupFileName,
    createBackup,
    parseBackup
} from '../../../src/store/backup.js';
import { getDefaultHabits } from '../../../src/store/sample-habits.js';
import { DEFAULT_CATEGORIES } from '../../../src/config/categories.js';
import { normalizeHabitGoal } from '../../../src/core/habit.js';

vi.useFakeTimers({ now: NOW });

const snapshot = () => ({
    habits: JSON.parse(JSON.stringify(getDefaultHabits().map(normalizeHabitGoal))),
    categories: [...DEFAULT_CATEGORIES, 'ערב']
});
const fileOf = obj => JSON.stringify(obj);

describe('backups', () => {
    it('read back exactly what was exported, with a summary', () => {
        const snap = snapshot();
        const text = createBackup(snap, new Date('2026-10-21T07:00:00Z'));
        const backup = JSON.parse(text);
        expect(backup).toMatchObject({ format: BACKUP_FORMAT, version: BACKUP_VERSION });
        expect(backup.exportedAt).toBe('2026-10-21T07:00:00.000Z');

        const read = parseBackup(text);
        expect(read.ok).toBe(true);
        expect(read.habits).toEqual(snap.habits);
        expect(read.categories).toEqual(snap.categories);
        expect(read.exportedAt).toBe('2026-10-21T07:00:00.000Z');
        const marks = snap.habits.reduce((n, h) => n + Object.values(h.history).filter(Boolean).length, 0);
        expect(read.summary).toEqual({ habits: 9, archived: 1, marks });
    });

    it('are saved under a name with today’s date', () => {
        expect(backupFileName()).toBe('habit-tracker-backup-2026-10-21.json');
    });

    it('also accept the bare list of habits the app keeps in the browser', () => {
        const read = parseBackup(fileOf(snapshot().habits));
        expect(read.ok).toBe(true);
        expect(read.habits).toHaveLength(9);
        expect(read.categories).toBe(null);
        expect(read.exportedAt).toBe(null);
    });

    it('repair damaged entries the way loading does, and skip the unusable ones', () => {
        const read = parseBackup(
            fileOf({
                format: BACKUP_FORMAT,
                version: 1,
                habits: [
                    { id: 'a', name: 'קריאה', startDate: '2026-10-01', history: { '2026-10-20': true, nope: true } },
                    { id: 'a', name: 'אותו מזהה', startDate: '2026-10-01' },
                    'not a habit',
                    null
                ],
                categories: ['למידה', 'הכל', 42, '']
            })
        );
        expect(read.ok).toBe(true);
        expect(read.habits.map(h => h.name)).toEqual(['קריאה', 'אותו מזהה']);
        expect(new Set(read.habits.map(h => h.id)).size).toBe(2);
        expect(read.habits[0].history).toEqual({ '2026-10-20': true });
        expect(read.categories).toEqual(['למידה', '42']);
    });

    it('accept an empty backup (no habits at all)', () => {
        const read = parseBackup(createBackup({ habits: [], categories: [] }));
        expect(read).toMatchObject({ ok: true, habits: [], summary: { habits: 0, archived: 0, marks: 0 } });
    });

    it.each([
        ['an empty file', '', 'הקובץ ריק.'],
        ['spaces only', '   \n', 'הקובץ ריק.'],
        ['not JSON', '{"format":', 'הקובץ אינו קובץ JSON תקין.'],
        ['some other JSON', fileOf({ hello: 'world' }), 'זה לא קובץ גיבוי של מעקב ההרגלים.'],
        ['a number', '42', 'זה לא קובץ גיבוי של מעקב ההרגלים.'],
        [
            'a newer version',
            fileOf({ format: BACKUP_FORMAT, version: BACKUP_VERSION + 1, habits: [] }),
            'הגיבוי נוצר בגרסה חדשה יותר של האפליקציה, ואי אפשר לקרוא אותו כאן.'
        ],
        [
            'a broken version',
            fileOf({ format: BACKUP_FORMAT, version: '1', habits: [] }),
            'גרסת הגיבוי בקובץ אינה תקינה.'
        ],
        ['no habits list', fileOf({ format: BACKUP_FORMAT, version: 1 }), 'בקובץ הגיבוי חסרה רשימת ההרגלים.'],
        ['nothing usable', fileOf([1, 'x', null]), 'לא נמצאו בקובץ הרגלים תקינים.'],
        ['too large', ' '.repeat(MAX_BACKUP_BYTES + 1), 'הקובץ גדול מדי בשביל גיבוי של האפליקציה.']
    ])('refuse %s, saying why', (_, text, error) => {
        expect(parseBackup(text)).toEqual({ ok: false, error });
    });
});
