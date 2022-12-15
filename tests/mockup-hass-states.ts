import { HomeAssistant } from "custom-card-helpers";
import { HassEntities, HassEntity, HassEntityAttributeBase } from "home-assistant-js-websocket";

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
        }
    }
};