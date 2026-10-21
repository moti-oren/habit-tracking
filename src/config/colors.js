// Habit colours. Every Tailwind class here is also safelisted in tailwind.config.js.

// Habit colours are for identity only. Green (success), amber-on-white banners (warning)
// and rose (danger) stay reserved for status. Solid fills use the 600 shade so white
// check marks keep at least 3:1 contrast.
export const COLOR_OPTIONS = [
    {
        id: 'indigo',
        name: 'אינדיגו',
        bg: 'bg-indigo-600',
        softBg: 'bg-indigo-500/15',
        text: 'text-indigo-600 dark:text-indigo-400',
        border: 'border-indigo-500',
        hex: '#4f46e5'
    },
    {
        id: 'teal',
        name: 'טורקיז',
        bg: 'bg-teal-600',
        softBg: 'bg-teal-500/15',
        text: 'text-teal-700 dark:text-teal-400',
        border: 'border-teal-500',
        hex: '#0d9488'
    },
    {
        id: 'orange',
        name: 'כתום',
        bg: 'bg-orange-600',
        softBg: 'bg-orange-500/15',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-500',
        hex: '#ea580c'
    },
    {
        id: 'pink',
        name: 'ורוד',
        bg: 'bg-pink-600',
        softBg: 'bg-pink-500/15',
        text: 'text-pink-700 dark:text-pink-400',
        border: 'border-pink-500',
        hex: '#db2777'
    },
    {
        id: 'sky',
        name: 'תכלת',
        bg: 'bg-sky-600',
        softBg: 'bg-sky-500/15',
        text: 'text-sky-700 dark:text-sky-400',
        border: 'border-sky-500',
        hex: '#0284c7'
    },
    {
        id: 'purple',
        name: 'סגול',
        bg: 'bg-purple-600',
        softBg: 'bg-purple-500/15',
        text: 'text-purple-700 dark:text-purple-400',
        border: 'border-purple-500',
        hex: '#9333ea'
    }
];

// Habits saved with the old palette keep a similar hue
export const COLOR_MIGRATION = { emerald: 'teal', rose: 'pink', cyan: 'sky', amber: 'orange' };

export function getColorMeta(colorId) {
    return COLOR_OPTIONS.find(c => c.id === colorId) || COLOR_OPTIONS[0];
}
