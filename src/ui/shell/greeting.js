// The greeting above the title ("בוקר טוב"…), by the hour.

import { getGreetingByHour } from '../../core/format.js';

export function renderGreeting() {
    const el = document.getElementById('greetingLabel');
    const text = getGreetingByHour();
    if (el.textContent !== text) el.textContent = text;
}
