// Habits and categories are always listed in alphabetical (Hebrew) order by name.

// Habits and categories are always kept in alphabetical (Hebrew) order by name (a Store invariant).
const nameCollator = new Intl.Collator('he', { sensitivity: 'base', numeric: true });

export const compareByName = (a, b) => nameCollator.compare(String(a), String(b));
