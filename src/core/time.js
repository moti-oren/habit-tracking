// Time of day: "HH:MM" strings, minutes, ranges and parts of the day.
import { DAY_PARTS } from '../config/schedule.js';

// ---- Time of day helpers ----
export function timeToMinutes(time) {
    const [h, m] = String(time).split(':').map(Number);
    return h * 60 + m;
}

export function minutesToTime(min) {
    const v = ((min % 1440) + 1440) % 1440;
    return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

// "06:00" or "06:00–07:30"
export function formatTimeRange(time, duration) {
    if (!time) return '';
    return duration > 0 ? `${time}–${minutesToTime(timeToMinutes(time) + duration)}` : time;
}

// Times read left-to-right inside Hebrew text: isolate them so they don't flip
export function timeRangeText(time, duration) {
    return `\u2066${formatTimeRange(time, duration)}\u2069`;
}

// Block on the day: [start, start + max(1, duration)) in minutes
export function timeBlock(time, duration) {
    const start = timeToMinutes(time);
    return [start, start + Math.max(1, duration || 0)];
}

export function dayPartOf(time) {
    const m = timeToMinutes(time);
    return DAY_PARTS.find(p => m < p.until);
}
