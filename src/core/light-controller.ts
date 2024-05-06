import { HomeAssistant } from 'custom-card-helpers';
import { HassLightColorMode, HassLightEntity } from '../types/types-hass';
import { ensureEntityDomain } from '../types/extensions';
import { ISingleLightContainer, ILightFeatures } from '../types/types-interface';
import { Background } from './colors/background';
import { Color } from './colors/color';
import { StaticTextTemplate } from './hass-text-template';
import { LightFeatures } from './light-features';
import { NotifyBase } from './notify-base';
import { SceneData } from '../types/types-config';
import { LightState } from './light-state';

/**
 * Serves as controller for single light.
 */
export class LightController extends NotifyBase<LightController> implements ISingleLightContainer {
    private _entity_id: string;
    private _hass: HomeAssistant;
    private _entity: HassLightEntity;
    private _entityFeatures: LightFeatures;

    public constructor(entity_id: string) {
        super();

        ensureEntityDomain(entity_id, 'light');

        this._entity_id = entity_id;
        this._lightState = new LightState(<HassLightEntity>{ state: 'unavailable' });
    }

    public set hass(value: HomeAssistant) {
        this._hass = value;
        if (!this._hass.states) {
            throw new Error('No \'states\' available on passed hass instance.');
        }

        this._entity = <HassLightEntity>this._hass.states[this._entity_id];
        if (!this._entity) {
            throw new Error(`Entity '${this._entity_id}' not found in states.`);
        }

        this._lightState.refresh(this._entity);
        this._entityFeatures = new LightFeatures(this._entity);
        this.raisePropertyChanged('hass');
    }

    //#region Info

    public getLights(): ISingleLightContainer[] {
        return [this];
    }

    public getIcon() {
        return this._entity && this._entity.attributes.icon;
    }

    public getTitle() {
        return new StaticTextTemplate(this._entity.attributes.friendly_name ?? this._entity_id);
    }

    public getEntityId(): string {
        return this._entity_id;
    }

    public get features(): ILightFeatures {
        return this._entityFeatures;
    }

    //#endregion

    //#region StateCache

    private readonly _lightState: LightState;

    private notifyTurnOn(sceneData?: SceneData): void {
        this._lightState.state = 'on';

        // try read brightness from scene
        const brightnessValue = sceneData?.getBrightnessValue();
        if (brightnessValue) {
            this._lightState.brightnessValue = brightnessValue;
        }

        this.raisePropertyChanged('isOn', 'isOff', 'brightnessValue');
    }

    private notifyTurnOff(): void {
        this._lightState.state = 'off';
        this._lightState.brightnessValue = 0;

        this.raisePropertyChanged('isOn', 'isOff', 'brightnessValue');
    }

    private notifyBrightnessValueChanged(value: number): void {
        this._lightState.brightnessValue = value;
        this._lightState.state = value > 0 ? 'on' : 'off';

        this.raisePropertyChanged('isOn', 'isOff', 'brightnessValue');
    }

    private notifyColorTempChanged(value: number): void {
        this._lightState.colorTemp = value;
        this._lightState.colorMode = HassLightColorMode.color_temp;

        this.raisePropertyChanged('colorTemp', 'colorMode');
    }

    private notifyColorChanged(value: Color, mode: HassLightColorMode): void {
        this._lightState.colorTemp = null;
        this._lightState.colorMode = mode;
        this._lightState.color = value;

        this.raisePropertyChanged('colorTemp', 'colorMode', 'color');
    }

    //#endregion

    //#region State ON/OFF

    public isUnavailable(): boolean {
        return this._lightState.isUnavailable();
    }
    public isOn(): boolean {
        return this._lightState.isOn();
    }
    public isOff(): boolean {
        return !this.isOn();
    }
    public turnOn(scene?: string | SceneData): void {
        this.toggle(true, scene);
    }
    public turnOff(): void {
        this.toggle(false);
    }
    private toggle(on: boolean, scene?: string | SceneData) {
        if (this.isUnavailable())
            return;

        if (on) {

            let activateScene = false;
            // we want the scene to activate
            if (typeof scene === 'string') {
                activateScene = true;
                scene = new SceneData(scene);
                scene.hass = this._hass;
            }

            this.notifyTurnOn(scene);

            // if scene is passed, activate it
            if (scene) {

                // if scene id was passed, activate it
                if (activateScene) {
                    scene.hass = this._hass;
                    scene.activate();
                }

                return;
            }
        }
        else {
            this.notifyTurnOff();
        }
        this._hass.callService('light', on ? 'turn_on' : 'turn_off', { entity_id: this._entity_id });
    }

    //#endregion

    //#region Brightness Value

    public get brightnessValue() {
        return this._lightState.brightnessValue;
    }
    public set brightnessValue(value: number) {
        // just to be sure
        if (value < 0) {
            value = 0;
        }
        else if (value > 100) {
            value = 100;
        }

        this.notifyBrightnessValueChanged(value);
        const brightness = Math.round((value / 100.0) * 255); // value is 0-100
        this._hass.callService('light', 'turn_on', {
            entity_id: this._entity_id,
            ['brightness']: brightness
        });
    }

    //#endregion

    //#region Color mode

    public get colorMode(): HassLightColorMode {
        return this._lightState.colorMode;
    }

    public isColorModeColor(): boolean {
        return this._lightState.isColorModeColor();
    }

    public isColorModeTemp(): boolean {
        return this._lightState.isColorModeTemp();
    }

    //#endregion

    //#region Color Temp

    public get colorTemp(): number | null {
        return this._lightState.colorTemp;
    }
    public set colorTemp(newTemp: number | null) {
        if (!newTemp)
            return;

        const minTemp = this._entity?.attributes?.min_color_temp_kelvin ?? 2000;
        const maxTemp = this._entity?.attributes?.max_color_temp_kelvin ?? 6500;

        // just to be sure
        if (newTemp < minTemp) {
            newTemp = minTemp;
        }
        else if (newTemp > maxTemp) {
            newTemp = maxTemp;
        }

        this.notifyColorTempChanged(newTemp);
        this._hass.callService('light', 'turn_on', {
            entity_id: this._entity_id,
            ['kelvin']: newTemp
        });
    }

    //#endregion

    //#region Color

    public get color(): Color | null {
        return this._lightState.color;
    }
    public set color(newColor: Color | null) {
        if (!newColor)
            return;

        let mode: HassLightColorMode;
        const serviceData: Record<string, unknown> = { entity_id: this._entity_id };
        if (newColor.getOriginalMode() == 'hsv') {
            mode = HassLightColorMode.hs;
            serviceData.hs_color = [newColor.getHue(), newColor.getSaturation() * 100];
        }
        else {
            mode = HassLightColorMode.rgb;
            serviceData.rgb_color = [newColor.getRed(), newColor.getGreen(), newColor.getBlue()];
        }

        this.notifyColorChanged(newColor, mode);
        this._hass.callService('light', 'turn_on', serviceData);
    }

    //#endregion

    private _lastBackground: Background;
    public getBackground(): Background | null {
        let temp: number | null;
        let color: Color | null;

        let bgColor: Color | null = null;
        if (this.isColorModeTemp() && (temp = this.colorTemp)) {
            const [r, g, b] = Color.hueTempToRgb(temp);
            bgColor = new Color(r, g, b);
        }
        else if (this.isColorModeColor() && (color = this.color)) {
            bgColor = color;
        }

        if (!bgColor) {
            if (this._lastBackground)
                return this._lastBackground;

            return null;
        }

        this._lastBackground = new Background([bgColor]);
        return this._lastBackground;
    }
}

