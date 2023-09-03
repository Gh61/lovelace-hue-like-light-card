import { LightFeatures } from "../src/core/light-features";
import { createLightEntity } from "./test.helper";

describe('Light features', () => {
    it('should recognize onoff', () => {
        const entityAttributes = {
            supported_color_modes: [
                'onoff'
            ],
            color_mode: 'onoff',
            icon: 'pap:light_dimming_button',
            friendly_name: 'Whatever Display Backlight',
            supported_features: 0
        }

        var features = new LightFeatures(createLightEntity("on", entityAttributes));

        expect(features.brightness).toBe(false);
        expect(features.colorTemp).toBe(false);
        expect(features.color).toBe(false);
        expect(features.isEmpty()).toBe(true);
        expect(features.isOnlyBrightness()).toBe(false);
    });

    it('should recognize only brightness', () => {
        const entityAttributes = {
            supported_color_modes: [
                'brightness'
            ],
            color_mode: 'brightness',
            brightness: 255,
            icon: 'mdi:circle-outline',
            friendly_name: 'Whatever Light Brightness',
            supported_features: 0
        }

        var features = new LightFeatures(createLightEntity("on", entityAttributes));

        expect(features.brightness).toBe(true);
        expect(features.colorTemp).toBe(false);
        expect(features.color).toBe(false);
        expect(features.isEmpty()).toBe(false);
        expect(features.isOnlyBrightness()).toBe(true);
    });

    it('should recognize colorTemp and brightness', () => {
        const entityAttributes = {
            min_color_temp_kelvin: 2202,
            max_color_temp_kelvin: 6535,
            min_mireds: 153,
            max_mireds: 454,
            supported_color_modes: [
                'color_temp'
            ],
            is_hue_group: true,
            hue_scenes: ['Focus', 'LightsOn'],
            hue_type: 'room',
            lights: [
                'Study'
            ],
            dynamics: false,
            icon: 'mdi:dome-light',
            friendly_name: 'Study',
            supported_features: 40
        }

        var features = new LightFeatures(createLightEntity("off", entityAttributes));

        expect(features.brightness).toBe(true);
        expect(features.colorTemp).toBe(true);
        expect(features.color).toBe(false);
        expect(features.isEmpty()).toBe(false);
        expect(features.isOnlyBrightness()).toBe(false);
    });

    it('should recognize colorTemp and brightness 2', () => {
        const entityAttributes = {
            min_color_temp_kelvin: 2202,
            max_color_temp_kelvin: 6535,
            min_mireds: 153,
            max_mireds: 454,
            supported_color_modes: [
                // incorrectly implemented mode:
                'onoff',
                // incorrectly implemented mode:
                'brightness',
                'color_temp',
            ],
            is_hue_group: true,
            hue_scenes: ['Focus', 'LightsOn'],
            hue_type: 'room',
            lights: [
                'Study'
            ],
            dynamics: false,
            icon: 'mdi:dome-light',
            friendly_name: 'Study',
            supported_features: 40,
            color_mode: 'color_temp',
            brightness: 255,
            color_temp_kelvin: 4000,
            color_temp: 250,
            hs_color: [26.812, 34.87],
            rgb_color: [255, 205, 166],
            xy_color: [0.421, 0.364]
        }

        var features = new LightFeatures(createLightEntity("on", entityAttributes));

        expect(features.brightness).toBe(true);
        expect(features.colorTemp).toBe(true);
        expect(features.color).toBe(false);
        expect(features.isEmpty()).toBe(false);
        expect(features.isOnlyBrightness()).toBe(false);
    });

    it('should recognize color, colorTemp and brightness', () => {
        const entityAttributes = {
            min_color_temp_kelvin: 2000,
            max_color_temp_kelvin: 6535,
            min_mireds: 153,
            max_mireds: 500,
            effect_list: [
                'None',
                'candle',
                'fire',
                'unknown'
            ],
            supported_color_modes: [
                'color_temp',
                'xy'
            ],
            mode: 'normal',
            dynamics: 'none',
            icon: 'mdi:dome-light',
            friendly_name: 'Lounge 1',
            supported_features: 44
        }

        var features = new LightFeatures(createLightEntity("off", entityAttributes));

        expect(features.brightness).toBe(true);
        expect(features.colorTemp).toBe(true);
        expect(features.color).toBe(true);
        expect(features.isEmpty()).toBe(false);
        expect(features.isOnlyBrightness()).toBe(false);
    });

    it('should recognize color, colorTemp and brightness 2', () => {
        const entityAttributes = {
            min_color_temp_kelvin: 2000,
            max_color_temp_kelvin: 6535,
            min_mireds: 153,
            max_mireds: 500,
            supported_color_modes: [
                // non-standard implementation (https://developers.home-assistant.io/docs/core/entity/light/)
                // if 'brightness' is present, it should be the only mode, we'll support it nevertheless 
                'brightness', 
                'color_temp',
                'hs'
            ],
            color_mode: 'hs',
            brightness: 78,
            hs_color: [299, 100],
            rgb_color: [0, 46, 255],
            xy_color: [0.136, 0.054],
            friendly_name: 'PH AWN 1',
            supported_features: 0
        }

        var features = new LightFeatures(createLightEntity("on", entityAttributes));

        expect(features.brightness).toBe(true);
        expect(features.colorTemp).toBe(true);
        expect(features.color).toBe(true);
        expect(features.isEmpty()).toBe(false);
        expect(features.isOnlyBrightness()).toBe(false);
    });
});