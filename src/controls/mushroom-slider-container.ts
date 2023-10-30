import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Consts } from '../types/consts';

/*
 * This is container for mushroom-slider, which will create margin and style the slider in the way, we need.
 * 
 * using: https://github.com/phischdev/lovelace-mushroom-better-sliders/blob/main/src/shared/slider.ts
 * inspiration: https://github.com/phischdev/lovelace-mushroom-better-sliders/blob/main/src/cards/light-card/controls/light-brightness-control.ts
 */

@customElement(HueMushroomSliderContainer.ElementName)
export class HueMushroomSliderContainer extends LitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-mushroom-slider-container' + Consts.ElementPostfix;

    // Consts
    private static readonly MarginTop = 8;
    private static readonly Margin = 14;
    private static readonly Height = 28;

    // Property mirrors

    @property({ type: Boolean })
    public disabled: boolean = false;

    @property({ attribute: false, type: Number, reflect: true })
    public value?: number;

    @property({ type: Number })
    public step: number = 1;

    @property({ type: Number })
    public min: number = 0;

    @property({ type: Number })
    public max: number = 100;

    private onChange(e: CustomEvent<{ value: number }>): void {
        this.value = e.detail.value;
        this.dispatchEvent(
            new CustomEvent('change', {
                detail: {
                    value: this.value
                }
            })
        );
    }

    private onCurrentChange(e: CustomEvent<{ value?: number }>): void {
        const value = e.detail.value;
        this.dispatchEvent(
            new CustomEvent('current-change', {
                detail: {
                    value
                }
            })
        );
    }

    protected override render() {
        return html`
            <mushroom-slider
                .disabled=${this.disabled}
                .value=${this.value}
                .step=${this.step}
                .min=${this.min}
                .max=${this.max}
                .showActive=${true}
                @change=${this.onChange}
                @current-change=${this.onCurrentChange}
            />
        `;
    }

    public static override get styles() {
        return css`
            :host {
                display: inline;

                /* colors */
                --slider-color: var(--dark-primary-color, var(--primary-color));
                --slider-outline-color: transparent;
                --slider-bg-color: rgba(0,0,0,0.3);
            }
            mushroom-slider {
                display: inline-block;
                width: calc(100% - ${2 * HueMushroomSliderContainer.Margin}px);
                margin-top: ${HueMushroomSliderContainer.MarginTop}px;
                margin-left: ${HueMushroomSliderContainer.Margin}px;
                margin-right: ${HueMushroomSliderContainer.Margin}px;

                /* colors */
                --main-color: var(--slider-color);
                --bg-color: var(--slider-bg-color);
                --bg-color-inactive: var(--slider-bg-color);
                --main-outline-color: var(--slider-outline-color);

                /* base styles: */
                --control-height: var(--mush-control-height, ${HueMushroomSliderContainer.Height}px);
                --control-border-radius: var(--mush-control-border-radius, 12px);
            }
        `;
    }
}