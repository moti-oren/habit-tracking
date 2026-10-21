// The few browser APIs the app uses that jsdom does not implement. Installed identically for the
// original and the refactored app, so both take the same code paths.

// https://drafts.csswg.org/cssom/#serialize-an-identifier (same algorithm as the CSS.escape polyfill)
function cssEscape(value) {
    const string = String(value);
    const length = string.length;
    let result = '';
    const firstCodeUnit = string.charCodeAt(0);
    for (let index = 0; index < length; index++) {
        const codeUnit = string.charCodeAt(index);
        if (codeUnit === 0x0000) {
            result += '�';
        } else if (
            (codeUnit >= 0x0001 && codeUnit <= 0x001f) ||
            codeUnit === 0x007f ||
            (index === 0 && codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
            (index === 1 && codeUnit >= 0x0030 && codeUnit <= 0x0039 && firstCodeUnit === 0x002d)
        ) {
            result += `\\${codeUnit.toString(16)} `;
        } else if (index === 0 && length === 1 && codeUnit === 0x002d) {
            result += `\\${string.charAt(index)}`;
        } else if (
            codeUnit >= 0x0080 ||
            codeUnit === 0x002d ||
            codeUnit === 0x005f ||
            (codeUnit >= 0x0030 && codeUnit <= 0x0039) ||
            (codeUnit >= 0x0041 && codeUnit <= 0x005a) ||
            (codeUnit >= 0x0061 && codeUnit <= 0x007a)
        ) {
            result += string.charAt(index);
        } else {
            result += `\\${string.charAt(index)}`;
        }
    }
    return result;
}

export function installDomPolyfills(win) {
    if (!win.CSS) win.CSS = {};
    if (!win.CSS.escape) win.CSS.escape = cssEscape;
    const proto = win.Element && win.Element.prototype;
    if (proto && !proto.scrollIntoView) proto.scrollIntoView = function scrollIntoView() {};
    if (win.document && !win.document.elementFromPoint) win.document.elementFromPoint = () => null;
}
