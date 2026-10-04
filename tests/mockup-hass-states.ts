import { HomeAssistant } from 'custom-card-helpers';
import { HassEntities, HassEntity, HassEntityAttributeBase, MessageBase } from 'home-assistant-js-websocket';
import { HassLightAttributes, HassLightColorMode, HassLightEntity } from '../src/types/types-hass';

export const hassMockup = {
    states: {
        'sensor.my_status': {
            state: 'OFF'
        } as HassEntity,
        'sensor.other_sens': {
            state: 'On',
            attributes: {
                friendly_name: 'My other sensor',
                'last_state': 'Off',
                'version': 1.023,
                'empty': null
            } as HassEntityAttributeBase
        } as HassEntity,
        'light.test': {
            state: 'on',
            attributes: {
                friendly_name: 'Test Light',
                min_color_temp_kelvin: 2020,
                max_color_temp_kelvin: 6451,
                min_mireds: 155,
                max_mireds: 495,
                supported_color_modes: [HassLightColorMode.color_temp, HassLightColorMode.xy],
                color_mode: HassLightColorMode.xy,
                brightness: 138,
                hs_color: [105.397, 74.118],
                rgb_color: [112, 255, 66],
                xy_color: [0.243, 0.6452],
                mode: 'normal',
                dynamics: 'none',
                icon: 'mdi:television-ambient-light',
                supported_features: 40
            } as HassLightAttributes
        } as HassLightEntity
    } as HassEntities,
    connection: {
        sendMessagePromise: (_: MessageBase) => {
            return Promise.resolve(null);
        }
    },
    language: 'cs'
} as HomeAssistant;