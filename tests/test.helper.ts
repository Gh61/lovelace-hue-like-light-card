import { HassLightAttributes, HassLightEntity } from '../src/types/types-hass';

export function createLightEntity(state: 'on' | 'off', attributes:Record<string, unknown>) {
    return {
        entity_id: 'light.test',
        state: state,
        attributes: attributes as HassLightAttributes
    } as HassLightEntity;
}