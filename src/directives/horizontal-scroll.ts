import { noChange, nothing } from 'lit';
import { directive, PartInfo, ElementPart, PartType } from 'lit/directive.js';
import { AsyncDirective } from 'lit/async-directive.js';
import { Action } from '../types/functions';

/**
 * Directive that converts vertical mouse wheel scrolling into horizontal scrolling.
 * Use on any element with horizontal overflow (overflow-x: auto/scroll).
 * The wheel listener is removed when the element is disconnected and attached again when it is reconnected.
 *
 * Usage: html`<div ${horizontalScroll()}>...</div>`
 */
class HorizontalScrollDirective extends AsyncDirective {
    private _element: HTMLElement | null = null;
    private _cleanup: Action | null = null;

    public constructor(partInfo: PartInfo) {
        super(partInfo);
        if (partInfo.type !== PartType.ELEMENT) {
            throw new Error('horizontalScroll can only be used on an element.');
        }
    }

    public override update(part: ElementPart) {
        this._element = part.element as HTMLElement;
        if (this.isConnected) {
            this.attach();
        }

        return noChange;
    }

    protected override disconnected() {
        this.detach();
    }

    protected override reconnected() {
        this.attach();
    }

    /**
     * Attaches the wheel listener to the element (only once).
     */
    private attach() {
        if (this._cleanup || !this._element)
            return;

        const el = this._element;
        const scroller = new SmoothHorizontalScroller(el);

        const onWheel = (e: WheelEvent) => {
            // Horizontal events (e.g. trackpad swipe) scroll natively;
            // stop a running animation, otherwise it fights the native scroll
            if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
                scroller.cancel();
                return;
            }

            const maxScrollLeft = el.scrollWidth - el.clientWidth;
            // Nothing to scroll if content fits
            if (maxScrollLeft <= 0) return;

            // 1px tolerance - on fractional DPR the browser snaps scrollLeft to device pixels,
            // so the edge may never be reached exactly (e.g. 96.67 of 97)
            const atStart = el.scrollLeft <= 1 && e.deltaY < 0;
            const atEnd = el.scrollLeft >= maxScrollLeft - 1 && e.deltaY > 0;

            // Only prevent default when we can actually scroll,
            // so the page scrolls normally when we hit the edges
            if (!atStart && !atEnd) {
                e.preventDefault();
            }

            scroller.scrollBy(e.deltaY);
        };

        el.addEventListener('wheel', onWheel, { passive: false });

        this._cleanup = () => {
            el.removeEventListener('wheel', onWheel);
            scroller.destroy();
        };
    }

    /**
     * Removes the wheel listener and stops a running scroll animation.
     */
    private detach() {
        this._cleanup?.();
        this._cleanup = null;
    }

    // Required by base class; not used since update() handles everything
    public override render() {
        return nothing;
    }
}

export const horizontalScroll = directive(HorizontalScrollDirective);

/**
 * Handles smooth animated horizontal scrolling using requestAnimationFrame.
 * Accumulates wheel deltas and eases towards the target position.
 */
class SmoothHorizontalScroller {
    private _el: HTMLElement;
    private _targetScrollLeft: number;
    private _animationFrame: number | null = null;

    /** @param easingDivisor Controls animation speed – lower = faster (default: 6) */
    public constructor(el: HTMLElement, private _easingDivisor: number = 6) {
        this._el = el;
        this._targetScrollLeft = el.scrollLeft;
    }

    /** Accumulate delta and start/continue the animation loop */
    public scrollBy(delta: number): void {
        if (!this._animationFrame) {
            this._targetScrollLeft = this._el.scrollLeft;
        }

        const maxScrollLeft = this._el.scrollWidth - this._el.clientWidth;
        this._targetScrollLeft = Math.max(0, Math.min(maxScrollLeft, this._targetScrollLeft + delta));

        if (!this._animationFrame) {
            this._animationFrame = requestAnimationFrame(() => this.animate());
        }
    }

    private animate(): void {
        const diff = this._targetScrollLeft - this._el.scrollLeft;
        const step = diff / this._easingDivisor;

        if (Math.abs(step) < 1) {
            this._el.scrollLeft = this._targetScrollLeft;
            this._animationFrame = null;
            return;
        }

        this._el.scrollLeft += step;
        this._animationFrame = requestAnimationFrame(() => this.animate());
    }

    /** Abort any in-flight animation and re-sync the target to the real scroll position */
    public cancel(): void {
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
            this._animationFrame = null;
        }
        this._targetScrollLeft = this._el.scrollLeft;
    }

    /** Stop the animation and clean up */
    public destroy(): void {
        this.cancel();
    }
}
