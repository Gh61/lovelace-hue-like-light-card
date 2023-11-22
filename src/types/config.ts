import { IHassTextTemplate, ILightContainer } from './types-interface';
import { Consts } from './consts';
import { Color } from '../core/colors/color';
import { ColorResolver } from '../core/colors/color-resolvers';
import { HomeAssistant } from 'custom-card-helpers';
import { removeDuplicites } from './extensions';
import { ColorExtended } from '../core/colors/color-extended';
import { HassTextTemplate } from '../core/hass-text-template';
import { ClickAction, ClickActionData, ConfigEntityInterface, HueLikeLightCardConfigInterface, KnownIconSize, SceneConfig, SceneOrder, SliderType } from './types-config';
import { HassWsClient } from '../core/hass-ws-client';

declare type EntityRelations = {
    entityId: string;
    area: string | null;
    areaScenes: string[];
};

export class HueLikeLightCardConfig implements HueLikeLightCardConfigInterface {
    private _scenes: SceneConfig[] | null;

    public constructor(plainConfig: HueLikeLightCardConfigInterface) {
        this.entity = plainConfig.entity;
        this.entities = plainConfig.entities;
        this.title = plainConfig.title;
        this.description = plainConfig.description;
        this.icon = plainConfig.icon;
        this.iconSize = HueLikeLightCardConfig.getIconSize(plainConfig.iconSize);
        this.showSwitch = HueLikeLightCardConfig.getBoolean(plainConfig.showSwitch, true);
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

        this.style = plainConfig.style;
        this.card_mod = plainConfig.card_mod;
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

        return this.tryParseEnum<SliderType>(SliderType, plain, 'Slider type');
    }

    /**
     * @returns ClickAction valid enum, default for empty or throws exception.
     */
    private static getClickAction(plain: ClickAction | string | undefined): ClickAction {
        if (!plain)
            return ClickAction.Default;

        return this.tryParseEnum<ClickAction>(ClickAction, plain, 'Click action');
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
        const iconSize = this.tryParseEnum<KnownIconSize>(KnownIconSize, plain, 'Icon size');
        return Consts.IconSize[iconSize];
    }

    /**
     * @returns SceneOrder valid enum, default for empty or throws exception.
     */
    private static getSceneOrder(plain: string | undefined): SceneOrder {
        if (!plain)
            return SceneOrder.Default;

        return this.tryParseEnum<SceneOrder>(SceneOrder, plain, 'Scene order');
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

    public readonly entity?: string;
    public readonly entities?: string[] | ConfigEntityInterface[];
    public readonly title?: string;
    public readonly description?: string;
    public readonly icon?: string;
    public readonly iconSize: number;
    public readonly showSwitch: boolean;
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

    /** Support for card-mod styling */
    public readonly style?: unknown;
    public readonly card_mod?: unknown;

    /**
     * @returns Title from config or from passed container.
     */
    public getTitle(lightContainer: ILightContainer): IHassTextTemplate {
        return !!this.title
            ? new HassTextTemplate(this.title)
            : lightContainer.getTitle();
    }

    /**
     * Returns whether offColor was set in configuration.
     * Returns false, when offColor is taken from Consts.
     */
    public readonly wasOffColorSet: boolean;

    /**
     * @returns List of entity identifiers
     */
    public getEntities(): string[] {
        // create list of entities (prepend entity and then insert all entities)
        const ents: string[] = [];
        this.entity && ents.push(this.entity);
        this.entities && this.entities.forEach(e => {
            if (typeof e == 'string') {
                ents.push(e);
            }
            else if (e.entity) {
                ents.push(e.entity);
            }
        });

        return ents;
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

    private _scenesLoaded = false;

    /** @returns If the scenes has been loaded */
    public get scenesLoaded() {
        return this._scenesLoaded;
    }

    /**
     * Will try to load scenes from HA WS, if no scenes are configured.
     */
    public async tryLoadScenes(hass: HomeAssistant) {
        if (!hass)
            throw new Error('Hass instance must be passed!');

        if (this._scenes == null && !this._scenesLoaded) {
            this._scenesLoaded = true;

            const client = new HassWsClient(hass);

            try {
                // get entities, and create ordered list based on order of entities in config
                const entities = removeDuplicites(this.getEntities());
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
                loadedScenes = removeDuplicites(loadedScenes);

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
            catch (error) {
                console.error('Cannot load scenes from HA.');
                console.error(error);
            }
        }
    }
}