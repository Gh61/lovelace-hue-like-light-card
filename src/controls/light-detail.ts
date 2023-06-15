import { customElement, property } from 'lit/decorators.js';
import { html, unsafeStatic } from 'lit/static-html.js';
import { cache } from 'lit/directives/cache.js';
import { styleMap } from 'lit/directives/style-map.js';
import { IdLitElement } from '../core/id-lit-element';
import { Consts } from '../types/consts';
import { PropertyValues, css, unsafeCSS } from 'lit';
import { HueBrightnessRollup, IRollupValueChangeEventDetail } from './brightness-rollup';
import { HueColorTempPicker, HueColorTempPickerMarker, IHueColorTempPickerEventDetail } from './color-temp-picker';
import { LightContainer } from '../core/light-container';
import { HueColorTempModeSelector } from './color-temp-mode-selector';
import { HaControlSwitch } from '../types/types-hass';
import { HueBigSwitch } from './big-switch';

/*
 * TODO:
 * FEATURES:
 * - tweek automatic click action to always open hue-screen
 * - change documentation + add screenshot
 */

@customElement(HueLightDetail.ElementName)
export class HueLightDetail extends IdLitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-light-detail' + Consts.ElementPostfix;

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

        // render will solve this
        if (this.lightContainer.features.isEmpty()) {
            // only adjust size
            this.updateBigSwitchSize();
            return;
        }

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

        this.onLightContainerState(true);// set mode, when changing light
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

    private onLightContainerState(setMode = false) {
        if (!this.lightContainer)
            return;

        if (this.lightContainer.isColorModeColor()) {
            if (setMode) {
                this._modeSelector.mode = 'color';
            }
            if (this.lightContainer.color) {
                this._colorMarker.color = this.lightContainer.color;
            }
        } else if (this.lightContainer.isColorModeTemp()) {
            if (setMode) {
                this._modeSelector.mode = 'temp';
            }
            if (this.lightContainer.colorTemp) {
                this._colorMarker.temp = this.lightContainer.colorTemp;
            }
        }

        // show marker as off
        this._colorMarker.isOff = !this.lightContainer.isOn(); // unavailable state will be also off

        // enable or disable brightness rollup
        this._brightnessRollup.enabled = this.lightContainer.isOn();

        if (setMode) {
            this._colorMarker.boing();
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

    private static readonly colorPickerMarginTop = 40;
    private static readonly colorPickerMarginBottom = 20;
    private static readonly rollupHeight = HueColorTempModeSelector.totalHeight;
    private static readonly rollupWidth = HueColorTempModeSelector.totalHeight / 2 * 3;
    private static readonly rollupHeightOpen = 200;
    private static readonly rollupIconSize = 24;
    private static readonly rollupBigIconSize = 30;
    private static readonly selectorPadding = 24;
    private static readonly selectorBottom = 0;

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
        bottom: ${HueLightDetail.selectorBottom}px;
        left: ${HueLightDetail.selectorPadding}px;
    }
    .brightness-rollup {
        position: absolute;
        bottom: ${HueLightDetail.selectorBottom}px;
        right: ${HueLightDetail.selectorPadding}px;
    }
    .brightness-rollup.full-size {
        position:static;
        display:block;
        margin: ${HueLightDetail.colorPickerMarginTop - 25}px auto ${HueLightDetail.colorPickerMarginBottom}px auto;
    }
    .light-switch {
        margin: ${HueLightDetail.colorPickerMarginTop}px auto ${HueLightDetail.colorPickerMarginBottom}px auto;
    }
    `;

    private _lastRenderedContainer: LightContainer | null;
    protected override render() {
        this._lastRenderedContainer = this.lightContainer || this._lastRenderedContainer;
        const onlySwitch = this._lastRenderedContainer?.features.isEmpty() == true;

        return html`
        <div>
            <ha-icon-button-prev class='back-button' @click=${() => this.hide()}></ha-icon-button-prev>
            ${cache(onlySwitch ? this.createSwitchDetail() : this.createFullDetail())}
        </div>`;
    }

    private onSwitch(ctrl: LightContainer, ev: Event) {
        const target = <HaControlSwitch>ev.target;
        if (!target)
            return;

        const checked = target.checked;
        if (checked) {
            ctrl.turnOn();
        } else {
            ctrl.turnOff();
        }
    }

    private createSwitchDetail() {
        const light = this._lastRenderedContainer!;
        const colors = {
            '--control-switch-on-color': Consts.WarmColor,
            '--control-switch-off-color': Consts.OffColor
        };

        return html`
            <${unsafeStatic(HueBigSwitch.ElementName)} class='light-switch'
                vertical
                reversed
                .checked=${light.isOn()}
                .showHandle=${!light.isUnavailable()}
                @change=${(ev: Event) => this.onSwitch(light, ev)}
                style=${styleMap(colors)}
                .disabled=${light.isUnavailable()}
            >
                <ha-icon icon="mdi:power-on" slot="icon-on"></ha-icon>
                <ha-icon icon="mdi:power-off" slot="icon-off"></ha-icon>
            </${unsafeStatic(HueBigSwitch.ElementName)}>
        `;
    }

    private createFullDetail() {
        const value = this._lastRenderedContainer?.brightnessValue ?? 100;

        return html`
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
                iconSize='${HueLightDetail.rollupIconSize}'
                .value=${value}
                @change=${(ev: CustomEvent) => this.brightnessValueChanged(ev)}
            >
            </${unsafeStatic(HueBrightnessRollup.ElementName)}>
        `;
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
        if (!colorPicker)
            return;

        const size = this.getPickerSize();
        if (!size) // not rendered
            return;

        colorPicker.style.width = size + 'px';
        colorPicker.style.height = size + 'px';
    }

    private updateBrightnessRollupSize(setFullSize: boolean): void {
        const rollup = <HueBrightnessRollup>this.renderRoot.querySelector('.brightness-rollup');
        if (!rollup)
            return;

        const size = this.getPickerSize();
        if (!size) // not rendered
            return;

        rollup.classList.toggle('full-size', setFullSize);
        if (setFullSize) {
            rollup.style.width = size / 3 + 'px';
            rollup.width = size / 3;
            rollup.height = rollup.heightOpened = size;
            rollup.iconSize = HueLightDetail.rollupBigIconSize;
        } else {
            rollup.style.width = '';
            rollup.width = HueLightDetail.rollupWidth;
            rollup.height = HueLightDetail.rollupHeight;
            rollup.heightOpened = HueLightDetail.rollupHeightOpen;
            rollup.iconSize = HueLightDetail.rollupIconSize;
        }
    }

    private updateBigSwitchSize(): void {
        const lightSwitch = <HueBrightnessRollup>this.renderRoot.querySelector('.light-switch');
        if (!lightSwitch)
            return;

        const size = this.getPickerSize();
        if (!size) // not rendered
            return;

        let width = size / 3;
        if (width < 60) {
            width = 60;
        }
        const widthPx = width + 'px';
        lightSwitch.style.width = widthPx;
        lightSwitch.style.setProperty(
            '--control-switch-thickness',
            widthPx
        );
        lightSwitch.style.height = size + 'px';
    }

    private getPickerSize(): number | null {
        const maxSize = Math.min(this.clientHeight, this.clientWidth);
        if (maxSize == 0) // not rendered
            return null;
        const size = maxSize - (HueLightDetail.colorPickerMarginTop + HueLightDetail.colorPickerMarginBottom);
        return size;
    }
}