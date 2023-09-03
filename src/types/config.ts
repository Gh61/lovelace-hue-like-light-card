import { IHassTextTemplate, ILightContainer } from './types-interface';
import { HassSearchDeviceResult } from './types-hass';
import { Consts, KnownIconSize } from './consts';
import { Color } from '../core/colors/color';
import { ColorResolver } from '../core/colors/color-resolvers';
import { Resources } from './resources';
import { HomeAssistant } from 'custom-card-helpers';
import { removeDuplicites } from './extensions';
import { ColorExtended } from '../core/colors/color-extended';
import { HassTextTemplate } from '../core/hass-text-template';
import { ClickAction, ClickActionData, ConfigEntityInterface, HueLikeLightCardConfigInterface, SceneConfig } from './types-config';

export class HueLikeLightCardConfig implements HueLikeLightCardConfigInterface {
    private _scenes: SceneConfig[];

    public constructor(plainConfig: HueLikeLightCardConfigInterface) {
        this.entity = plainConfig.entity;
        this.entities = plainConfig.entities;
        this.title = plainConfig.title;
        this.icon = plainConfig.icon;
        this.iconSize = HueLikeLightCardConfig.getIconSize(plainConfig.iconSize);
        this.showSwitch = HueLikeLightCardConfig.getBoolean(plainConfig.showSwitch, true);
        this._scenes = HueLikeLightCardConfig.getScenesArray(plainConfig.scenes);
        this.offClickAction = HueLikeLightCardConfig.getClickAction(plainConfig.offClickAction);
        this.offClickData = new ClickActionData(plainConfig.offClickData);
        this.onClickAction = HueLikeLightCardConfig.getClickAction(plainConfig.onClickAction);
        this.onClickData = new ClickActionData(plainConfig.onClickData);
        this.allowZero = HueLikeLightCardConfig.getBoolean(plainConfig.allowZero, false);
        this.theme = plainConfig.theme || Consts.ThemeDefault;
        this.defaultColor = plainConfig.defaultColor || Consts.DefaultColor;
        this.offColor = plainConfig.offColor || Consts.OffColor;
        this.wasOffColorSet = !!plainConfig.offColor;
        this.hueScreenBgColor = plainConfig.hueScreenBgColor || Consts.DialogBgColor;

        if (plainConfig.disableOffShadow != null) {
            console.warn("[HueLikeLightCard] Use 'offShadow' (with inverted value) property instead of deprecated 'disableOffShadow'");
        }

        this.offShadow = HueLikeLightCardConfig.getBoolean(plainConfig.offShadow, !HueLikeLightCardConfig.getBoolean(plainConfig.disableOffShadow, false));
        this.hueBorders = HueLikeLightCardConfig.getBoolean(plainConfig.hueBorders, true);
        this.resources = new Resources(plainConfig.resources);

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
    private static getScenesArray(plain: (string | SceneConfig)[] | undefined): SceneConfig[] {
        if (!plain)
            return [];

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
    public readonly icon?: string;
    public readonly iconSize: number;
    public readonly showSwitch: boolean;
    public get scenes() { return this._scenes; }
    public readonly offClickAction: ClickAction;
    public readonly offClickData: ClickActionData;
    public readonly onClickAction: ClickAction;
    public readonly onClickData: ClickActionData;
    public readonly allowZero: boolean;
    public readonly theme: string;
    public readonly defaultColor: string;
    public readonly offColor: string;
    public readonly hueScreenBgColor: string;
    public readonly offShadow: boolean;
    /**
     * @deprecated Use offShadow instead.
     */
    public get disableOffShadow() {
        return !this.offShadow;
    }
    public readonly hueBorders: boolean;
    public readonly resources: Resources;

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
            } else if (e.entity) {
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
     * Will try to load scenes from HA WS, if are no scenes are configured.
     */
    public async tryLoadScenes(hass: HomeAssistant) {
        if (!hass)
            throw new Error('Hass instance must be passed!');

        if (this.scenes.length == 0 && !this._scenesLoaded) {
            this._scenesLoaded = true;

            try {
                // load all areas
                let lightAreas = new Array<string>();
                await Promise.all(this.getEntities().map(async entityId => {
                    const entityResult = await hass.connection.sendMessagePromise<HassSearchDeviceResult>({
                        type: 'search/related',
                        item_type: 'entity',
                        item_id: entityId
                    });
                    if (entityResult && entityResult.area && entityResult.area.length) {
                        lightAreas.push(entityResult.area[0]);
                    }
                }));
                lightAreas = removeDuplicites(lightAreas);

                // load scenes for areas
                let loadedScenes = new Array<string>();
                await Promise.all(lightAreas.map(async area => {
                    const areaResult = await hass.connection.sendMessagePromise<HassSearchDeviceResult>({
                        type: 'search/related',
                        item_type: 'area',
                        item_id: area
                    });

                    if (areaResult && areaResult.scene) {
                        areaResult.scene.forEach(s => loadedScenes.push(s));
                    }
                }));
                loadedScenes = removeDuplicites(loadedScenes);

                // set to config
                this._scenes = HueLikeLightCardConfig.getScenesArray(loadedScenes);
            } catch (error) {
                console.error('Cannot load scenes from HA.');
                console.error(error);
            }
        }
    }
}