import { Func } from '../types/functions';
import { ILightFeatures } from '../types/types-interface';
import { HassLightColorMode, HassLightEntity } from '../types/types-hass';

export class LightFeatures implements ILightFeatures {
    public constructor(lightEntity: HassLightEntity) {

        // no modes
        if (lightEntity.attributes == null ||
            lightEntity.attributes.supported_color_modes == null ||
            lightEntity.attributes.supported_color_modes.length == 0) {
            return;
        }

        for (const mode of lightEntity.attributes.supported_color_modes) {

            switch (mode) {
                // only turning on and off is supported
                case HassLightColorMode.onoff:
                    //return; // should be the only mode (but could be incorrectly implemented)
                    break;

                // only brightness is supported
                case HassLightColorMode.brightness:
                    this.brightness = true;
                    //return; // should be the only mode (but could be incorrectly implemented)
                    break;

                case HassLightColorMode.color_temp:
                    this.brightness = true;
                    this.colorTemp = true;
                    break;

                case HassLightColorMode.hs:
                case HassLightColorMode.xy:
                case HassLightColorMode.rgb:
                case HassLightColorMode.rgbw:
                case HassLightColorMode.rgbww:
                    this.brightness = true;
                    this.color = true;
                    break;
            }
        }

        if (this.colorTemp) {
            this.colorTempMinKelvin = lightEntity.attributes.min_color_temp_kelvin || null;
            this.colorTempMaxKelvin = lightEntity.attributes.max_color_temp_kelvin || null;
        }
    }

    public isEmpty(): boolean {
        return !this.color && !this.colorTemp && !this.brightness;
    }

    public isOnlyBrightness(): boolean {
        return !this.color && !this.colorTemp && this.brightness;
    }

    public readonly brightness: boolean = false;
    public readonly colorTemp: boolean = false;
    public readonly colorTempMinKelvin: number | null = null;
    public readonly colorTempMaxKelvin: number | null = null;
    public readonly color: boolean = false;
}

export class LightFeaturesCombined implements ILightFeatures {
    private _features: Func<ILightFeatures[]>;

    /**
     * Will create object, that implements ILightFeatures that is combined from multiple ILightFeatures.
     * @param features Callback, that returns array of features, so it always has current live data.
     */
    public constructor(features: Func<ILightFeatures[]>) {
        this._features = features;
    }

    public isEmpty(): boolean {
        return this._features().every(f => f.isEmpty());
    }

    public isOnlyBrightness(): boolean {
        let isBrightness = false;
        const features = this._features();
        for (let i = 0; i < features.length; i++) {
            const f = features[i];
            if (f.isOnlyBrightness()) {
                isBrightness = true;
            } else if (!f.isEmpty()) {
                // not brightness and not empty
                return false;
            }
        }

        // return if at least one feature has only brightness (and the rest can be empty)
        return isBrightness;
    }

    public get brightness(): boolean {
        return this._features().some(f => f.brightness);
    }

    public get colorTemp(): boolean {
        return this._features().some(f => f.colorTemp);
    }

    public get colorTempMinKelvin() {
        let min: number | null = null;

        // return the smallest value, if any specified
        this._features().forEach(f => {
            if (f.colorTempMinKelvin && (min == null || min > f.colorTempMinKelvin)) {
                min = f.colorTempMinKelvin;
            }
        });

        return min;
    }

    public get colorTempMaxKelvin() {
        let max: number | null = null;

        // return the biggest value, if any specified
        this._features().forEach(f => {
            if (f.colorTempMaxKelvin && (max == null || max < f.colorTempMaxKelvin)) {
                max = f.colorTempMaxKelvin;
            }
        });

        return max;
    }

    public get color(): boolean {
        return this._features().some(f => f.color);
    }
}