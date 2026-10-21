// Motion hints for the NEXT render only: what just changed, so that only that animates.
//
// An action sets a hint right before it renders and resets it right after (or the renderer that
// consumes it resets it). That timing is part of the behaviour: keep every set → render → reset
// sequence exactly as it is.

export const motion = Object.seal({
    /** { id, key, on, slot }: the mark just toggled (check draws, pips pop, counters slide). */
    lastToggle: null,
    /** The habit just checked: its button pops. */
    lastToggledHabitId: null,
    /** A day that just became 100%: it pulses once. */
    celebrateDayKey: null,
    /** 'prev' | 'next': the day strip slides in on its next render. */
    pendingWeekSlide: null,
    /** 'prev' | 'next' | 'zoom-in' | 'zoom-out': the calendar grid animates on its next render. */
    pendingCalSlide: null,
    /** Charts grow from zero on the next analytics render (reset by renderLeaderboard). */
    analyticsEntryAnim: false,
    /** The manage card whose selection just changed: its check circle pops. */
    lastSelectToggledId: null,
    /** Selection mode was just switched: the check circles fade in. */
    selectModeJustChanged: false,
    /** 'icon' | 'color' | weekday index: the option just picked in the habit form pops. */
    justPicked: null,
    /** A section is being drawn because it was just opened: "value changed" animations are skipped. */
    renderingEntry: false
});
