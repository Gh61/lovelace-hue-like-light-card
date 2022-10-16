import { HomeAssistant } from 'custom-card-helpers';
import { HassEntity, HassEntityAttributeBase } from 'home-assistant-js-websocket';
import { Background } from '../core/colors/background';
import { Color } from '../core/colors/color';
import { ColorResolver } from '../core/colors/color-resolvers';

export type ValueFactory = () => unknown;

export class CustomCardInfo {
    type: string;
    name: string;
    description: string;
}

export interface WindowWithCards extends Window {
    customCards?: CustomCardInfo[];
}

export enum ClickAction {
    Default = 'default',
    NoAction = 'none',
    TurnOn = 'turn-on',
    TurnOff = 'turn-off',
    MoreInfo = 'more-info',
    Scene = 'scene',
    HueScreen = 'hue-screen'
}

export class SceneConfig {
    constructor(entity: string) {
        const domain = entity.split('.')[0];
        if (domain != 'scene')
            throw new Error(`Unsupported entity type: ${domain}. The only supported type for scenes is 'scene'.`);

        this.entity = entity;
    }

    entity: string;
    title?: string;
    icon?: string;
    color?: string;
}

export class SceneData {
    private _config:SceneConfig;
    private _hass:HomeAssistant;
    private _entity:HassEntity;

    constructor(config:SceneConfig) {
        this._config = config;
    }

    set hass(value: HomeAssistant) {
        this._hass = value;
        this._entity = this._hass.states[this._config.entity];
    }

    public getTitle() {
        this.ensureHass();

        return this._config.title || this._entity.attributes.friendly_name;
    }

    public getIcon() {
        this.ensureHass();

        return this._config.icon || this._entity.attributes.icon;
    }

    /**
     * @returns color as instance of Color or null, if no color is present.
     */
    public getColor() : Color | null {
        if (!this._config.color)
            return null;

        return ColorResolver.getColor(this._config.color);
    }

    private ensureHass() {
        if (!this._hass)
            throw new Error('Scene data not initialized - call setHass first!');
    }
}

export interface HueLikeLightCardConfigInterface {
    readonly entity?: string;
    readonly entities?: string[];
    readonly title?: string;
    readonly icon?: string;
    readonly scenes?: (string | SceneConfig)[];
    readonly offClick?: ClickAction;
    readonly onClick?: ClickAction;
    readonly allowZero?: boolean;
    readonly defaultColor?: string;
    readonly offColor?: string;
    readonly disableOffShadow?: boolean;
    readonly hueBorders?: boolean;
    readonly resources?: ResourcesInterface;
}

export interface ResourcesInterface {
    readonly scenes?: string;
    readonly lights?: string;
}

export interface HassLightAttributes extends HassEntityAttributeBase {
    brightness?: number;
    rgb_color?: number[];
}

export interface ILightContainer {
    /**
     * Sets current hass instance to this container.
     */
    set hass(hass: HomeAssistant);

    /**
     * Returns true if any light in this container is on.
     */
    isOn(): boolean;

    /**
     * Returns true if all lights in this container are off.
     */
    isOff(): boolean;

    /**
     * Returns true if all lights in this container are unavailable.
     */
    isUnavailable(): boolean;

    /**
     * Will turn all lights on.
     */
    turnOn(): void;

    /**
     * Will turn all lights off.
     */
    turnOff(): void;

    /**
     * Gets or sets current value of brightness of lights in this container.
     */
    value: number;

    /**
     * Returns icon for this container of lights.
     */
    getIcon(): string | undefined | null;

    /**
     * Returns suggested title for card with lights in this container.
     */
    getTitle(): string | undefined | null;

    /**
     * Returns background style for card with lights in this container.
     */
    getBackground(): Background | null;
}