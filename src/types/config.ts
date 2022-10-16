import { LovelaceCardConfig } from 'custom-card-helpers';
import { ClickAction, HueLikeLightCardConfigInterface, SceneConfig } from './types';
import { Consts } from './consts';
import { Color } from '../core/colors/color';
import { ColorResolver } from '../core/colors/color-resolvers';
import { Resources } from './resources';

export class HueLikeLightCardConfig implements HueLikeLightCardConfigInterface {
    constructor(plainConfig: HueLikeLightCardConfigInterface | LovelaceCardConfig) {
        this.entity = plainConfig.entity;
        this.entities = plainConfig.entities;
        this.title = plainConfig.title;
        this.icon = plainConfig.icon;
        this.scenes = HueLikeLightCardConfig.getScenesArray(plainConfig.scenes);
        this.offClick = HueLikeLightCardConfig.getClickAction(plainConfig.offClick);
        this.onClick = HueLikeLightCardConfig.getClickAction(plainConfig.onClick);
        this.allowZero = HueLikeLightCardConfig.getBoolean(plainConfig.allowZero, false);
        this.defaultColor = plainConfig.defaultColor || Consts.DefaultColor;
        this.offColor = plainConfig.offColor || Consts.OffColor;
        this.disableOffShadow = HueLikeLightCardConfig.getBoolean(plainConfig.disableOffShadow, false);
        this.hueBorders = HueLikeLightCardConfig.getBoolean(plainConfig.hueBorders, true);
        this.resources = new Resources(plainConfig.resources);
    }

    /**
     * Returns boolean from plain config.
     * @plain Plain value from config
     * @def Default value if plain value is not filled
     */
    private static getBoolean(plain:boolean | undefined, def:boolean) : boolean {
        if (plain == null)
            return def;
        return !!plain;
    }

    /**
     * Returns ClickAction valid enum, default for empty or throws exception.
     * @param plain 
     */
    private static getClickAction(plain:ClickAction | string | undefined) : ClickAction {
        if (!plain)
            return ClickAction.Default;

        let helpValues = '';
        for (const value in ClickAction) {
            const enumValue = (ClickAction as Record<string, string>)[value];
            if (plain == enumValue)
                return plain as ClickAction;

            helpValues += `'${enumValue}', `;
        }
    
        throw new Error(`Click action '${plain}' was not recognized. Allowed values are: ${helpValues}`);
        //return ClickAction.Default;
    }

    /**
     * Returns array of SceneConfig - parsed from passed plain config.
     * @param plain Plain value from config
     */
    private static getScenesArray(plain: (string | SceneConfig)[] | undefined) : SceneConfig[] {
        if (!plain)
            return [];

        if (plain.length > 0) {
            const result = new Array<SceneConfig>();
            for (let i = 0; i < plain.length; i++) {
                const scene = plain[i];
                const pScene = HueLikeLightCardConfig.getScene(scene, i);
                if (!pScene) {

                }
            }
            return result;
        }

        return [];
    }

    /**
     * Returns SceneConfig - parse from passed plain config value.
     * @param plain Plain value of one scene from config
     * @param index Index of value in array (for error message purposes)
     */
    private static getScene(plain: string | SceneConfig, index:number) : SceneConfig {
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

        return result;
    }

    readonly entity?: string;
    readonly entities?: string[];
    readonly title?: string;
    readonly icon?: string;
    readonly scenes: SceneConfig[];
    readonly offClick: ClickAction;
    readonly onClick: ClickAction;
    readonly allowZero: boolean;
    readonly defaultColor: string;
    readonly offColor: string;
    readonly disableOffShadow: boolean;
    readonly hueBorders: boolean;
    readonly resources: Resources;

    /**
     * @returns List of entity identifiers
     */
    public getEntities() : string[] {
        // create list of entities (prepend entity and then insert all entities)
        const ents: string[] = [];
        this.entity && ents.push(this.entity);
        this.entities && this.entities.forEach(e => ents.push(e));

        return ents;
    }

    /**
     * @returns Default color as instance of Color.
     */
    public getDefaultColor() : Color {
        return ColorResolver.getColor(this.defaultColor);
    }

    /**
     * @returns Off color as instance of Color.
     */
    public getOffColor() : Color {
        return new Color(this.offColor);
    }
}