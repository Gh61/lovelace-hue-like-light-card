import { noChange, nothing } from 'lit';
import { directive, Directive, PartInfo, ElementPart, PartType } from 'lit/directive.js';

/**
 * Directive that converts vertical mouse wheel scrolling into horizontal scrolling.
 * Use on any element with horizontal overflow (overflow-x: auto/scroll).
 *
 * Usage: html`<div ${horizontalScroll()}>...</div>`
 */
class HorizontalScrollDirective extends Directive {
    private _cleanup: (() => void) | null = null;

    public constructor(partInfo: PartInfo) {
        super(partInfo);
        if (partInfo.type !== PartType.ELEMENT) {
            throw new Error('horizontalScroll can only be used on an element.');
        }
    }

    public override update(part: ElementPart) {
        // Only attach the listener once
        if (this._cleanup) return noChange;

        const el = part.element as HTMLElement;
        const scroller = new SmoothHorizontalScroller(el);

        const onWheel = (e: WheelEvent) => {
            // Ignore purely horizontal wheel events (e.g. trackpad)
            if (e.deltaY === 0) return;

            const maxScrollLeft = el.scrollWidth - el.clientWidth;
            // Nothing to scroll if content fits
            if (maxScrollLeft <= 0) return;

            const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
            const atEnd = el.scrollLeft >= maxScrollLeft && e.deltaY > 0;

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

        return noChange;
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

    /** Stop the animation and clean up */
    public destroy(): void {
        if (this._animationFrame) {
            cancelAnimationFrame(this._animationFrame);
            this._animationFrame = null;
        }
    }
}