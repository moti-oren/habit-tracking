// Storage I/O: the only code that reads or writes localStorage. A write is skipped when the value
// hasn't changed since the last successful one; a failed write is reported ('quota' or 'unavailable')
// and the value is written again on the next commit.

const lastWritten = new Map();
let onPersistError = () => {};

/** Called when a write fails, with 'quota' (storage full) or 'unavailable' (blocked). */
export function setPersistErrorHandler(handler) {
    onPersistError = handler;
}

function isQuotaError(e) {
    return (
        !!e &&
        (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014)
    );
}
export function readItem(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn('Could not read', key, e);
        return null;
    }
}
export function readJson(key) {
    const raw = readItem(key);
    if (raw === null) return undefined;
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.warn('Ignoring damaged data in', key, e);
        return undefined;
    }
}
export function writeItem(key, value) {
    if (lastWritten.get(key) === value) return true; // unchanged since the last successful write
    try {
        localStorage.setItem(key, value);
        lastWritten.set(key, value);
        return true;
    } catch (e) {
        lastWritten.delete(key);
        console.warn('Could not persist', key, e);
        onPersistError(isQuotaError(e) ? 'quota' : 'unavailable');
        return false;
    }
}
