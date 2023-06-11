import { customElement, property } from 'lit/decorators.js';
import { html, unsafeStatic } from 'lit/static-html.js';
import { IdLitElement } from '../core/id-lit-element';
import { Consts } from '../types/consts';
import { PropertyValues, css, unsafeCSS } from 'lit';
import { HueBrightnessRollup, IRollupValueChangeEventDetail } from './brightness-rollup';
import { HueColorTempPicker, HueColorTempPickerMarker, IHueColorTempPickerEventDetail } from './color-temp-picker';
import { LightContainer } from '../core/light-container';
import { HueColorTempModeSelector } from './color-temp-mode-selector';

/*
 * TODO:
 * - disabled brightness control when light is off
 * - hide (brightness, color, temp) controls when light doesn't support it
 * - closing the colorpicker (back button or ESC)
 */

@customElement(HueLightDetail.ElementName)
export class HueLightDetail extends IdLitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-light-detail' + Consts.ElementPostfix;
    private static readonly colorPickerMarginTop = 40;
    private static readonly colorPickerMarginBottom = 20;

    private _modeSelector: HueColorTempModeSelector;
    private _colorMarker: HueColorTempPickerMarker;

    public constructor() {
        super('HueLightDetail');

        this.hide(true);
    }

    @property() public lightContainer: LightContainer | null = null;

    /**
     * Called after new lightContainer is set.
     */
    private onLightContainerChanged() {
        if (!this.lightContainer)
            return;

        // TODO: light features

        this._colorMarker.icon = this.lightContainer.getIcon() || Consts.DefaultOneIcon;

        this.onLightContainerColorChanged();
    }

    private onLightContainerColorChanged() {
        if (!this.lightContainer)
            return;

        if (this.lightContainer.isColorModeColor()) {
            this._modeSelector.mode = 'color';
            if (this.lightContainer.color) {
                this._colorMarker.color = this.lightContainer.color;
            }
        } else if (this.lightContainer.isColorModeTemp()) {
            this._modeSelector.mode = 'temp';
            if (this.lightContainer.colorTemp) {
                this._colorMarker.temp = this.lightContainer.colorTemp;
            }
        }
    }

    private onColorChanged(ev: CustomEvent<IHueColorTempPickerEventDetail>) {
        if (!this.lightContainer)
            return;

        if (ev.detail.mode == 'temp') {
            this.lightContainer.colorTemp = ev.detail.newTemp;
        } else if (ev.detail.mode == 'color') {
            this.lightContainer.color = ev.detail.newColor;
        }
    }

    /** Will show this element (with animation). */
    public show() {
        this.style.removeProperty('display');
        setTimeout(() => this.classList.add('visible'));
        this.updateColorPickerSize();

        // to allow the color marker to overflow parent div
        if (this.parentElement) {
            this.parentElement.style.overflow = 'visible';
        }
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

        // remove temporary overflow allowing
        if (this.parentElement) {
            this.parentElement.style.overflow = '';
        }
    }

    private brightnessValueChanged(ev: CustomEvent<IRollupValueChangeEventDetail>) {
        if (this.lightContainer) {
            this.lightContainer.brightnessValue = ev.detail.newValue;
        }
    }

    protected override updated(changedProps: PropertyValues<HueLightDetail>): void {
        // register for changes on light
        if (changedProps.has('lightContainer')) {
            const oldValue = changedProps.get('lightContainer') as LightContainer | null;
            if (oldValue) {
                oldValue.unregisterOnPropertyChanged(this._id);
            }
            if (this.lightContainer) {
                this.lightContainer.registerOnPropertyChanged(this._id, () => {
                    this.onLightContainerColorChanged();
                    this.requestUpdate();
                });
                this.onLightContainerChanged();
            }
        }
    }

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
        margin: ${HueLightDetail.colorPickerMarginTop}px auto ${HueLightDetail.colorPickerMarginBottom}px auto;
    }
    .mode-selector {
        position: absolute;
        bottom: 10px;
        left: 10px;
    }
    .brightness-picker {
        position: absolute;
        bottom: 10px;
        right: 10px;
    }
    `;

    private _lastRenderedContainer: LightContainer | null;
    protected override render() {
        this._lastRenderedContainer = this.lightContainer || this._lastRenderedContainer;
        const value = this._lastRenderedContainer?.brightnessValue || 100;

        return html`
        <div>
            <${unsafeStatic(HueColorTempPicker.ElementName)} class='color-picker'
                mode='color'
                @change=${(ev: CustomEvent) => this.onColorChanged(ev)}
            >
            </${unsafeStatic(HueColorTempPicker.ElementName)}>
            <${unsafeStatic(HueColorTempModeSelector.ElementName)} class='mode-selector'>
            </${unsafeStatic(HueColorTempModeSelector.ElementName)}>
            <${unsafeStatic(HueBrightnessRollup.ElementName)} class='brightness-picker'
                width='60'
                height='40'
                .value=${value}
                @change=${(ev: CustomEvent) => this.brightnessValueChanged(ev)}
            >
            </${unsafeStatic(HueBrightnessRollup.ElementName)}>
        </div>`;
    }

    protected override firstUpdated(changedProps: PropertyValues) {
        super.firstUpdated(changedProps);

        const colorPicker = <HueColorTempPicker>this.renderRoot.querySelector('.color-picker');
        this._colorMarker = colorPicker.addMarker();

        // get mode-selector and give it colorPicker
        this._modeSelector = <HueColorTempModeSelector>this.renderRoot.querySelector('.mode-selector');
        this._modeSelector.colorPicker = colorPicker;
    }

    private updateColorPickerSize(): void {
        const colorPicker = <HueColorTempPicker>this.renderRoot.querySelector('.color-picker');
        const maxSize = Math.min(this.clientHeight, this.clientWidth);
        if (maxSize == 0) // not rendered
            return;
        const size = maxSize - (HueLightDetail.colorPickerMarginTop + HueLightDetail.colorPickerMarginBottom);
        colorPicker.style.width = size + 'px';
        colorPicker.style.height = size + 'px';
    }
}