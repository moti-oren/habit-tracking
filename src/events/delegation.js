// One delegated listener per event type on <body> dispatches to the action tables.

import { ClickActions } from './click-actions.js';
import { ChangeActions, InputActions, KeyActions, SubmitActions } from './form-actions.js';

// change / input / keydown / submit: every named element on the path runs, innermost first
// (the same order handlers on those elements had)
function runAlongPath(e, attr, table) {
    for (let el = e.target; el && el.nodeType === 1; el = el.parentElement) {
        const name = el.getAttribute(attr);
        if (name && table[name]) table[name](el, e);
    }
}

// click: the innermost element with an action handles it. An ancestor marked
// data-stop-propagation (an open menu panel) keeps the click from outer actions and
// from the document-level "close menus" listeners.
export function wireDelegatedEvents() {
    document.body.addEventListener('click', e => {
        let handled = false;
        for (let el = e.target; el && el !== document.body && el.nodeType === 1; el = el.parentElement) {
            if (el.hasAttribute('data-stop-propagation')) {
                e.stopPropagation();
                return;
            }
            if (!handled && el.dataset.action) {
                handled = true;
                const fn = ClickActions[el.dataset.action];
                if (fn && !el.disabled) fn(el, e);
            }
        }
    });
    document.body.addEventListener('change', e => runAlongPath(e, 'data-change', ChangeActions));
    document.body.addEventListener('input', e => runAlongPath(e, 'data-input', InputActions));
    document.body.addEventListener('submit', e => runAlongPath(e, 'data-submit', SubmitActions));
    document.body.addEventListener('keydown', e => {
        runAlongPath(e, 'data-keydown', KeyActions);
        // role="button" elements: Enter / Space act like a click on the element itself
        const el = e.target;
        if ((e.key === 'Enter' || e.key === ' ') && el.nodeType === 1 && el.hasAttribute('data-key-activate')) {
            const fn = ClickActions[el.dataset.action];
            if (!fn) return;
            e.preventDefault();
            fn(el, e);
        }
    });
}
