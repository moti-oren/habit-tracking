// The category manager dialog's state.

export const categoryManager = Object.seal({
    /** The category being renamed in place, or null. */
    editingName: null,
    /** Multi-select mode for deleting several categories. */
    selectMode: false,
    selected: new Set()
});
