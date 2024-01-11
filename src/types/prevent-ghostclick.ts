/**
 * Source: https://hammerjs.github.io/tips/ (Section: "After a tap, also a click is being triggered, I don't want that!")
 * Link to: https://gist.github.com/jtangelder/361052976f044200ea17
 * 
 * This is a must-have because of how hammerjs is handling touch vs click.
 * 
 * TZ: Cleaned and Rewritten to TypeScript
 */

export class PreventGhostClick {
    private static readonly _threshold = 25;
    private static readonly _timeout = 2500;
    private static readonly _isEnabled = !!("ontouchstart" in window);

    private static _coordinates = new Array<Array<number>>();

    // static ctor
    static {
        if (PreventGhostClick._isEnabled) {
            document.addEventListener("click", (ev) => PreventGhostClick.preventGhostClick(ev), true);
        }
    }

    private readonly _el;

    /**
     * prevent click events after touchstart for the given element
     * @param {EventTarget} el
     */
    constructor(el: EventTarget) {
        this._el = el;
        if (PreventGhostClick._isEnabled) {
            this._el.addEventListener("touchstart", PreventGhostClick.resetCoordinates, true);
            this._el.addEventListener("touchend", PreventGhostClick.registerCoordinates, true);
        }
    }

    /**
     * removes listeners for touch events
     */
    public destroy(){
        this._el.addEventListener("touchstart", PreventGhostClick.resetCoordinates, true);
        this._el.addEventListener("touchend", PreventGhostClick.registerCoordinates, true);
    }

    /**
     * prevent clicks if they're in any registered XY region
     * @param {MouseEvent} ev
     */
    private static preventGhostClick(ev: MouseEvent) {
        for (var i = 0; i < PreventGhostClick._coordinates.length; i++) {
            var x = PreventGhostClick._coordinates[i][0];
            var y = PreventGhostClick._coordinates[i][1];

            // within the range, so prevent the click
            if (Math.abs(ev.clientX - x) < PreventGhostClick._threshold && Math.abs(ev.clientY - y) < PreventGhostClick._threshold) {
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
        PreventGhostClick._coordinates = [];
    }

    /**
     * remove the first coordinates set from the array
     */
    private static popCoordinates() {
        PreventGhostClick._coordinates.splice(0, 1);
    }

    /**
     * if it is an final touchend, we want to register it's place
     * @param {TouchEvent} ev
     */
    private static registerCoordinates(ev: Event | TouchEvent) {
        // only support TouchEvent
        if (!("touches" in ev))
            return;

        // touchend is triggered on every releasing finger
        // changed touches always contain the removed touches on a touchend
        // the touches object might contain these also at some browsers (firefox os)
        // so touches - changedTouches will be 0 or lower, like -1, on the final touchend
        if (ev.touches.length - ev.changedTouches.length <= 0) {
            var touch = ev.changedTouches[0];
            PreventGhostClick._coordinates.push([touch.clientX, touch.clientY]);
            setTimeout(PreventGhostClick.popCoordinates, PreventGhostClick._timeout);
        }
    }
}