// App-wide UI state: the open section and the theme and sound preferences.

export const app = Object.seal({
    /** 'tracker' | 'analytics' | 'manage' */
    currentMainSection: 'tracker',
    /** Starts from the device theme (set before boot by ui/shell/theme.js); a saved choice wins. */
    isDarkMode: false,
    /** Until the user toggles the theme, the app follows the device theme. */
    themeChosenByUser: false,
    soundEnabled: true
});
