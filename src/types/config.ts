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
import { LightingData, PresetConfig } from './types-hue-preset';

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
    private _presets: PresetConfig[] = [];

    public constructor(plainConfig: HueLikeLightCardConfigInterface) {
        super(plainConfig);

        // check if we potentialy have at least one entity
        if (!plainConfig.entity && (!plainConfig.entities || !plainConfig.entities.length) && !plainConfig.floor && !plainConfig.area && !plainConfig.label) {
            throw new Error('At least one of "entity", "entities", "floor", "area" or "label" needs to be set.');
        }

        this.entities = plainConfig.entities;
        this.floor = plainConfig.floor;
        this.area = plainConfig.area;
        this.label = plainConfig.label;
        this.groupEntity = plainConfig.groupEntity;
        this.description = plainConfig.description;
        this.iconSize = HueLikeLightCardConfig.getIconSize(plainConfig.iconSize);
        this.showSwitch = HueLikeLightCardConfig.getBoolean(plainConfig.showSwitch, true);
        this.switchOnScene = plainConfig.switchOnScene;
        this.slider = HueLikeLightCardConfig.getSliderType(plainConfig.slider);
        this._scenes = HueLikeLightCardConfig.getScenesArray(plainConfig.scenes);
        this.sceneOrder = HueLikeLightCardConfig.getSceneOrder(plainConfig.sceneOrder);
        this.offClickAction = HueLikeLightCardConfig.getClickAction(plainConfig.offClickAction);
        this.offClickData = new ClickActionData(plainConfig.offClickData);
        this.onClickAction = HueLikeLightCardConfig.getClickAction(plainConfig.onClickAction);
        this.onClickData = new ClickActionData(plainConfig.onClickData);
        this.offHoldAction = HueLikeLightCardConfig.getClickAction(plainConfig.offHoldAction);
        this.offHoldData = new ClickActionData(plainConfig.offHoldData);
        this.onHoldAction = HueLikeLightCardConfig.getClickAction(plainConfig.onHoldAction);
        this.onHoldData = new ClickActionData(plainConfig.onHoldData);
        this.allowZero = HueLikeLightCardConfig.getBoolean(plainConfig.allowZero, false);
        this.theme = plainConfig.theme || Consts.ThemeDefault;
        this.defaultColor = plainConfig.defaultColor || Consts.DefaultColor;
        this.offColor = plainConfig.offColor || Consts.OffColor;
        this.wasOffColorSet = !!plainConfig.offColor;
        this.hueScreenBgColor = plainConfig.hueScreenBgColor || Consts.DialogBgColor;
        this.offShadow = HueLikeLightCardConfig.getBoolean(plainConfig.offShadow, true);
        this.hueBorders = HueLikeLightCardConfig.getBoolean(plainConfig.hueBorders, true);
        this.apiId = plainConfig.apiId;
        this.isVisible = HueLikeLightCardConfig.getBoolean(plainConfig.isVisible, true);
        this.enable_preset = HueLikeLightCardConfig.getBoolean(plainConfig.enable_preset, false);

        this.style = plainConfig.style;
        this.card_mod = plainConfig.card_mod;

        // need some init?
        if (this._scenes == null || this.area || this.label) {
            this._isInitialized = false;
        }
        else {
            this._isInitialized = true;
        }
    }

    /**
     * @returns boolean from plain config.
     * @param plain Plain value from config
     * @param def Default value if plain value is not filled
     */
    private static getBoolean(plain: boolean | undefined, def: boolean): boolean {
        if (plain == null)
            return def;
        return !!plain;
    }

    /**
     * @returns SliderType valid enum, default for empty or throws exception.
     */
    private static getSliderType(plain: SliderType | string | undefined): SliderType {
        if (!plain)
            return SliderType.Default;

        return HueLikeLightCardConfig.tryParseEnum<SliderType>(SliderType, plain, 'Slider type');
    }

    /**
     * @returns ClickAction valid enum, default for empty or throws exception.
     */
    private static getClickAction(plain: ClickAction | string | undefined): ClickAction {
        if (!plain)
            return ClickAction.Default;

        return HueLikeLightCardConfig.tryParseEnum<ClickAction>(ClickAction, plain, 'Click action');
    }

    /**
     * @returns IconSize as number, default for empty or throws exception.
     */
    private static getIconSize(plain: string | number | undefined): number {
        if (!plain)
            return Consts.IconSize[KnownIconSize.Original];

        if (typeof plain == 'number') {
            return plain;
        }

        plain = plain.toString().toLowerCase();
        const iconSize = HueLikeLightCardConfig.tryParseEnum<KnownIconSize>(KnownIconSize, plain, 'Icon size');
        return Consts.IconSize[iconSize];
    }

    /**
     * @returns SceneOrder valid enum, default for empty or throws exception.
     */
    private static getSceneOrder(plain: string | undefined): SceneOrder {
        if (!plain)
            return SceneOrder.Default;

        return HueLikeLightCardConfig.tryParseEnum<SceneOrder>(SceneOrder, plain, 'Scene order');
    }

    private static tryParseEnum<T>(enumType: Record<string, T>, plain: string, name: string) {
        let helpValues = '';
        for (const value in enumType) {
            const enumValue = (enumType)[value];
            if (plain == enumValue)
                return plain as T;

            helpValues += `'${enumValue}', `;
        }

        throw new Error(`${name} '${plain}' was not recognized. Allowed values are: ${helpValues}`);
    }

    /**
     * @returns array of SceneConfig - parsed from passed plain config.
     * @param plain Plain value from config
     */
    private static getScenesArray(plain: (string | SceneConfig)[] | undefined): SceneConfig[] | null {
        if (!plain)
            return null;

        if (plain.length > 0) {
            const result = new Array<SceneConfig>();
            for (let i = 0; i < plain.length; i++) {
                const scene = plain[i];
                const pScene = HueLikeLightCardConfig.getScene(scene, i);
                if (pScene) {
                    result.push(pScene);
                }
            }
            return result;
        }

        return [];
    }

    /**
     * @returns SceneConfig - parse from passed plain config value.
     * @param plain Plain value of one scene from config
     * @param index Index of value in array (for error message purposes)
     */
    private static getScene(plain: string | SceneConfig, index: number): SceneConfig {
        if (typeof plain == 'string') {
            return new SceneConfig(plain);
        }

        if (!plain.entity) {
            throw new Error(`Scene on index ${index} is missing 'entity' attribute, which is required.`);
        }

        const result = new SceneConfig(plain.entity);
        result.title = plain.title;
        result.icon = plain.icon;
        result.color = plain.color;
        result.activation = plain.activation;
        result.activationData = plain.activationData;

        return result;
    }

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
    public readonly enable_preset: boolean;
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

        // load presets if needed and enabled
        // fire&forget, no need to wait for these
        if (this.enable_preset) {
            this.tryLoadPresets();
        }
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

    // #region Hue Presets

    /**
     * Get all presets
     */
    public get presets(): PresetConfig[] {
        return this._presets;
    }

    private _presetsLoaded = false;
    /**
     * Will try to load Hue Presets from hass-scene_presets addon JSON.
     */
    private async tryLoadPresets() {
        if (this._presetsLoaded)
            return;

        this._presetsLoaded = true;

        try {
            // Get base URL from Home Assistant
            const baseUrl = window.location.origin;
            const jsonUrl = `${baseUrl}/assets/scene_presets/scene_presets.json`;

            // Fetch the JSON data
            const response = await fetch(jsonUrl);
            if (!response.ok) {
                console.log('Hue Presets JSON not found. The hass-scene_presets addon may not be installed.');
                return;
            }

            const data: LightingData = await response.json();

            // Create a map of categories for quick lookup
            const categoryMap = new Map<string, string>();
            data.categories.forEach(cat => {
                categoryMap.set(cat.id, cat.name);
            });

            // Convert presets to PresetConfig
            this._presets = data.presets.map(preset => ({
                preset: preset,
                categoryName: categoryMap.get(preset.categoryId)
            }));

            console.log(`Loaded ${this._presets.length} Hue Presets from hass-scene_presets addon.`);
        }
        catch (error) {
            console.log('Could not load Hue Presets from hass-scene_presets addon.');
            console.error(error);
        }
    }

    /**
     * Get targets for preset activation based on card configuration
     */
    public getPresetTargets(): { entity_id?: string | string[], area_id?: string, floor_id?: string, label_id?: string } {
        const targets: { entity_id?: string | string[], area_id?: string, floor_id?: string, label_id?: string } = {};

        if (this.area) {
            targets.area_id = this.area;
        }
        else if (this.floor) {
            targets.floor_id = this.floor;
        }
        else if (this.label) {
            targets.label_id = this.label;
        }
        else {
            // Use entities
            const entities = this.getEntities().getIdList();
            if (entities.length === 1) {
                targets.entity_id = entities[0];
            }
            else if (entities.length > 1) {
                targets.entity_id = entities;
            }
        }

        return targets;
    }

    // #endregion
}
