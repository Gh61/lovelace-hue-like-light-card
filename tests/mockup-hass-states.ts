import { HomeAssistant } from 'custom-card-helpers';
import { HassEntities, HassEntity, HassEntityAttributeBase, MessageBase } from 'home-assistant-js-websocket';
import { HassLightAttributes, HassLightColorMode, HassLightEntity } from '../src/types/types-hass';

export const hassMockup = <HomeAssistant>{
    states: <HassEntities>{
        'sensor.my_status': <HassEntity>{
            state: 'OFF'
        },
        'sensor.other_sens': <HassEntity>{
            state: 'On',
            attributes: <HassEntityAttributeBase>{
                friendly_name: 'My other sensor',
                'last_state': 'Off',
                'version': 1.023,
                'empty': null
            }
        },
        'light.test': <HassLightEntity>{
            state: 'on',
            attributes: <HassLightAttributes>{
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
            }
        }
    },
    connection: {
        sendMessagePromise: (_: MessageBase) => {
            return Promise.resolve(null);
        }
    }
};