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
    /** Background shown right now (during the color transition the mixed one). */
    private _shown: { value: string, background: Background | null } | null = null;
    /** Value of the last update (the end of a running transition). */
    private _target: string | null = null;
    private _colorTransition: { element: HTMLElement, start: number, frame: number } | null = null;
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
        /* own compositing layer - the changing colors repaint only the element, not the whole Hue screen around it */
        will-change: transform;
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
        this._target = null;
    }

    /**
     * Applies a new background of the element.
     * @param element The element (null when not rendered yet - the background is applied at once).
     * @param background The new background, null for a theme background.
     * @param value CSS value of the new background.
     */
    public update(element: HTMLElement | null, background: Background | null, value: string): void {
        const shown = this._shown;
        if (this._target === value)
            return;

        // the host gets the new background at once (other users of the variable), the transition overrides it on the element only
        this._target = value;
        this._host.style.setProperty(this._variable, value);

        const from = shown?.background;
        if (element && from && background && from.isGradient && background.isGradient && from.colorCount === background.colorCount) {
            this.startColorTransition(element, from, background, value);
            return;
        }

        this.stopColorTransition();
        if (element && shown && (from?.isGradient || background?.isGradient))
            this.fadeOut(element, shown.value);

        this._shown = { value, background };
    }

    /**
     * Moves the colors on the element frame by frame. Only the element gets the mixed colors - changing a variable
     * of the host every frame would recalculate the styles of everything inside the host (e.g. the whole Hue screen).
     */
    private startColorTransition(element: HTMLElement, from: Background, to: Background, value: string): void {
        this.stopColorTransition();
        const transition = { element, start: performance.now(), frame: 0 };
        this._colorTransition = transition;
        // until the first frame the element keeps the shown colors (the host has the new ones already)
        element.style.setProperty(this._variable, from.toString());

        const step = (now: number) => {
            // the frame time can be a little older than the start
            const progress = Math.min(1, Math.max(0, (now - transition.start) / Consts.TransitionDuration));
            if (progress < 1) {
                // ease-out
                const mixed = from.mix(to, 1 - Math.pow(1 - progress, 3));
                this._shown = { value: mixed.toString(), background: mixed };
                element.style.setProperty(this._variable, this._shown.value);
                transition.frame = requestAnimationFrame(step);
            }
            else {
                this.stopColorTransition();
                this._shown = { value, background: to };
            }
        };
        transition.frame = requestAnimationFrame(step);
    }

    private stopColorTransition(): void {
        if (this._colorTransition) {
            cancelAnimationFrame(this._colorTransition.frame);
            this._colorTransition.element.style.removeProperty(this._variable);
            this._colorTransition = null;
        }
    }

    /** Fades out the previous background (unless a fade is running - restarting it would flash the previous background). */
    private fadeOut(element: HTMLElement, previousValue: string): void {
        if (this._fade?.playState === 'running')
            return;

        this._host.style.setProperty(BackgroundTransition.PreviousBackgroundVar, previousValue);
        this._fade = element.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: Consts.TransitionDuration,
            easing: Consts.TransitionEasing,
            pseudoElement: '::before'
        });
    }
}
