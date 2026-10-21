// Targeted DOM updates.
// Renderers still describe a list as one HTML string, but only nodes that actually changed
// are touched: unchanged cards keep their DOM node (and their focus, hover state and running
// animations). A node whose own attributes changed is replaced whole, so CSS animation
// classes on it restart exactly as they would on a fresh node.
const patchTemplate = document.createElement('template');

function sameAttributes(a, b) {
    const attrs = a.attributes;
    if (attrs.length !== b.attributes.length) return false;
    for (let i = 0; i < attrs.length; i++) {
        if (b.getAttribute(attrs[i].name) !== attrs[i].value) return false;
    }
    return true;
}

function morphChildren(parent, next) {
    const oldNodes = Array.from(parent.childNodes);
    const newNodes = Array.from(next.childNodes);
    for (let i = 0; i < newNodes.length; i++) {
        const neu = newNodes[i];
        const old = oldNodes[i];
        if (!old) {
            parent.appendChild(neu);
            continue;
        }
        if (old.isEqualNode(neu)) continue;
        if (old.nodeType === 1 && neu.nodeType === 1 && old.tagName === neu.tagName && sameAttributes(old, neu)) {
            morphChildren(old, neu);
        } else if (old.nodeType === 3 && neu.nodeType === 3) {
            old.nodeValue = neu.nodeValue;
        } else {
            parent.replaceChild(neu, old);
        }
    }
    for (let i = newNodes.length; i < oldNodes.length; i++) parent.removeChild(oldNodes[i]);
}

// If the focused control was replaced, focus its successor (same action and arguments)
const FOCUS_KEY_ATTRS = [
    'id',
    'data-action',
    'data-id',
    'data-key',
    'data-slot',
    'data-arg',
    'data-cat',
    'data-ctx',
    'data-cal-key'
];

function focusSignature(el) {
    const parts = FOCUS_KEY_ATTRS.filter(a => el.hasAttribute(a)).map(
        a => `[${a}="${CSS.escape(el.getAttribute(a))}"]`
    );
    return parts.length ? parts.join('') : null;
}

export function patchHTML(container, html) {
    const active = document.activeElement;
    const focusSel = active && active !== document.body && container.contains(active) ? focusSignature(active) : null;
    patchTemplate.innerHTML = html;
    morphChildren(container, patchTemplate.content);
    if (focusSel && !active.isConnected) {
        const successor = container.querySelector(focusSel);
        if (successor) successor.focus({ preventScroll: true });
    }
}
