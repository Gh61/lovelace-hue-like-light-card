import { HassLightAttributes, HassLightEntity } from "../src/types/types-hass";

export function createLightEntity(state: 'on'|'off', attributes:Record<string, unknown>){
    return <HassLightEntity>{
        entity_id: 'light.test',
        state: state,
        attributes: <HassLightAttributes>attributes,
    }
}