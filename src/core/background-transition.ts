import { css, CSSResult, unsafeCSS } from 'lit';
import { Consts } from '../types/consts';
import { Background } from './colors/background';

/**
 * Applies the background of an element (a CSS variable on the host) with a smooth change. CSS can't transition a gradient,
 * so the element would jump to the new colors while its text fades to them (plain colors fade by the element's transition):
 * - a gradient with the same number of colors moves its colors frame by frame, always from the colors shown right now,
 *   so the changes reported step by step (light transitions, a moving brightness slider) blend into one smooth change,
 * - other changes with a gradient (lights turned on / off, different number of colors) fade out the previous background,
 *   painted by the element's ::before (see getStyles).
 */
export class BackgroundTransition {
    private static readonly PreviousBackgroundVar = '--hue-previous-background';

    private readonly _host: HTMLElement;
    private readonly _variable: string;
    /** Applied value and the background shown right now (during the color transition the mixed one). */
    private _shown: { value: string, background: Background | null } | null = null;
    private _colorTransition: { from: Background, to: Background, value: string, start: number, frame: number } | null = null;
    private _fade: Animation | null = null;

    /**
     * @param host Element holding the background variable (inherited by the element).
     * @param variable Name of the CSS variable with the background.
     */
    public constructor(host: HTMLElement, variable: string) {
        this._host = host;
        this._variable = variable;
    }

    /**
     * Styles of the element - its ::before under the content with the previous background.
     * @param selector Selector of the element.
     * @param shadow CSS value of the brightness shadow of the element (the ::before covers the element's own inset shadow).
     */
    public static getStyles(selector: string, shadow: string): CSSResult {
        return css`
    ${unsafeCSS(selector)} {
        /* the ::before covers only the element (not the nearest positioned ancestor) and stays under the content */
        position: relative;
        isolation: isolate;
    }
    ${unsafeCSS(selector)}::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        background: var(${unsafeCSS(BackgroundTransition.PreviousBackgroundVar)}, transparent);
        box-shadow: ${unsafeCSS(shadow)};
        opacity: 0;
        pointer-events: none;
    }
    `;
    }

    /** Stops the running transition and forgets the shown background - the next background is applied at once. */
    public reset(): void {
        this.stopColorTransition();
        this._shown = null;
    }

    /**
     * Applies a new background of the element.
     * @param element The element (null when not rendered yet - the background is applied at once).
     * @param background The new background, null for a theme background.
     * @param value CSS value of the new background.
     */
    public update(element: Element | null, background: Background | null, value: string): void {
        const shown = this._shown;
        const target = this._colorTransition?.value ?? shown?.value;
        if (target === value)
            return;

        const from = shown?.background;
        if (element && from && background && from.isGradient && background.isGradient && from.colorCount === background.colorCount) {
            this.startColorTransition(from, background, value);
            return;
        }

        this.stopColorTransition();
        if (element && shown && (from?.isGradient || background?.isGradient))
            this.fadeOut(element, shown.value);

        this.apply(value, background);
    }

    private startColorTransition(from: Background, to: Background, value: string): void {
        this.stopColorTransition();
        const transition = { from, to, value, start: performance.now(), frame: 0 };
        this._colorTransition = transition;

        const step = (now: number) => {
            // the frame time can be a little older than the start
            const progress = Math.min(1, Math.max(0, (now - transition.start) / Consts.TransitionDuration));
            if (progress < 1) {
                // ease-out
                const mixed = from.mix(to, 1 - Math.pow(1 - progress, 3));
                this.apply(mixed.toString(), mixed);
                transition.frame = requestAnimationFrame(step);
            }
            else {
                this._colorTransition = null;
                this.apply(value, to);
            }
        };
        transition.frame = requestAnimationFrame(step);
    }

    private stopColorTransition(): void {
        if (this._colorTransition) {
            cancelAnimationFrame(this._colorTransition.frame);
            this._colorTransition = null;
        }
    }

    /** Fades out the previous background (unless a fade is running - restarting it would flash the previous background). */
    private fadeOut(element: Element, previousValue: string): void {
        if (this._fade?.playState === 'running')
            return;

        this._host.style.setProperty(BackgroundTransition.PreviousBackgroundVar, previousValue);
        this._fade = element.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: Consts.TransitionDuration,
            easing: Consts.TransitionEasing,
            pseudoElement: '::before'
        });
    }

    private apply(value: string, background: Background | null): void {
        this._shown = { value, background };
        this._host.style.setProperty(this._variable, value);
    }
}
