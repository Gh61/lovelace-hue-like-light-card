import { Func } from '../types/functions';
import { ILightFeatures } from '../types/types';
import { HassLightColorMode, HassLightEntity } from '../types/types-hass';

export class LightFeatures implements ILightFeatures {
    public constructor(lightEntity: HassLightEntity) {

        // no modes
        if (lightEntity.attributes.supported_color_modes == null ||
            lightEntity.attributes.supported_color_modes.length == 0) {
            return;
        }

        for (const mode of lightEntity.attributes.supported_color_modes) {

            switch (mode) {
                // only turning on and off is supported
                case HassLightColorMode.onoff:
                    return; // must be the only mode

                // only brightness is supported
                case HassLightColorMode.brightness:
                    this.brightness = true;
                    return; // must be the only mode

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
    }

    public readonly brightness: boolean = false;
    public readonly colorTemp: boolean = false;
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

    public get brightness(): boolean {
        return this._features().some(f => f.brightness);
    }

    public get colorTemp(): boolean {
        return this._features().some(f => f.colorTemp);
    }

    public get color(): boolean {
        return this._features().some(f => f.color);
    }
}