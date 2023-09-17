import { HomeAssistant } from 'custom-card-helpers';
import { HassSearchDeviceResult } from '../types/types-hass';

/**
 * Functions to call Hass WebSocket services to get data.
 */
export class HassWsClient {
    private readonly _hass;

    /**
     *
     */
    public constructor(hass: HomeAssistant) {
        if (!hass)
            throw new Error('Hass instance must be passed!');

        this._hass = hass;
    }

    /**
     * Will get area in which the entity is located.
     * @param entityId - Id of entity
     * @returns Area name or null, if no area is specified.
     */
    public async getArea(entityId: string): Promise<string | null> {
        const entityResult = await this._hass.connection.sendMessagePromise<HassSearchDeviceResult>({
            type: 'search/related',
            item_type: 'entity',
            item_id: entityId
        });
        if (entityResult && entityResult.area && entityResult.area.length) {
            return entityResult.area[0];
        }
        return null;
    }

    /**
     * Will get all scenes in given area.
     * @param area - Area name.
     * @returns Ids of all scenes in given area or empty array.
     */
    public async getScenes(area: string): Promise<string[]> {
        const areaResult = await this._hass.connection.sendMessagePromise<HassSearchDeviceResult>({
            type: 'search/related',
            item_type: 'area',
            item_id: area
        });

        if (areaResult && areaResult.scene && areaResult.scene.length) {
            return areaResult.scene;
        }

        return [];
    }
}