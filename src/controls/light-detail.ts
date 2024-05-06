import { customElement, property } from 'lit/decorators.js';
import { html, unsafeStatic } from 'lit/static-html.js';
import { cache } from 'lit/directives/cache.js';
import { styleMap } from 'lit/directives/style-map.js';
import { IdLitElement } from '../core/id-lit-element';
import { Consts } from '../types/consts';
import { PropertyValues, css, unsafeCSS } from 'lit';
import { HueBrightnessRollup, IRollupValueChangeEventDetail } from './brightness-rollup';
import { HueColorTempPicker, IHueColorTempPickerEventDetail } from './color-temp-picker';
import { HueColorTempPickerMarker } from './color-temp-picker.marker';
import { HueColorTempModeSelector } from './color-temp-mode-selector';
import { HaControlSwitch } from '../types/types-hass';
import { HueBigSwitch } from './big-switch';
import { IconHelper } from '../core/icon-helper';
import { AreaLightController } from '../core/area-light-controller';
import { ILightContainer, ISingleLightContainer } from '../types/types-interface';
import { Action1 } from '../types/functions';

@customElement(HueLightDetail.ElementName)
export class HueLightDetail extends IdLitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-light-detail' + Consts.ElementPostfix;

    private _colorPicker: HueColorTempPicker;
    private _modeSelector: HueColorTempModeSelector;
    private _lightMarkerManager: LightMarkerManager;
    private _brightnessRollup: HueBrightnessRollup;

    public constructor() {
        super('HueLightDetail');

        this.hide(true);
    }

    @property()
    public areaController: AreaLightController;

    @property()
    public lightContainer: ILightContainer | null = null;

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

        const lightFeatures = this.lightContainer.features;

        this._modeSelector.showColor = lightFeatures.color;
        this._modeSelector.showTemp = lightFeatures.colorTemp;
        if (lightFeatures.colorTemp &&
            lightFeatures.colorTempMinKelvin &&
            lightFeatures.colorTempMaxKelvin) {
            // set new temp range
            this._colorPicker.setTempRange(lightFeatures.colorTempMinKelvin, lightFeatures.colorTempMaxKelvin);
        }

        // show full-sized brightness picker
        if (lightFeatures.isOnlyBrightness()) {
            this._modeSelector.mode = 'brightness';
            this.toggleFullSizedBrightness(true);
        }
        else {
            this._modeSelector.selectPossibleMode();
            this.toggleFullSizedBrightness(false);
        }

        this.onLightContainerState(this.lightContainer, true);// set mode, when changing light
    }

    private createAreaControllerMarkers() {
        if (this.areaController && this._lightMarkerManager) {
            this._lightMarkerManager.clear();
            this.areaController.getLights().forEach(l => this._lightMarkerManager.add(l));
        }
    }

    private setLightContainerFromPicker(lights: ISingleLightContainer[]) {
        if (lights.length == 1) {
            this.lightContainer = lights[0];
        }
        else {
            const entities = lights.map(l => l.getEntityId());
            const controller = new AreaLightController(entities, this.areaController.defaultColor);
            this.lightContainer = controller;
        }

        this.dispatchEvent(new Event('lightcontainer-change'));
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

    private onLightContainerState(light: ILightContainer, activate = false) {
        const lights = light.getLights();
        let singleLight = null;
        if (lights.length == 1) {
            singleLight = lights[0];
        }

        if (singleLight) {
            this._lightMarkerManager.applyState(singleLight);
        }

        // only apply current state if activating or the light is the selected one
        if (this.lightContainer == light) {

            // enable or disable brightness rollup
            this._brightnessRollup.enabled = light.isOn();
        }

        if (activate && singleLight) {

            if (singleLight.isColorModeColor()) {
                this._modeSelector.mode = 'color';
            }
            else if (singleLight.isColorModeTemp()) {
                this._modeSelector.mode = 'temp';
            }

            const marker = this._lightMarkerManager.getMarker(singleLight);
            marker?.setActive();
        }
    }

    private onColorChanged(ev: CustomEvent<IHueColorTempPickerEventDetail>) {
        const marker = ev.detail.marker;
        const light = this._lightMarkerManager.getLight(marker);

        if (ev.detail.mode == 'temp') {
            light.colorTemp = ev.detail.newTemp;
        }
        else if (ev.detail.mode == 'color') {
            light.color = ev.detail.newColor;
        }
    }

    public activate(light: ISingleLightContainer) {
        const marker = this._lightMarkerManager.getMarker(light);
        if (marker) {
            marker.setActive();
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

        // check for visibility
        const wasVisible = this.classList.contains('visible');

        this.classList.remove('visible');
        if (instant) {
            this.style.display = 'none';
        }
        else {
            this._hideTimeout = setTimeout(() => {
                this._hideTimeout = null;
                this.style.display = 'none';
            }, 300);
        }

        // remove temporary overflow allowing
        if (this.parentElement) {
            this.parentElement.style.overflow = '';
        }

        // fire hide event (only when the element was visible)
        if (wasVisible) {
            this.dispatchEvent(new CustomEvent('hide'));
        }
    }

    private brightnessValueChanged(ev: CustomEvent<IRollupValueChangeEventDetail>) {
        if (this.lightContainer) {
            this.lightContainer.brightnessValue = ev.detail.newValue;
        }
    }

    private registerLightsPropertyChanged(areaController: AreaLightController) {
        areaController.getLights().forEach(l => {
            l.registerOnPropertyChanged(this._elementId, () => {
                this.onLightContainerState(l);
                this.requestUpdate();
            }, /* includeHass: */ true);
        });
    }

    private unregisterLightsPropertyChanged(areaController: AreaLightController) {
        areaController.getLights().forEach(l => l.unregisterOnPropertyChanged(this._elementId));
    }

    protected override updated(changedProps: PropertyValues<HueLightDetail>): void {
        // register all lights from controller
        if (changedProps.has('areaController')) {
            const oldValue = changedProps.get('areaController') as AreaLightController | null;
            if (oldValue) {
                this.unregisterLightsPropertyChanged(oldValue);
            }
            if (this.areaController) {
                this.registerLightsPropertyChanged(this.areaController);
                this.createAreaControllerMarkers();
            }
        }

        // register all lights from controller
        if (changedProps.has('lightContainer')) {
            if (this.areaController) {
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

    private _lastRenderedContainer: ILightContainer | null;
    protected override render() {
        this._lastRenderedContainer = this.lightContainer || this._lastRenderedContainer;
        const onlySwitch = this._lastRenderedContainer?.features.isEmpty() == true;

        return html`
        <div>
            <ha-icon-button-prev class='back-button' @click=${() => this.hide()}></ha-icon-button-prev>
            ${cache(onlySwitch ? this.createSwitchDetail() : this.createFullDetail())}
        </div>`;
    }

    private onSwitch(ctrl: ILightContainer, ev: Event) {
        const target = <HaControlSwitch>ev.target;
        if (!target)
            return;

        const checked = target.checked;
        if (checked) {
            ctrl.turnOn();
        }
        else {
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

        if (this.areaController) {
            this.registerLightsPropertyChanged(this.areaController);
        }

        this.updateComplete.then(() => {
            if (!this._colorPicker) {
                this._colorPicker = <HueColorTempPicker>this.renderRoot.querySelector('.color-picker');
                this._lightMarkerManager = new LightMarkerManager(this._colorPicker, l => this.setLightContainerFromPicker(l));
                this.createAreaControllerMarkers();
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

    public override disconnectedCallback(): void {
        super.disconnectedCallback();

        if (this.areaController) {
            this.unregisterLightsPropertyChanged(this.areaController);
        }
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

        // if there is more vertical space, move the color wheel to the center
        const verticalSpace = this.clientHeight - size - (HueLightDetail.colorPickerMarginTop + HueLightDetail.colorPickerMarginBottom);
        if (verticalSpace > 0) {
            const addMargin = verticalSpace / 2;
            colorPicker.style.marginTop = (HueLightDetail.colorPickerMarginTop + addMargin) + 'px';
            colorPicker.style.marginBottom = (HueLightDetail.colorPickerMarginBottom + addMargin) + 'px';
        }
        else {
            colorPicker.style.marginTop = '';
            colorPicker.style.marginBottom = '';
        }
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
            let rollupSize = size / 3;
            // need to ensure, there's enough space for "100 %" label above rollup
            if (rollupSize < 56)
                rollupSize = 56;

            rollup.style.width = rollupSize + 'px';
            rollup.width = rollupSize;
            rollup.height = rollup.heightOpened = size;
            rollup.iconSize = HueLightDetail.rollupBigIconSize;
        }
        else {
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

class LightMarkerManager {
    private _markerToLight: Record<string, ISingleLightContainer>;
    private _lightToMarker: Record<string, HueColorTempPickerMarker>;
    private _picker: HueColorTempPicker;
    private _onMarkerActivation: Action1<ISingleLightContainer[]>;

    public constructor(picker: HueColorTempPicker, onMarkerActivation: Action1<ISingleLightContainer[]>) {
        this._picker = picker;
        this._onMarkerActivation = onMarkerActivation;

        this._picker.addEventListener('activemarkers-change', _ => {
            const markers = this._picker.getActiveMarkers();
            const lights = markers.map(m => this.getLight(m)).filter(m => !!m);
            if (lights.length) {
                // could not resolve markers to lights - event fired probably after adding new marker
                this._onMarkerActivation(lights);
            }
        });

        this.clear();
    }

    public add(light: ISingleLightContainer) {
        // no marker for light without color/temp features
        if (light.features.isEmpty() || light.features.isOnlyBrightness())
            return;

        const marker = this._picker.addMarker();
        marker.icon = light.getIcon() || IconHelper.getIcon(1);

        // fixed mode for lights that supports only single mode
        if (!light.features.color && light.features.colorTemp) {
            marker.fixedMode = 'temp';
        }
        else if (light.features.color && !light.features.colorTemp) {
            marker.fixedMode = 'color';
        }

        this._markerToLight[marker.name] = light;
        this._lightToMarker[light.getEntityId()] = marker;

        this.applyState(light);
    }

    /** Will apply current light state to corresponding marker. */
    public applyState(light: ISingleLightContainer) {
        const marker = this.getMarker(light);
        if (!marker || marker.isDrag)
            return;

        if (light.isColorModeColor()) {
            if (light.color) {
                marker.color = light.color;
            }
        }
        else if (light.isColorModeTemp()) {
            if (light.colorTemp) {
                marker.temp = light.colorTemp;
            }
        }

        // show marker as off
        marker.isOff = !light.isOn(); // unavailable state will be also off
    }

    public getLight(marker: HueColorTempPickerMarker) {
        return this._markerToLight[marker.name];
    }

    public getMarker(light: ISingleLightContainer) {
        return this._lightToMarker[light.getEntityId()];
    }

    /** Will delete all items from this map. */
    public clear() {
        this._markerToLight = {};
        this._lightToMarker = {};
        this._picker.clearMarkers();
    }
}