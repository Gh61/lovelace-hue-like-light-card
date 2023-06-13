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
 * - black marker, if light is off
 * - hide (brightness, color, temp) controls when light doesn't support it
 * - improve performance of color/temp picker (cache generated canvas)
 * - tweek automatic click action to always open hue-screen
 * - fix mobile design
 * - change documentation + add screenshot
 */

@customElement(HueLightDetail.ElementName)
export class HueLightDetail extends IdLitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-light-detail' + Consts.ElementPostfix;
    private static readonly colorPickerMarginTop = 40;
    private static readonly colorPickerMarginBottom = 20;
    private static readonly rollupWidth = 60;
    private static readonly rollupHeight = 40;
    private static readonly rollupHeightOpen = 200;

    private _colorPicker: HueColorTempPicker;
    private _modeSelector: HueColorTempModeSelector;
    private _colorMarker: HueColorTempPickerMarker;
    private _brightnessRollup: HueBrightnessRollup;

    public constructor() {
        super('HueLightDetail');

        this.hide(true);
    }

    @property()
    public lightContainer: LightContainer | null = null;

    /**
     * Called after new lightContainer is set.
     */
    private onLightContainerChanged() {
        if (!this.lightContainer)
            return;

        // TODO: light features

        this._colorMarker.icon = this.lightContainer.getIcon() || Consts.DefaultOneIcon;
        this._modeSelector.showColor = this.lightContainer.features.color;
        this._modeSelector.showTemp = this.lightContainer.features.colorTemp;

        // show full-sized brightness picker
        if (this.lightContainer.features.isOnlyBrightness()) {
            this._modeSelector.mode = 'brightness';
            this.toggleFullSizedBrightness(true);
        } else {
            this._modeSelector.selectPossibleMode();
            this.toggleFullSizedBrightness(false);
        }

        this.onLightContainerState();
    }

    private toggleFullSizedBrightness(show: boolean) {
        if (show) {
            this._colorPicker.style.display = 'none';
        }
        this.updateBrightnessRollupSize(show);
        if (!show) {
            this._colorPicker.style.display = '';
        }
    }

    private onLightContainerState() {
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
        // enable or disable brightness rollup
        this._brightnessRollup.enabled = this.lightContainer.isOn();
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
        if (this._hideTimeout) {
            clearTimeout(this._hideTimeout);
            this._hideTimeout = null;
        }

        this.style.removeProperty('display');
        setTimeout(() => this.classList.add('visible'));
        this.updateColorPickerSize();

        // to allow the color marker to overflow parent div
        if (this.parentElement) {
            this.parentElement.style.overflow = 'visible';
        }

        // fire show event
        this.dispatchEvent(new CustomEvent('show'));
    }

    private _hideTimeout: NodeJS.Timeout | null;

    /** Will hide this element (with animation). */
    public hide(instant = false) {
        this.classList.remove('visible');
        if (instant) {
            this.style.display = 'none';
        } else {
            this._hideTimeout = setTimeout(() => {
                this._hideTimeout = null;
                this.style.display = 'none';
            }, 300);
        }

        // remove temporary overflow allowing
        if (this.parentElement) {
            this.parentElement.style.overflow = '';
        }

        // fire hide event
        this.dispatchEvent(new CustomEvent('hide'));
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
                    this.onLightContainerState();
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

    .back-button {
        color: white;
        position: absolute;
        top: 10px;
        left: 10px;
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
    .brightness-rollup {
        position: absolute;
        bottom: 10px;
        right: 10px;
    }
    .brightness-rollup.full-size {
        position:static;
        display:block;
        margin: ${HueLightDetail.colorPickerMarginTop - 25}px auto ${HueLightDetail.colorPickerMarginBottom}px auto;
    }
    `;

    private _lastRenderedContainer: LightContainer | null;
    protected override render() {
        this._lastRenderedContainer = this.lightContainer || this._lastRenderedContainer;
        const value = this._lastRenderedContainer?.brightnessValue ?? 100;

        return html`
        <div>
            <ha-icon-button-prev class='back-button' @click=${() => this.hide()}></ha-icon-button-prev>
            <${unsafeStatic(HueColorTempPicker.ElementName)} class='color-picker'
                mode='color'
                @change=${(ev: CustomEvent) => this.onColorChanged(ev)}
            >
            </${unsafeStatic(HueColorTempPicker.ElementName)}>
            <${unsafeStatic(HueColorTempModeSelector.ElementName)} class='mode-selector'>
            </${unsafeStatic(HueColorTempModeSelector.ElementName)}>
            <${unsafeStatic(HueBrightnessRollup.ElementName)} class='brightness-rollup'
                width='${HueLightDetail.rollupWidth}'
                height='${HueLightDetail.rollupHeight}'
                heightOpened='${HueLightDetail.rollupHeightOpen}'
                .value=${value}
                @change=${(ev: CustomEvent) => this.brightnessValueChanged(ev)}
            >
            </${unsafeStatic(HueBrightnessRollup.ElementName)}>
        </div>`;
    }

    public override connectedCallback(): void {
        super.connectedCallback();

        this.updateComplete.then(() => {
            if (!this._colorPicker) {
                this._colorPicker = <HueColorTempPicker>this.renderRoot.querySelector('.color-picker');
                this._colorMarker = this._colorPicker.addMarker();
            }

            // get mode-selector and give it colorPicker
            if (!this._modeSelector) {
                this._modeSelector = <HueColorTempModeSelector>this.renderRoot.querySelector('.mode-selector');
                this._modeSelector.colorPicker = this._colorPicker;
            }

            if (!this._brightnessRollup) {
                this._brightnessRollup = <HueBrightnessRollup>this.renderRoot.querySelector('.brightness-rollup');
            }
        });
    }

    private updateColorPickerSize(): void {
        const colorPicker = <HueColorTempPicker>this.renderRoot.querySelector('.color-picker');
        const size = this.getPickerSize();
        if (!size) // not rendered
            return;

        colorPicker.style.width = size + 'px';
        colorPicker.style.height = size + 'px';
    }

    private updateBrightnessRollupSize(setFullSize: boolean): void {
        const rollup = <HueBrightnessRollup>this.renderRoot.querySelector('.brightness-rollup');
        const size = this.getPickerSize();
        if (!size) // not rendered
            return;

        rollup.classList.toggle('full-size', setFullSize);
        if (setFullSize) {
            rollup.style.width = size / 3 + 'px';
            rollup.width = size / 3;
            rollup.height = rollup.heightOpened = size;
        } else {
            rollup.style.width = '';
            rollup.width = HueLightDetail.rollupWidth;
            rollup.height = HueLightDetail.rollupHeight;
            rollup.heightOpened = HueLightDetail.rollupHeightOpen;
        }
    }

    private getPickerSize(): number | null {
        const maxSize = Math.min(this.clientHeight, this.clientWidth);
        if (maxSize == 0) // not rendered
            return null;
        const size = maxSize - (HueLightDetail.colorPickerMarginTop + HueLightDetail.colorPickerMarginBottom);
        return size;
    }
}