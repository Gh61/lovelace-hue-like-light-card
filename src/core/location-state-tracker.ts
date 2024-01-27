import { Consts } from "../types/consts";

/*
 * This class will monitor changes in window.history.state by overriding pushState and replaceState methods.
 */
export class LocationStateTracker {
    private static _isHistoryOverriden = false;

    /**
     * Overrides window.history pushState and replaceState methods, so they fire respective event on window object.
     * _Pun intended_ xD
     */
    public static overrideHistory(): void {
        if (LocationStateTracker._isHistoryOverriden)
            return;

        const { pushState, replaceState } = window.history;

        window.history.pushState = function (...args) {
            pushState.apply(window.history, args);
            window.dispatchEvent(new Event('pushstate'));
        };

        window.history.replaceState = function (...args) {
            replaceState.apply(window.history, args);
            window.dispatchEvent(new Event('replacestate'));
        };

        if (Consts.Dev)
            console.log("[LocationStateTracker] History overriden")
    }
}