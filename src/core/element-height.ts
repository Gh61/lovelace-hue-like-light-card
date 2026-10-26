import { Action } from '../types/functions';

/**
 * Height (clientHeight) of an element kept up to date by ResizeObserver - for values calculated from the height
 * (e.g. the brightness shadow). Reading clientHeight right after style changes forces a layout of the whole page,
 * which ran for every card and tile on every light change. An element in a hidden view or closed dialog has
 * no height, the callback is called once it gets displayed (and on every other change of the height).
 */
export class ElementHeight {
    private readonly _ro: ResizeObserver | null;
    private _element: Element | null = null;
    private _height = 0;

    /**
     * @param onChange Called when the height of the observed element changes (e.g. it gets displayed).
     */
    public constructor(onChange: Action) {
        // browser (or test engine) may not support ResizeObserver - then the height is read every time
        if (typeof ResizeObserver === 'undefined') {
            this._ro = null;
        }
        else {
            this._ro = new ResizeObserver(() => {
                // the layout is done in the observer callback, reading doesn't force another one
                const height = this._element?.clientHeight ?? 0;
                if (height === this._height)
                    return;

                this._height = height;
                onChange();
            });
        }
    }

    /**
     * @returns The height of the element - measured once, then kept by ResizeObserver (0 when not displayed).
     * Starts observing the element (replaces the previously observed one).
     */
    public get(element: Element): number {
        if (!this._ro)
            return element.clientHeight;

        if (this._element !== element) {
            this.stop();
            this._element = element;
            this._height = element.clientHeight;
            this._ro.observe(element);
        }
        return this._height;
    }

    /** Stops observing. */
    public stop(): void {
        if (this._element) {
            this._ro?.unobserve(this._element);
            this._element = null;
        }
    }
}
