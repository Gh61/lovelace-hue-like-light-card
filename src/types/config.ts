import { IHassTextTemplate, ILightContainer } from './types-interface';
import { Consts } from './consts';
import { Color } from '../core/colors/color';
import { ColorResolver } from '../core/colors/color-resolvers';
import { HomeAssistant } from 'custom-card-helpers';
import { removeDuplicates } from './extensions';
import { ColorExtended } from '../core/colors/color-extended';
import { HassTextTemplate } from '../core/hass-text-template';
import { ClickAction, ClickActionData, HueLikeLightCardEntityConfigInterface, HueLikeLightCardConfigInterface, KnownIconSize, SceneConfig, SceneOrder, SliderType } from './types-config';
import { HassSearchLightsResult, HassWsClient } from '../core/hass-ws-client';

declare type EntityRelations = {
    entityId: string;
    area: string | null;
    areaScenes: string[];
};

export class HueLikeLightCardEntityConfig implements HueLikeLightCardEntityConfigInterface {
    protected _title?: string;
    protected _icon?: string;

    public constructor(plainConfigOrEntityId: HueLikeLightCardEntityConfigInterface | string) {
        if (typeof plainConfigOrEntityId == "string"){
            this.entity = plainConfigOrEntityId
        }
        else {
            this.entity = plainConfigOrEntityId.entity!;
            this._title = plainConfigOrEntityId.title;
            this._icon = plainConfigOrEntityId.icon;
        }
    }

    public readonly entity: string;
    public get title() {
        return this._title;
    }
    public get icon() {
        return this._icon;
    };

    /**
     * @returns Title from config or from passed container.
     */
    public getTitle(lightContainer: ILightContainer): IHassTextTemplate {
        return !!this.title
            ? new HassTextTemplate(this.title)
            : lightContainer.getTitle();
    }
}

export class HueLikeLightCardEntityConfigCollection {
    private readonly _entityMap: Record<string, HueLikeLightCardEntityConfig>;
    private readonly _entityList: string[]; // to keep the order of entities

    public constructor (entityConfigs: HueLikeLightCardEntityConfig[]) {
        this._entityMap = {};
        this._entityList = [];

        entityConfigs.forEach(c => {
            // inserting only the first occurence into the map
            if (!this._entityMap[c.entity]) {
                this._entityMap[c.entity] = c;
                this._entityList.push(c.entity);
            }
        });
    }

    public getConfig(entityId: string): HueLikeLightCardEntityConfig {
        return this._entityMap[entityId];
    }

    public getIdList(): string[] {
        return this._entityList.map(e => e); // map is creating new array
    }

    public get length() {
        return this._entityList.length;
    }
}

export class HueLikeLightCardConfig extends HueLikeLightCardEntityConfig implements HueLikeLightCardConfigInterface {
    private _scenes: SceneConfig[] | null;

    public readonly entities?: string[] | HueLikeLightCardEntityConfigInterface[];
    public readonly floor?: string;
    public readonly area?: string;
    public readonly label?: string;
    public readonly groupEntity?: string;
    public readonly description?: string;
    public readonly iconSize: number;
    public readonly showSwitch: boolean;
    public readonly switchOnScene?: string;
    public readonly slider: SliderType;
    public get scenes() {
        return this._scenes || [];
    }
    public readonly sceneOrder: SceneOrder;
    public readonly offClickAction: ClickAction;
    public readonly offClickData: ClickActionData;
    public readonly onClickAction: ClickAction;
    public readonly onClickData: ClickActionData;
    public readonly offHoldAction: ClickAction;
    public readonly offHoldData: ClickActionData;
    public readonly onHoldAction: ClickAction;
    public readonly onHoldData: ClickActionData;
    public readonly allowZero: boolean;
    public readonly theme: string;
    public readonly defaultColor: string;
    public readonly offColor: string;
    public readonly hueScreenBgColor: string;
    public readonly offShadow: boolean;
    public readonly hueBorders: boolean;
    public readonly apiId?: string;
    public readonly isVisible: boolean;

    /** Support for card-mod styling */
    public readonly style?: unknown;
    public readonly card_mod?: unknown;

    /**
     * Returns whether offColor was set in configuration.
     * Returns false, when offColor is taken from Consts.
     */
    public readonly wasOffColorSet: boolean;

    // NEW: optional number of columns for per-entity grid
    public readonly numColumns?: number;

    /**
     * @returns List of unique entity identifiers
     */
    public getEntities(): HueLikeLightCardEntityConfigCollection {
        // create list of entities (prepend entity and then insert all entities)
        const result: HueLikeLightCardEntityConfig[] = [];

        this.entity && result.push(new HueLikeLightCardEntityConfig(this.entity));
        this.entities && this.entities.forEach(e => {
            result.push(new HueLikeLightCardEntityConfig(e));
        });

        this._floorEntities && this._floorEntities.forEach(e => {
            result.push(new HueLikeLightCardEntityConfig(e));
        });
        this._areaEntities && this._areaEntities.forEach(e => {
            result.push(new HueLikeLightCardEntityConfig(e));
        });
        this._labelEntities && this._labelEntities.forEach(e => {
            result.push(new HueLikeLightCardEntityConfig(e));
        });

        return new HueLikeLightCardEntityConfigCollection(result);
    }

    /**
     * @returns Default color as instance of Color.
     */
    public getDefaultColor(): Color {
        return ColorResolver.getColor(this.defaultColor);
    }

    /**
     * @returns Off color as instance of Color.
     */
    public getOffColor(): ColorExtended {
        return new ColorExtended(this.offColor);
    }

    /**
     * @returns Background color for hue-screen dialog. 
     */
    public getHueScreenBgColor(): ColorExtended {
        return new ColorExtended(this.hueScreenBgColor);
    }

    private _isInitialized = false;

    /**
     * @returns If this config needs call to @method init, in order to be properly working.
     */
    public get isInitialized() {
        return this._isInitialized;
    }

    /**
     * Will try to load everything needed for this configuration, to be fully loaded.
     * Might throw some errors.
     */
    public async init(hass: HomeAssistant) {
        if (!hass)
            throw new Error('Hass instance must be passed!');

        // no need to do it again
        if (this._isInitialized)
            return;

        // init is running
        this._isInitialized = true;

        // load entities from floor if needed
        await this.tryLoadFloorInfo(hass);

        // load entities from area if needed
        await this.tryLoadAreaInfo(hass);

        // load entities from label if needed
        await this.tryLoadLabelInfo(hass);

        // load scenes if needed
        // fire&forget, no need to wait for these
        this.tryLoadScenes(hass);
    }

    // #region Floor

    private _floorEntities?: string[];
    private _floorEntitiesLoaded = false;
    /**
     * Will try to load area light entities from HA WS.
     * Will also set title and scenes, if possible.
     */
    private async tryLoadFloorInfo(hass: HomeAssistant) {
        if (this._floorEntitiesLoaded || !this.floor || this._floorEntities != null)
            return;

        this._floorEntitiesLoaded = true;

        const client = new HassWsClient(hass);
        let floorLightsInfo: HassSearchLightsResult | null;

        try {
            floorLightsInfo = await client.getLightEntitiesFromFloor(this.floor);
        }
        catch (error) {
            console.error('Cannot load light/switch entities from HA.');
            console.error(error);

            // rethrow exception for UI
            throw new Error(`Cannot load entities from floor '${this.floor}'. See console for more info.`);
        }

        if (floorLightsInfo == null) {
            throw new Error(`Floor '${this.floor}' does not exist.`);
        }

        // check for at least one light or switch entity
        if (floorLightsInfo.lights.length == 0 && floorLightsInfo.switches.length == 0) {
            throw new Error(`Floor '${this.floor}' has no light or switch entities.`);
        }

        this._floorEntities = [...floorLightsInfo.lights, ...floorLightsInfo.switches];
        // if no title is given, use floor name
        if (this._title == null) {
            this._title = floorLightsInfo.groupName;
        }
        // if no other entities are set, use scenes from area
        if (this._scenes == null && this.getEntities().length == this._floorEntities.length) {
            const loadedScenes = client.getScenesFromResult(floorLightsInfo.dataResult);
            this.setLoadedScenes(loadedScenes);
        }
    }

    // #endregion

    // #region Area

    private _areaEntities?: string[];
    private _areaEntitiesLoaded = false;
    /**
     * Will try to load area light entities from HA WS.
     * Will also set title and scenes, if possible.
     */
    private async tryLoadAreaInfo(hass: HomeAssistant) {
        if (this._areaEntitiesLoaded || !this.area || this._areaEntities != null)
            return;

        this._areaEntitiesLoaded = true;

        const client = new HassWsClient(hass);
        let areaLightsInfo: HassSearchLightsResult | null;

        try {
            areaLightsInfo = await client.getLightEntitiesFromArea(this.area);
        }
        catch (error) {
            console.error('Cannot load light/switch entities from HA.');
            console.error(error);

            // rethrow exception for UI
            throw new Error(`Cannot load entities from area '${this.area}'. See console for more info.`);
        }

        if (areaLightsInfo == null) {
            throw new Error(`Area '${this.area}' does not exist.`);
        }

        // check for at least one light or switch entity
        if (areaLightsInfo.lights.length == 0 && areaLightsInfo.switches.length == 0) {
            throw new Error(`Area '${this.area}' has no light or switch entities.`);
        }

        this._areaEntities = [...areaLightsInfo.lights, ...areaLightsInfo.switches];
        // if no title is given, use area name
        if (this._title == null) {
            this._title = areaLightsInfo.groupName;
        }
        // if no other entities are set, use scenes from area
        if (this._scenes == null && this.getEntities().length == this._areaEntities.length) {
            const loadedScenes = client.getScenesFromResult(areaLightsInfo.dataResult);
            this.setLoadedScenes(loadedScenes);
        }
    }

    // #endregion

    // #region Label

    private _labelEntities?: string[];
    private _labelEntitiesLoaded = false;
    /**
     * Will try to load label light entities from HA WS.
     * Will also set title and scenes, if possible.
     */
    private async tryLoadLabelInfo(hass: HomeAssistant) {
        if (this._labelEntitiesLoaded || !this.label || this._labelEntities != null)
            return;

        this._labelEntitiesLoaded = true;

        const client = new HassWsClient(hass);
        let labelLightsInfo: HassSearchLightsResult | null;

        try {
            labelLightsInfo = await client.getLightEntitiesFromLabel(this.label);
        }
        catch (error) {
            console.error('Cannot load light/switch entities from HA.');
            console.error(error);

            // rethrow exception for UI
            throw new Error(`Cannot load entities from label '${this.label}'. See console for more info.`);
        }

        if (labelLightsInfo == null) {
            throw new Error(`Label '${this.label}' does not exist.`);
        }

        // check for at least one light or switch entity
        if (labelLightsInfo.lights.length == 0 && labelLightsInfo.switches.length == 0) {
            throw new Error(`Label '${this.label}' has no light or switch entities.`);
        }

        this._labelEntities = [...labelLightsInfo.lights, ...labelLightsInfo.switches];
        // if no title is given, use label name
        if (this._title == null) {
            this._title = labelLightsInfo.groupName;
        }
        // if no icon is given, use label icon
        if (this._icon == null && labelLightsInfo.labelInfo?.icon) {
            this._icon = labelLightsInfo.labelInfo.icon;
        }
    }

    // #endregion

    private _scenesLoaded = false;
    /**
     * Will try to load scenes from HA WS, if no scenes are configured.
     */
    private async tryLoadScenes(hass: HomeAssistant) {
        if (this._scenesLoaded || this._scenes != null)
            return;

        this._scenesLoaded = true;

        const client = new HassWsClient(hass);

        try {

            /**
             * Potential optimization:
             * - load first areaInfo and check, if any other lights are in there (no need to call getArea so many times)
             * - areaResult can be passed to this method if some entities were loaded from area (this can be used with the point above)
             */

            // get entities, and create ordered list based on order of entities in config
            const entities = this.getEntities().getIdList();
            const lightRelations = entities.map(entityId => {
                return { entityId };
            }) as EntityRelations[];

            // load all areas
            await Promise.all(lightRelations.map(async relation => {
                relation.area = await client.getArea(relation.entityId);
            }));

            // load scenes for areas
            await Promise.all(lightRelations.map(async relation => {
                if (relation.area) {
                    relation.areaScenes = await client.getScenes(relation.area);
                }
            }));

            // get all scenes - order depends on entity order in config
            let loadedScenes = lightRelations.filter(r => !!r.areaScenes).flatMap(r => r.areaScenes);
            loadedScenes = removeDuplicates(loadedScenes);

            this.setLoadedScenes(loadedScenes);
        }
        catch (error) {
            console.error('Cannot load scenes from HA.');
            console.error(error);
        }
    }

    /**
     * Will set loaded scenes to this config (using configured ordering)
     */
    private setLoadedScenes(loadedScenes: string[]) {
        switch (this.sceneOrder) {
            case SceneOrder.NameAsc:
                loadedScenes.sort((s1, s2) => s1.localeCompare(s2));
                break;

            case SceneOrder.NameDesc:
                loadedScenes.sort((s1, s2) => s2.localeCompare(s1));
                break;
        }

        // set to config
        this._scenes = HueLikeLightCardConfig.getScenesArray(loadedScenes);
    }
}
