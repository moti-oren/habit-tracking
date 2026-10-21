import { prefersReducedMotion } from '../dom/animate.js';
import { escapeHtml } from '../dom/html.js';
import { CHEVRON_SVG } from '../dom/icons.js';
import { closeAllMenus } from './menus.js';

let openSelectState = null; // { select, trigger, panel }

/** Is a custom list open? (Escape then closes the list, not the dialog under it.) */
export function isCustomSelectOpen() {
    return !!openSelectState;
}

export function watchValue(el, onChange) {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    Object.defineProperty(el, 'value', {
        configurable: true,
        get() {
            return desc.get.call(this);
        },
        set(v) {
            desc.set.call(this, v);
            onChange();
        }
    });
}

export function fireChange(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function relabel(nativeId, triggerId) {
    document.querySelectorAll(`label[for="${nativeId}"]`).forEach(l => l.setAttribute('for', triggerId));
}

export function enhanceSelect(select) {
    if (select.dataset.enhanced) return;
    select.dataset.enhanced = '1';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${select.id}_trigger`;
    trigger.className = select.className + ' flex items-center justify-between gap-2 text-right';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = `<span class="truncate min-w-0" data-label></span>${CHEVRON_SVG}`;
    select.classList.add('hidden');
    select.tabIndex = -1;
    select.after(trigger);
    relabel(select.id, trigger.id);

    const sync = () => {
        const opt = select.options[select.selectedIndex];
        trigger.querySelector('[data-label]').textContent = opt ? opt.textContent : '';
        if (openSelectState && openSelectState.select === select) renderSelectPanel();
    };
    watchValue(select, sync);
    new MutationObserver(sync).observe(select, { childList: true, subtree: true });
    select.addEventListener('change', sync);
    sync();

    trigger.addEventListener('click', e => {
        e.stopPropagation();
        if (openSelectState && openSelectState.select === select) closeCustomSelect(true);
        else openCustomSelect(select, trigger);
    });
    trigger.addEventListener('keydown', e => {
        if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
            e.preventDefault();
            openCustomSelect(select, trigger);
        }
    });
}

function openCustomSelect(select, trigger) {
    closeAllMenus();
    closeCustomSelect(false);
    const panel = document.createElement('div');
    panel.setAttribute('role', 'listbox');
    panel.setAttribute('data-menu-panel', '');
    panel.setAttribute('aria-labelledby', trigger.id);
    panel.className =
        'fixed z-[80] p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl overflow-y-auto overscroll-contain';
    panel.addEventListener('click', e => e.stopPropagation());
    panel.addEventListener('keydown', e => {
        if (openSelectState && openSelectState.panel === panel) handleSelectPanelKeys(e);
    });
    document.body.appendChild(panel);
    openSelectState = { select, trigger, panel };
    trigger.setAttribute('aria-expanded', 'true');
    trigger.querySelector('[data-chevron]').classList.add('rotate-180');
    renderSelectPanel();
    positionSelectPanel();
    const current = panel.querySelector('[aria-selected="true"]') || panel.querySelector('[role="option"]');
    if (current) {
        current.focus();
        current.scrollIntoView({ block: 'nearest' });
    }
}

function renderSelectPanel() {
    const { select, panel } = openSelectState;
    const optionHtml = opt => {
        const sel = opt.value === select.value;
        return `<button type="button" role="option" aria-selected="${sel}" data-value="${escapeHtml(opt.value)}" class="w-full flex items-center justify-between gap-3 text-right px-3 py-2 rounded-lg text-sm transition focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 ${
            sel ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'font-normal text-slate-700 dark:text-slate-200'
        }"><span class="truncate">${escapeHtml(opt.textContent)}</span>${sel ? '<svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>' : ''}</button>`;
    };
    let html = '';
    [...select.children].forEach(child => {
        if (child.tagName === 'OPTGROUP') {
            html += `<div class="px-3 pt-2.5 pb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">${escapeHtml(child.label)}</div>`;
            html += [...child.children].map(optionHtml).join('');
        } else if (child.tagName === 'OPTION') {
            html += optionHtml(child);
        }
    });
    panel.innerHTML = html;
    panel.querySelectorAll('[role="option"]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (openSelectState && openSelectState.panel === panel) chooseSelectOption(btn.dataset.value);
        });
    });
}

function positionSelectPanel() {
    if (!openSelectState) return;
    const { trigger, panel } = openSelectState;
    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth,
        vh = window.innerHeight;
    const width = Math.min(Math.max(r.width, 200), vw - 16);
    const right = Math.min(Math.max(8, vw - r.right), vw - width - 8); // align to the trigger's right edge (RTL)
    panel.style.width = `${width}px`;
    panel.style.right = `${right}px`;
    panel.style.left = 'auto';
    const spaceBelow = vh - r.bottom - 8,
        spaceAbove = r.top - 8;
    const desired = Math.min(panel.scrollHeight, 288);
    if (spaceBelow >= Math.min(desired, 200) || spaceBelow >= spaceAbove) {
        panel.style.top = `${r.bottom + 6}px`;
        panel.style.bottom = 'auto';
        panel.style.transformOrigin = 'top right';
        panel.style.maxHeight = `${Math.max(120, Math.min(288, spaceBelow - 6))}px`;
    } else {
        panel.style.bottom = `${vh - r.top + 6}px`;
        panel.style.top = 'auto';
        panel.style.transformOrigin = 'bottom right';
        panel.style.maxHeight = `${Math.max(120, Math.min(288, spaceAbove - 6))}px`;
    }
}

function chooseSelectOption(value) {
    const { select } = openSelectState;
    const changed = select.value !== value;
    select.value = value;
    closeCustomSelect(true);
    if (changed) fireChange(select);
}

export function closeCustomSelect(refocus) {
    if (!openSelectState) return;
    const { trigger, panel } = openSelectState;
    panel.inert = true; // a list that is fading out takes no clicks or keys
    if (prefersReducedMotion()) {
        panel.remove();
    } else {
        panel.classList.add('is-closing');
        setTimeout(() => panel.remove(), 100);
    }
    trigger.setAttribute('aria-expanded', 'false');
    trigger.querySelector('[data-chevron]').classList.remove('rotate-180');
    openSelectState = null;
    if (refocus) trigger.focus();
}

function handleSelectPanelKeys(e) {
    const opts = [...openSelectState.panel.querySelectorAll('[role="option"]')];
    const idx = opts.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        (opts[idx + 1] || opts[0]).focus();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        (opts[idx - 1] || opts[opts.length - 1]).focus();
    } else if (e.key === 'Home') {
        e.preventDefault();
        opts[0].focus();
    } else if (e.key === 'End') {
        e.preventDefault();
        opts[opts.length - 1].focus();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeCustomSelect(true);
    } else if (e.key === 'Tab') {
        closeCustomSelect(false);
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
        const start = idx + 1;
        const hit = [...opts.slice(start), ...opts.slice(0, start)].find(
            o =>
                o.textContent
                    .trim()
                    .replace(/^\S+\s/, '')
                    .startsWith(e.key) || o.textContent.trim().startsWith(e.key)
        );
        if (hit) hit.focus();
    }
}

// Clicks elsewhere, scrolling outside the panel, or resizing close an open list
export function wireCustomSelectDismiss() {
    document.addEventListener('click', () => closeCustomSelect(false));
    document.addEventListener(
        'scroll',
        e => {
            if (openSelectState && !openSelectState.panel.contains(e.target)) closeCustomSelect(false);
        },
        { capture: true, passive: true }
    );
}
