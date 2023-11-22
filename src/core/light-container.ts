import { HomeAssistant } from 'custom-card-helpers';
import { HassLightColorMode, HassLightEntity } from '../types/types-hass';
import { Consts } from '../types/consts';
import { ensureEntityDomain } from '../types/extensions';
import { ISingleLightContainer, ILightFeatures } from '../types/types-interface';
import { Background } from './colors/background';
import { Color } from './colors/color';
import { StaticTextTemplate } from './hass-text-template';
import { LightFeatures } from './light-features';
import { TimeCache, TimeCacheValue } from './time-cache';
import { NotifyBase } from './notify-base';

type CacheKeys = 'state' | 'brightnessValue' | 'colorMode' | 'colorTemp' | 'color';

export class LightContainer extends NotifyBase<LightContainer> implements ISingleLightContainer {
    private _entity_id: string;
    private _hass: HomeAssistant;
    private _entity: HassLightEntity;
    private _entityFeatures: LightFeatures;

    public constructor(entity_id: string) {
        super();

        ensureEntityDomain(entity_id, 'light');

        this._entity_id = entity_id;

        this.initTimeCache();
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

        this._entityFeatures = new LightFeatures(this._entity);
        this.raisePropertyChanged('hass');
    }

    //#region Info

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

    //#region TimeCache

    /*
     * This TimeCache is here, so the UI control can react instantly on changes.
     * When user do some change, it might take up to about 2 seconds for HA to register these changes on devices.
     * So the cache is here to tell the UI that the expected change has happened instantly.
     * After the specified interval, cached values are invalidated and in the moment of getting these values, live values are read from HA.
     */

    // TODO: also implement some change notify mechanizm

    private _cache: TimeCache<CacheKeys>;
    private _lastOnBrightnessValue: number;
    private _lastColorTemp: number | null;

    private initTimeCache(): void {
        this._cache = new TimeCache(Consts.TimeCacheInterval);// ms
        this._cache.registerProperty('state', () => new TimeCacheValue(this._entity?.state, this.getDontCacheState()));
        this._cache.registerProperty('brightnessValue', () => new TimeCacheValue(this.brightnessValueGetFactory(), this.getDontCacheBrightnessValue()));
        this._cache.registerProperty('colorMode', () => this.colorModeGetFactory());
        this._cache.registerProperty('colorTemp', () => this.colorTempGetFactory());
        this._cache.registerProperty('color', () => this.colorGetFactory());
    }

    private getDontCacheState(): boolean {
        return !this._entity || this._entity.state == 'unavailable';
    }
    private getDontCacheBrightnessValue(): boolean {
        return this.getDontCacheState() || this._entity.attributes?.brightness == null;
    }

    private notifyTurnOn(): void {
        this._cache.setValue('state', 'on');
        if (this._lastOnBrightnessValue) {
            this._cache.setValue('brightnessValue', this._lastOnBrightnessValue);
        }
    }

    private notifyTurnOff(): void {
        this._cache.setValue('state', 'off');
        this._cache.setValue('brightnessValue', 0);
    }

    private notifyBrightnessValueChanged(value: number): void {
        if (value > 0) {
            this._lastOnBrightnessValue = value;
        }
        this._cache.setValue('brightnessValue', value);
        this._cache.setValue('state', value > 0 ? 'on' : 'off');
    }

    private notifyColorTempChanged(value: number): void {
        this._lastColorTemp = value;
        this._cache.setValue('colorTemp', value);
        this._cache.setValue('colorMode', HassLightColorMode.color_temp);
    }

    private notifyColorChanged(value: Color, mode: HassLightColorMode): void {
        this._cache.setValue('colorTemp', null);
        this._cache.setValue('colorMode', mode);
        this._cache.setValue('color', value);
    }

    //#endregion

    //#region State ON/OFF

    public isUnavailable(): boolean {
        return this._cache.getValue('state') == 'unavailable';
    }
    public isOn(): boolean {
        return this._cache.getValue('state') == 'on';
    }
    public isOff(): boolean {
        return !this.isOn();
    }
    public turnOn(): void {
        this.toggle(true);
    }
    public turnOff(): void {
        this.toggle(false);
    }
    public toggle(on: boolean) {
        if (this.isUnavailable())
            return;

        if (on) {
            this.notifyTurnOn();
        }
        else {
            this.notifyTurnOff();
        }
        this._hass.callService('light', on ? 'turn_on' : 'turn_off', { entity_id: this._entity_id });
    }

    //#endregion

    //#region Brightness Value

    private brightnessValueGetFactory() {
        if (this.isOff())
            return 0;

        const attr = this._entity.attributes;
        const brightness = attr?.brightness ?? 255;
        this._lastOnBrightnessValue = Math.round((brightness / 255.0) * 100); // brightness is 0-255
        return this._lastOnBrightnessValue;
    }
    public get brightnessValue() {
        return <number>this._cache.getValue('brightnessValue');
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

    private colorModeGetFactory(): TimeCacheValue {
        let result = HassLightColorMode.unknown;
        let dontCache = true;
        if (this.isOn()) {
            const entityMode = this._entity.attributes.color_mode;
            if (entityMode) {
                result = entityMode;
                dontCache = false;

                // There is bug with unoriginal hue lights 
                // - color_temp is set only for a while, then the mode is switched back to xy (0,0) and temperature is not known

                // So, when we have last saved colortemp, and mode is xy = 00, then return color_temp
                if (this._lastColorTemp && result == HassLightColorMode.xy && this._entity.attributes.xy_color) {
                    const [x, y] = this._entity.attributes.xy_color;
                    if (x === 0 && y === 0) {
                        result = HassLightColorMode.color_temp;
                    }
                }
            }
        }

        return new TimeCacheValue(result, dontCache);
    }
    public get colorMode(): HassLightColorMode {
        return <HassLightColorMode>this._cache.getValue('colorMode');
    }

    public isColorModeColor() {
        const colorModes = [
            HassLightColorMode.hs,
            HassLightColorMode.xy,
            HassLightColorMode.rgb,
            HassLightColorMode.rgbw,
            HassLightColorMode.rgbww
        ];

        return colorModes.includes(this.colorMode);
    }

    public isColorModeTemp(): boolean {
        return this.colorMode == HassLightColorMode.color_temp;
    }

    //#endregion

    //#region Color Temp

    private colorTempGetFactory(): TimeCacheValue {
        // when is off or not in temp mode, return default
        if (this.isOff() || !this.isColorModeTemp())
            return new TimeCacheValue(null, true);

        const attr = this._entity.attributes;
        if (attr?.color_temp_kelvin) {
            this._lastColorTemp = attr?.color_temp_kelvin;
        }
        return new TimeCacheValue(this._lastColorTemp, !this._lastColorTemp);
    }
    public get colorTemp(): number | null {
        return <number | null>this._cache.getValue('colorTemp');
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

    private colorGetFactory() {
        // when is off or not in color mode, return default
        if (this.isOff() || !this.isColorModeColor())
            return new TimeCacheValue(null, true);

        const attr = this._entity?.attributes;
        let result: Color | null = null;
        if (attr.hs_color) {
            const [h, s] = attr.hs_color;
            result = new Color(h, s / 100, 1, 1, 'hsv');
        }
        else if (attr.rgb_color) {
            const [r, g, b] = attr.rgb_color;
            result = new Color(r, g, b);
        }

        return new TimeCacheValue(result, !result);
    }
    public get color(): Color | null {
        return <Color | null>this._cache.getValue('color');
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

