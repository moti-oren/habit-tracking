// The manage section's state: its category filter, selection mode, archive and drag & drop.

export const manage = Object.seal({
    selectedCategory: 'הכל',
    /** Selection mode: tapping a card selects it instead of opening it. */
    selectMode: false,
    selectedHabitIds: new Set(),
    /** Ids of the cards currently shown (the selection is limited to them). */
    visibleHabitIds: [],
    archiveExpanded: false,
    /** Set right after a drag ends, so the click that follows the drop doesn't open the card. */
    suppressNextCardClick: false,
    /** pending: the pressed card (before the drag starts); active: dragging; target: chip under the pointer */
    drag: { pending: null, active: false, ids: [], target: null }
});
