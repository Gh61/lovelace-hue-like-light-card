import { HomeAssistant } from 'custom-card-helpers';
import { HassLabelInfo, HassSearchDeviceResult, HomeAssistantEx } from '../types/types-hass';
import { removeDiacritics } from '../types/extensions';

export interface HassSearchLightsResult {
    groupName: string,
    lights: string[],
    dataResult: HassSearchDeviceResult,
    labelInfo?: HassLabelInfo
}

/**
 * Functions to call Hass WebSocket services to get data.
 * More info:
 * https://github.com/home-assistant/core/blob/dev/homeassistant/components/search/__init__.py
 * https://github.com/home-assistant/core/blob/dev/homeassistant/components/config/label_registry.py
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
     * Will get all light entities in given floor.
     * @param floor - Floor name
     * @returns Ids of all light entities in given area or null, when nothing is returned - indicating, the floor does not exist.
     */
    public async getLightEntitiesFromFloor(floor: string) : Promise<HassSearchLightsResult | null> {
        const floorId = this.slugify(floor);

        const floorResult = await this._hass.connection.sendMessagePromise<HassSearchDeviceResult>({
            type: 'search/related',
            item_type: 'floor',
            item_id: floorId
        });

        if (!floorResult || Object.keys(floorResult).length === 0) {
            return null;
        }

        const floorName = (<HomeAssistantEx>this._hass).floors[floorId]?.name || floor;

        if (floorResult.entity && floorResult.entity.length) {
            return {
                groupName: floorName,
                lights: floorResult.entity.filter((e) => e.startsWith('light.')),
                dataResult: floorResult
            };
        }

        return {
            groupName: floorName,
            lights: [],
            dataResult: floorResult
        };
    }

    /**
     * Will get all light entities in given area.
     * @param area - Area name.
     * @returns Ids of all light entities in given area or null, when nothing is returned - indicating, the area does not exist.
     */
    public async getLightEntitiesFromArea(area: string) : Promise<HassSearchLightsResult | null> {
        const areaId = this.slugify(area);

        const areaResult = await this._hass.connection.sendMessagePromise<HassSearchDeviceResult>({
            type: 'search/related',
            item_type: 'area',
            item_id: areaId
        });

        if (!areaResult || Object.keys(areaResult).length === 0) {
            return null;
        }

        const areaName = (<HomeAssistantEx>this._hass).areas[areaId]?.name || area;

        if (areaResult.entity && areaResult.entity.length) {
            return {
                groupName: areaName,
                lights: areaResult.entity.filter((e) => e.startsWith('light.')),
                dataResult: areaResult
            };
        }

        return {
            groupName: areaName,
            lights: [],
            dataResult: areaResult
        };
    }

    /**
     * Will get all light entities with given label.
     * @param label - Label name.
     * @returns Ids of all light entities with given label or null, when nothing is returned - indicating, the label does not exist.
     */
    public async getLightEntitiesFromLabel(label: string) : Promise<HassSearchLightsResult | null> {
        const labelId = this.slugify(label);

        // load label registry
        const labelList = await this._hass.connection.sendMessagePromise<HassLabelInfo[]>({
            type: 'config/label_registry/list'
        });
        const labelInfo = labelList.find(li => li.label_id == labelId);
        if (!labelInfo) {
            // label not found
            return null;
        }

        const labelResult = await this._hass.connection.sendMessagePromise<HassSearchDeviceResult>({
            type: 'search/related',
            item_type: 'label',
            item_id: labelId
        });

        if (!labelResult || Object.keys(labelResult).length === 0) {
            return null;
        }

        const labelName = labelInfo.name || label;

        if (labelResult.entity && labelResult.entity.length) {
            return {
                groupName: labelName,
                lights: labelResult.entity.filter((e) => e.startsWith('light.')),
                dataResult: labelResult,
                labelInfo: labelInfo
            };
        }

        return {
            groupName: labelName,
            lights: [],
            dataResult: labelResult,
            labelInfo: labelInfo
        };
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

        return this.getScenesFromResult(areaResult);
    }

    /**
     * Will get all scenes in given area from @param areaResult.
     * @returns Ids of all scenes in given area or empty array.
     */
    public getScenesFromResult(areaResult: HassSearchDeviceResult) {
        if (areaResult && areaResult.scene && areaResult.scene.length) {
            return areaResult.scene;
        }

        return [];
    }

    private slugify(name: string) : string {
        // slugs are lowercase, underscore instead of spaces and removed diacritics
        const slug = removeDiacritics(name).toLowerCase().replaceAll(/[ _-]+/g, '_');
        return slug;
    }
}