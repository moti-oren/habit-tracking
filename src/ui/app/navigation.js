// Switching between the three sections (tracker, analytics, manage).

import { app } from '../../state/app.js';
import { manage } from '../../state/manage.js';
import { motion } from '../../state/motion.js';
import { savePrefs } from '../../state/prefs.js';
import { updateSegPills } from '../components/segmented.js';
import { renderGreeting } from '../shell/greeting.js';
import { renderSection } from './render.js';

export function switchMainSection(section) {
    if (section !== 'manage' && manage.selectMode) {
        manage.selectMode = false;
        manage.selectedHabitIds.clear();
    }
    app.currentMainSection = section;
    const sections = ['tracker', 'analytics', 'manage'];

    sections.forEach(s => {
        const sectionEl = document.getElementById(`section_${s}`);
        if (sectionEl) {
            sectionEl.classList.toggle('hidden', s !== section);
        }

        // Desktop Nav Button styling
        const navBtn = document.getElementById(`navTab_${s}`);
        if (navBtn) {
            if (s === section) navBtn.setAttribute('aria-current', 'page');
            else navBtn.removeAttribute('aria-current');
            if (s === section) {
                navBtn.className =
                    'h-10 px-4 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 text-indigo-700 dark:text-indigo-300';
            } else {
                navBtn.className =
                    'h-10 px-4 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-2';
            }
        }

        // Mobile Bottom Nav styling
        const mobileBtn = document.getElementById(`mobileNav_${s}`);
        if (mobileBtn) {
            if (s === section) mobileBtn.setAttribute('aria-current', 'page');
            else mobileBtn.removeAttribute('aria-current');
            if (s === section) {
                mobileBtn.className =
                    'flex flex-col items-center justify-center py-2 rounded-xl text-xs font-semibold text-indigo-700 dark:text-indigo-300 transition';
            } else {
                mobileBtn.className =
                    'flex flex-col items-center justify-center py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition';
            }
        }
    });

    if (section === 'analytics') motion.analyticsEntryAnim = true;
    // restart the icon bounce: remove everywhere, one reflow, add everywhere
    const navIcons = [...document.querySelectorAll(`#navTab_${section} svg, #mobileNav_${section} svg`)];
    navIcons.forEach(svg => svg.classList.remove('nav-bounce'));
    if (navIcons.length) void navIcons[0].getBoundingClientRect();
    navIcons.forEach(svg => svg.classList.add('nav-bounce'));
    updateSegPills(document.querySelectorAll('.seg'));

    savePrefs();
    renderGreeting();
    renderSection(section, { force: true, entry: true });
}
