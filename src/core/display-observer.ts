import { Action } from '../types/functions';

/**
 * Waits until an element is displayed (has non-zero height) - for values that can only be calculated
 * on a displayed element (e.g. shadow computed from clientHeight). Element in a hidden view or closed dialog
 * has no size, so instead of polling, the callback is called once the element gets its size.
 */
export class DisplayObserver {
    private readonly _ro: ResizeObserver | null;
    private _element: Element | null = null;

    /**
     * @param onDisplayed Called (once per wait) when the observed element gets displayed.
     */
    public constructor(onDisplayed: Action) {
        // browser (or test engine) may not support ResizeObserver - then it does nothing
        if (typeof ResizeObserver === 'undefined') {
            this._ro = null;
        }
        else {
            this._ro = new ResizeObserver(() => {
                if (!this._element?.clientHeight)
                    return;

                this.stop();
                onDisplayed();
            });
        }
    }

    /** Starts waiting until the element is displayed (replaces the previously observed element). */
    public waitForDisplay(element: Element): void {
        if (this._element === element)
            return;

        this.stop();
        this._element = element;
        this._ro?.observe(element);
    }

    /** Stops waiting. */
    public stop(): void {
        if (this._element) {
            this._ro?.unobserve(this._element);
            this._element = null;
        }
    }
}
