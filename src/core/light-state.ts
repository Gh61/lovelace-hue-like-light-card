import { HassLightColorMode, HassLightEntity } from '../types/types-hass';
import { Color } from './colors/color';

/**
 * Class containing current state of some light entity.
 */
export class LightState {
    /**
     * Last state of the entity.
     * We are using this object as a storage of current state.
     */
    private _entity: HassLightEntity;
    private _lastOnBrightnessValue: number;
    private _lastColorTemp: number | null;

    /**
     * Creates print of current state of some entity.
     */
    public constructor(entity: HassLightEntity) {
        this.refresh(entity);
    }

    /**
     * Will load current entity state values into this object.
     */
    public refresh(entity: HassLightEntity) {
        this._entity = entity;
    }

    //#region Helper methods

    public isOn(): boolean {
        return this.state == 'on';
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

    /** Current state of the light entity. */
    public get state(): string {
        return this._entity.state;
    }
    public set state(newState: 'on' | 'off' | 'unavailable') {
        this._entity.state = newState;
    }

    /** Last brightness value, when the light was ON. */
    public get lastOnBrightnessValue(): number {
        return this._lastOnBrightnessValue;
    }

    /** Current state of the entity brightness. [0-100] */
    public get brightnessValue(): number {
        if (!this.isOn())
            return 0;

        const attr = this._entity.attributes;
        const brightness = attr?.brightness ?? 255;
        if (brightness == 0)
            return 0;

        this._lastOnBrightnessValue = Math.round((brightness / 255.0) * 100); // brightness is 0-255
        return this._lastOnBrightnessValue;
    }
    public set brightnessValue(newBrightnessValue: number) {
        // just to be sure
        if (newBrightnessValue < 0) {
            newBrightnessValue = 0;
        }
        else if (newBrightnessValue > 100) {
            newBrightnessValue = 100;
        }

        const newBrightness = Math.round((newBrightnessValue / 100.0) * 255); // value is 0-100
        const attr = this._entity.attributes ?? {};
        attr.brightness = newBrightness;
    }

    /** Current color mode. */
    public get colorMode(): HassLightColorMode {
        let result = HassLightColorMode.unknown;
        if (this.isOn()) {
            const entityMode = this._entity.attributes?.color_mode;
            if (entityMode) {
                result = entityMode;

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

        return result;
    }
    public set colorMode(newColorMode: HassLightColorMode) {
        if (newColorMode == HassLightColorMode.unknown)
            return;

        const attr = this._entity.attributes ?? {};
        attr.color_mode = newColorMode;
    }

    /** Current color temperature in kelvins. [~2000-~6500] */
    public get colorTemp(): number | null {
        // when is not on or not in temp mode, return default
        if (!this.isOn() || !this.isColorModeTemp())
            return null;

        const attr = this._entity.attributes;
        if (attr?.color_temp_kelvin) {
            this._lastColorTemp = attr?.color_temp_kelvin;
        }

        return this._lastColorTemp;
    }
    public set colorTemp(newColorTemp: number | null) {
        const attr = this._entity.attributes ?? {};
        attr.color_temp_kelvin = newColorTemp ?? undefined;
        this._lastColorTemp = newColorTemp;
    }

    /** Current light color. */
    public get color(): Color | null {
        // when is not on or not in color mode, return default
        if (!this.isOn() || !this.isColorModeColor())
            return null;

        const attr = this._entity.attributes;
        let result: Color | null = null;
        if (attr.hs_color) {
            const [h, s] = attr.hs_color;
            result = new Color(h, s / 100, 1, 1, 'hsv');
        }
        else if (attr.rgb_color) {
            const [r, g, b] = attr.rgb_color;
            result = new Color(r, g, b);
        }

        return result;
    }
    public set color(newColor: Color | null) {
        const attr = this._entity.attributes ?? {};
        if (newColor == null) {
            attr.hs_color = undefined;
            attr.rgb_color = undefined;
        }
        else if (newColor.getOriginalMode() == 'hsv') {
            attr.hs_color = [newColor.getHue(), newColor.getSaturation() * 100];
        }
        else if (newColor.getOriginalMode() == 'rgb') {
            attr.rgb_color = [newColor.getRed(), newColor.getGreen(), newColor.getBlue()];
        }
        else {
            throw new Error('Unknown color original mode');
        }
    }
}