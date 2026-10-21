// Text helpers.

export function getGraphemes(text) {
    const str = String(text || '').trim();
    if (!str) return [];
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(str)].map(x => x.segment);
    }
    return Array.from(str);
}
