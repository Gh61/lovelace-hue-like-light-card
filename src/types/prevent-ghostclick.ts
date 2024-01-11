/**
 * Source: https://hammerjs.github.io/tips/ (Section: "After a tap, also a click is being triggered, I don't want that!")
 * Link to: https://gist.github.com/jtangelder/361052976f044200ea17
 * 
 * This is a must-have because of how hammerjs is handling touch vs click.
 * 
 * TZ: Cleaned and Rewritten to TypeScript
 */

export class PreventGhostClick {
    private static readonly Threshold = 25;
    private static readonly Timeout = 2500;
    private static readonly IsEnabled = !!('ontouchstart' in window);

    private static coordinates = new Array<Array<number>>();

    // static ctor
    static {
        if (PreventGhostClick.IsEnabled) {
            document.addEventListener('click', (ev) => PreventGhostClick.preventGhostClick(ev), true);
        }
    }

    private readonly _el;

    /**
     * prevent click events after touchstart for the given element
     * @param {EventTarget} el
     */
    public constructor(el: EventTarget) {
        this._el = el;
        if (PreventGhostClick.IsEnabled) {
            this._el.addEventListener('touchstart', PreventGhostClick.resetCoordinates, true);
            this._el.addEventListener('touchend', PreventGhostClick.registerCoordinates, true);
        }
    }

    /**
     * removes listeners for touch events
     */
    public destroy() {
        this._el.addEventListener('touchstart', PreventGhostClick.resetCoordinates, true);
        this._el.addEventListener('touchend', PreventGhostClick.registerCoordinates, true);
    }

    /**
     * prevent clicks if they're in any registered XY region
     * @param {MouseEvent} ev
     */
    private static preventGhostClick(ev: MouseEvent) {
        for (let i = 0; i < PreventGhostClick.coordinates.length; i++) {
            const x = PreventGhostClick.coordinates[i][0];
            const y = PreventGhostClick.coordinates[i][1];

            // within the range, so prevent the click
            if (Math.abs(ev.clientX - x) < PreventGhostClick.Threshold && Math.abs(ev.clientY - y) < PreventGhostClick.Threshold) {
                ev.stopImmediatePropagation();
                ev.preventDefault();
                break;
            }
        }
    }

    /**
     * reset the coordinates array
     */
    private static resetCoordinates() {
        PreventGhostClick.coordinates = [];
    }

    /**
     * remove the first coordinates set from the array
     */
    private static popCoordinates() {
        PreventGhostClick.coordinates.splice(0, 1);
    }

    /**
     * if it is an final touchend, we want to register it's place
     * @param {TouchEvent} ev
     */
    private static registerCoordinates(ev: Event | TouchEvent) {
        // only support TouchEvent
        if (!('touches' in ev))
            return;

        // touchend is triggered on every releasing finger
        // changed touches always contain the removed touches on a touchend
        // the touches object might contain these also at some browsers (firefox os)
        // so touches - changedTouches will be 0 or lower, like -1, on the final touchend
        if (ev.touches.length - ev.changedTouches.length <= 0) {
            const touch = ev.changedTouches[0];
            PreventGhostClick.coordinates.push([touch.clientX, touch.clientY]);
            setTimeout(PreventGhostClick.popCoordinates, PreventGhostClick.Timeout);
        }
    }
}