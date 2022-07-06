import { LovelaceCardConfig } from 'custom-card-helpers';
import { HueLikeLightCardConfigInterface } from './types';
import { Consts } from './consts';
import { Color } from '../core/colors/color';
import { ColorResolver } from '../core/colors/color-resolvers';

export class HueLikeLightCardConfig implements HueLikeLightCardConfigInterface {
    constructor(plainConfig: HueLikeLightCardConfigInterface | LovelaceCardConfig) {
        this.entity = plainConfig.entity;
        this.entities = plainConfig.entities;
        this.title = plainConfig.title;
        this.icon = plainConfig.icon;
        this.allowZero = HueLikeLightCardConfig.getBoolean(plainConfig.allowZero, false);
        this.defaultColor = plainConfig.defaultColor || Consts.DefaultColor;
        this.offColor = plainConfig.offColor || Consts.OffColor;
        this.disableOffShadow = HueLikeLightCardConfig.getBoolean(plainConfig.disableOffShadow, false);
        this.hueBorders = HueLikeLightCardConfig.getBoolean(plainConfig.hueBorders, true);
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

    readonly entity?: string;
    readonly entities?: string[];
    readonly title?: string;
    readonly icon?: string;
    readonly allowZero: boolean;
    readonly defaultColor: string;
    readonly offColor: string;
    readonly disableOffShadow: boolean;
    readonly hueBorders: boolean;

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