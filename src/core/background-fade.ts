import { css, CSSResult, unsafeCSS } from 'lit';
import { Consts } from '../types/consts';
import { Background } from './colors/background';

/**
 * Fades out the previous background of an element when a gradient takes part in the change. CSS can't transition a gradient,
 * so the element would jump to the new colors while its text fades to them (plain colors fade by the element's transition).
 * The previous background is painted by the element's ::before (see getStyles) and faded out by the Web Animations API.
 */
export class BackgroundFade {
    private static readonly PreviousBackgroundVar = '--hue-previous-background';

    private readonly _host: HTMLElement;
    private _shown: { value: string, isGradient: boolean } | null = null;
    private _animation: Animation | null = null;

    /**
     * @param host Element holding the variable with the previous background (inherited by the faded element).
     */
    public constructor(host: HTMLElement) {
        this._host = host;
    }

    /**
     * Styles of the faded element - its ::before under the content with the previous background.
     * @param selector Selector of the faded element.
     * @param shadow CSS value of the brightness shadow of the element (the ::before covers the element's own inset shadow).
     */
    public static getStyles(selector: string, shadow: string): CSSResult {
        return css`
    ${unsafeCSS(selector)} {
        /* the ::before stays under the content */
        isolation: isolate;
    }
    ${unsafeCSS(selector)}::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        background: var(${unsafeCSS(BackgroundFade.PreviousBackgroundVar)}, transparent);
        box-shadow: ${unsafeCSS(shadow)};
        opacity: 0;
        pointer-events: none;
    }
    `;
    }

    /** Forgets the shown background - the next update applies its background without fading. */
    public reset(): void {
        this._shown = null;
    }

    /**
     * Call with every new background of the element (before it is applied).
     * @param element The faded element (null when not rendered yet - nothing is faded).
     * @param background The new background, null for a theme background.
     * @param value CSS value of the new background.
     */
    public update(element: Element | null, background: Background | null, value: string): void {
        const previous = this._shown;
        const isGradient = !!background?.isGradient;
        this._shown = { value, isGradient };

        if (!element || !previous || previous.value === value || !(previous.isGradient || isGradient))
            return;

        // a fade is still running (e.g. a light transition reported step by step) - restarting it would show
        // the previous background at full again and the element would flash, so the small step is applied at once
        if (this._animation?.playState === 'running')
            return;

        this._host.style.setProperty(BackgroundFade.PreviousBackgroundVar, previous.value);
        this._animation = element.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: Consts.TransitionDuration,
            easing: Consts.TransitionEasing,
            pseudoElement: '::before'
        });
    }
}
