// A comparable picture of a running app: the body as indented lines, form control values, the
// focused element, localStorage and console output.
//
// Normalization (and nothing more): whitespace runs inside text nodes collapse to one space, which
// is exactly how the page renders them (no element uses `white-space: pre*`); attributes are listed
// in sorted order; whitespace inside class/style values is collapsed. Everything else is compared
// verbatim.

const ws = s => s.replace(/\s+/g, ' ');

function attrsOf(el) {
    return [...el.attributes]
        .map(a => [a.name, a.name === 'class' || a.name === 'style' ? ws(a.value).trim() : a.value])
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([n, v]) => ` ${n}="${v}"`)
        .join('');
}

function serialize(node, depth, out) {
    const pad = '  '.repeat(depth);
    for (let child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 1) {
            if (child.tagName === 'SCRIPT') continue;
            out.push(`${pad}<${child.tagName.toLowerCase()}${attrsOf(child)}>`);
            serialize(child.tagName === 'TEMPLATE' ? child.content : child, depth + 1, out);
        } else if (child.nodeType === 3) {
            out.push(`${pad}"${ws(child.nodeValue)}"`);
        } else if (child.nodeType === 8) {
            out.push(`${pad}<!--${ws(child.nodeValue)}-->`);
        }
    }
}

export function describeElement(el) {
    if (!el || el.nodeType !== 1) return String(el);
    const keys = ['id', 'data-action', 'data-id', 'data-key', 'data-arg', 'data-cat', 'data-value', 'data-cal-key'];
    return `${el.tagName.toLowerCase()}${keys
        .filter(k => el.hasAttribute(k))
        .map(k => `[${k}="${el.getAttribute(k)}"]`)
        .join('')}`;
}

export function takeSnapshot(app) {
    const { document, localStorage } = app.window;
    const body = [`<html${attrsOf(document.documentElement)}>`, `<body${attrsOf(document.body)}>`];
    serialize(document.body, 1, body);
    const controls = [...document.querySelectorAll('input, select, textarea')].map(
        el =>
            `${describeElement(el)} value=${JSON.stringify(el.value)}${el.type === 'checkbox' ? ` checked=${el.checked}` : ''}`
    );
    const storage = Object.keys(localStorage)
        .sort()
        .map(k => `${k} = ${localStorage.getItem(k)}`);
    return {
        body,
        controls,
        focus: describeElement(document.activeElement),
        storage,
        console: [...app.consoleLog],
        errors: app.errors.map(e => String(e && e.stack ? e.stack.split('\n')[0] : e))
    };
}

/** Returns null when equal, or a readable description of the first difference. */
export function diffSnapshots(expected, actual) {
    for (const part of ['errors', 'console', 'storage', 'focus', 'controls', 'body']) {
        const a = [expected[part]].flat();
        const b = [actual[part]].flat();
        const n = Math.max(a.length, b.length);
        for (let i = 0; i < n; i++) {
            if (a[i] !== b[i]) {
                const ctx = (arr, from, to) =>
                    arr
                        .slice(from, to)
                        .map((l, j) => `${from + j}: ${l}`)
                        .join('\n');
                return [
                    `${part} differs at line ${i} (original has ${a.length} lines, refactored ${b.length})`,
                    '--- original',
                    ctx(a, Math.max(0, i - 4), i + 4),
                    '--- refactored',
                    ctx(b, Math.max(0, i - 4), i + 4)
                ].join('\n');
            }
        }
    }
    return null;
}
