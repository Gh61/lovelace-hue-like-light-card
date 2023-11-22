import { HomeAssistant } from 'custom-card-helpers';
import { HassSearchDeviceResult } from '../types/types-hass';
import { removeDiacritics } from '../types/extensions';

/**
 * Functions to call Hass WebSocket services to get data.
 * More info:
 * https://github.com/home-assistant/core/blob/dev/homeassistant/components/search/__init__.py
 */
export class HassWsClient {
    private readonly _hass;

    /**
     * Will create WebCocket client instance.
     */
    public constructor(hass: HomeAssistant) {
        if (!hass)
            throw new Error('Hass instance must be passed!');

        this._hass = hass;
    }

    /**
     * Will get all light entities in given area.
     * @param area - Area name.
     * @returns Ids of all light entities in given area or null, when nothing is returned - indicating, the area does not exist.
     */
    public async getLightEntities(area: string): Promise<string[] | null> {
        // area codes are lowercase, underscore instead of spaces and removed diacritics
        area = removeDiacritics(area).toLowerCase().replaceAll(' ', '_');

        const areaResult = await this._hass.connection.sendMessagePromise<HassSearchDeviceResult>({
            type: 'search/related',
            item_type: 'area',
            item_id: area
        });

        if (!areaResult || Object.keys(areaResult).length === 0) {
            return null;
        }

        if (areaResult.entity && areaResult.entity.length) {
            return areaResult.entity.filter((e) => e.startsWith('light.'));
        }

        return [];
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