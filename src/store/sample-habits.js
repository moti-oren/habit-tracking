// The sample habits a new user starts with (and "reset to sample data" restores). Histories are
// relative to today.

import { getDateKeyDaysAgo } from '../core/dates.js';

export function getDefaultHabits() {
    return [
        {
            id: 'h1',
            name: 'אימון כוח / מתח',
            category: 'כושר',
            note: 'סטים של מתח, שכיבות סמיכה וליבה',
            icon: '🏋️',
            color: 'teal',
            goalType: 'fixed_days',
            fixedDays: [0, 2, 3, 5],
            weeklyGoal: 4,
            history: {
                [getDateKeyDaysAgo(6)]: true,
                [getDateKeyDaysAgo(5)]: false,
                [getDateKeyDaysAgo(4)]: true,
                [getDateKeyDaysAgo(3)]: true,
                [getDateKeyDaysAgo(2)]: false,
                [getDateKeyDaysAgo(1)]: true,
                [getDateKeyDaysAgo(0)]: true
            }
        },
        {
            id: 'h2',
            name: 'נגינה בגיטרה (30 דק׳)',
            category: 'פוקוס',
            note: 'תרגול אקורדים, פריטה וקטע חדש',
            icon: '🎸',
            color: 'purple',
            goalType: 'flexible',
            fixedDays: [],
            weeklyGoal: 5,
            history: {
                [getDateKeyDaysAgo(6)]: true,
                [getDateKeyDaysAgo(5)]: true,
                [getDateKeyDaysAgo(4)]: false,
                [getDateKeyDaysAgo(3)]: true,
                [getDateKeyDaysAgo(2)]: true,
                [getDateKeyDaysAgo(1)]: true,
                [getDateKeyDaysAgo(0)]: false
            }
        },
        {
            id: 'h3',
            name: 'שתיית 2.5 ליטר מים',
            category: 'בריאות',
            note: 'הידרציה מלאה לאורך כל היום',
            icon: '💧',
            color: 'sky',
            goalType: 'daily',
            fixedDays: [0, 1, 2, 3, 4, 5, 6],
            weeklyGoal: 7,
            history: {
                [getDateKeyDaysAgo(6)]: true,
                [getDateKeyDaysAgo(5)]: true,
                [getDateKeyDaysAgo(4)]: true,
                [getDateKeyDaysAgo(3)]: true,
                [getDateKeyDaysAgo(2)]: true,
                [getDateKeyDaysAgo(1)]: true,
                [getDateKeyDaysAgo(0)]: true
            }
        },
        {
            id: 'h4',
            name: 'תרגול אנגלית / קריאה',
            category: 'למידה',
            note: 'קריאת 15 עמודים או פרק באנגלית',
            icon: '📚',
            color: 'indigo',
            goalType: 'daily',
            fixedDays: [0, 1, 2, 3, 4, 5, 6],
            weeklyGoal: 7,
            history: {
                [getDateKeyDaysAgo(6)]: true,
                [getDateKeyDaysAgo(5)]: true,
                [getDateKeyDaysAgo(4)]: true,
                [getDateKeyDaysAgo(3)]: false,
                [getDateKeyDaysAgo(2)]: true,
                [getDateKeyDaysAgo(1)]: true,
                [getDateKeyDaysAgo(0)]: true
            }
        },
        {
            id: 'h5',
            name: 'ריצה או הליכה מהירה',
            category: 'כושר',
            note: '30 דקות אירובי באוויר הפתוח',
            icon: '🏃',
            color: 'orange',
            goalType: 'fixed_days',
            fixedDays: [1, 3, 6],
            weeklyGoal: 3,
            history: {
                [getDateKeyDaysAgo(6)]: false,
                [getDateKeyDaysAgo(5)]: true,
                [getDateKeyDaysAgo(4)]: true,
                [getDateKeyDaysAgo(3)]: false,
                [getDateKeyDaysAgo(2)]: false,
                [getDateKeyDaysAgo(1)]: true,
                [getDateKeyDaysAgo(0)]: false
            }
        }
    ];
}
