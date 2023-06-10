import { customElement, property } from 'lit/decorators.js';
import { html, unsafeStatic } from 'lit/static-html.js';
import { IdLitElement } from '../core/id-lit-element';
import { Consts } from '../types/consts';
import { ILightContainer } from '../types/types-interface';
import { PropertyValues, css, unsafeCSS } from 'lit';
import { HueBrightnessRollup, IRollupValueChangeEventDetail } from './brightness-rollup';
import { HueColorTempPicker } from './color-temp-picker';

/*
 * TODO:
 * - disabled brightness control when light is off
 * - hide (brightness, color, temp) controls when light doesn't support it
 * - get/set light color for ILightContainer
 * - color/temp picker mode changer
 * - bind light to picker
 */

@customElement(HueLightDetail.ElementName)
export class HueLightDetail extends IdLitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-light-detail' + Consts.ElementPostfix;

    private static readonly colorPickerMargin = 12;

    public constructor() {
        super('HueLightDetail');

        this.hide(true);
    }

    @property() public lightContainer: ILightContainer | null = null;

    public static override styles = css`
    :host {
        margin-top: -30px;
        opacity: 0;
        transition:${unsafeCSS(Consts.TransitionDefault)};
    }
    :host(.visible) {
        margin-top: 0;
        opacity: 1;
    }

    .color-picker {
        display: block;
        margin: ${HueLightDetail.colorPickerMargin}px auto;
    }
    .brightness-picker {
        position: absolute;
        bottom: 10px;
        right: 10px;
    }
    `;

    /** Will show this element (with animation). */
    public show() {
        this.style.removeProperty('display');
        setTimeout(() => this.classList.add('visible'));
        this.updateColorPickerSize();
    }

    /** Will hide this element (with animation). */
    public hide(instant = false) {
        this.classList.remove('visible');
        if (instant) {
            this.style.display = 'none';
        } else {
            setTimeout(() => {
                this.style.display = 'none';
            }, 300);
        }
    }

    private valueChanged(ev: CustomEvent<IRollupValueChangeEventDetail>) {
        if (this.lightContainer) {
            this.lightContainer.brightnessValue = ev.detail.newValue;
        }
    }

    protected override updated(changedProps: PropertyValues<HueLightDetail>): void {
        // register for changes on light
        if (changedProps.has('lightContainer')) {
            const oldValue = changedProps.get('lightContainer') as ILightContainer | null;
            if (oldValue) {
                oldValue.unregisterOnPropertyChanged(this._id);
            }
            if (this.lightContainer) {
                this.lightContainer.registerOnPropertyChanged(this._id, () => this.requestUpdate());
            }
        }
    }

    private _lastRenderedContainer: ILightContainer | null;
    protected override render() {
        this._lastRenderedContainer = this.lightContainer || this._lastRenderedContainer;
        const value = this._lastRenderedContainer?.brightnessValue || 100;

        return html`
        <div>
            <${unsafeStatic(HueColorTempPicker.ElementName)} class='color-picker'
                mode='color'
            >
            </${unsafeStatic(HueColorTempPicker.ElementName)}>
            <div class='color-picker'></div>
            <${unsafeStatic(HueBrightnessRollup.ElementName)} class='brightness-picker'
                width='60'
                height='40'
                .value=${value}
                @change=${(ev: CustomEvent) => this.valueChanged(ev)}
            >
            </${unsafeStatic(HueBrightnessRollup.ElementName)}>
        </div>`;
    }

    private updateColorPickerSize(): void {
        const colorPicker = <HueColorTempPicker>this.renderRoot.querySelector('.color-picker');
        const maxSize = Math.min(this.clientHeight, this.clientWidth);
        if (maxSize == 0) // not rendered
            return;
        const size = maxSize - 2 * HueLightDetail.colorPickerMargin;
        colorPicker.style.width = size + 'px';
        colorPicker.style.height = size + 'px';
    }
}