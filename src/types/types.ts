import { HomeAssistant } from 'custom-card-helpers';
import { HassEntity, HassEntityAttributeBase } from 'home-assistant-js-websocket';
import { Background } from '../core/colors/background';
import { Color } from '../core/colors/color';
import { ColorResolver } from '../core/colors/color-resolvers';
import { ensureEntityDomain } from './extensions';

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

export class ClickActionData {
    private readonly _onlyValue : string;
    private readonly _valueStore : Record<string, string>;

    constructor(plainConfig: string | Record<string, string> | ClickActionData | undefined) {
        if (typeof plainConfig == 'string') {
            this._onlyValue = plainConfig;
        } else if (plainConfig instanceof ClickActionData) {
            // eslint-disable-next-line no-underscore-dangle
            this._onlyValue = plainConfig._onlyValue;
            // eslint-disable-next-line no-underscore-dangle
            this._valueStore = plainConfig._valueStore;
        } else {
            this._valueStore = plainConfig || {};
        }
    }

    /**
     * Gets data parameter from config.
     */
    public getData(key:string) : string {
        if (this._onlyValue)
            return this._onlyValue;

        return this._valueStore[key];
    } 
}

export class SceneConfig {
    constructor(entity: string) {
        ensureEntityDomain(entity, 'scene');

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

    constructor(configOrEntityId:SceneConfig | string) {
        if (typeof configOrEntityId == 'string') {
            this._config = new SceneConfig(configOrEntityId);
        } else {
            this._config = configOrEntityId;
        }
    }

    set hass(value: HomeAssistant) {
        this._hass = value;
        this._entity = this._hass.states[this._config.entity];
    }

    /**
     * Will activate this scene
     */
    public activate() {
        this.ensureHass();

        this._hass.callService('scene', 'turn_on', { entity_id: this._config.entity });
    }

    public getTitle() {
        this.ensureHass();

        return this._config.title || this._entity.attributes.friendly_name;
    }

    /**
     * @returns icon from config or from entity settings or passed defaultIcon.
     */
    public getIcon(defaultIcon:string | null = null) {
        this.ensureHass();

        // if config has empty icon defined - return empty
        if (this._config.icon != undefined)
            return this._config.icon;

        return this._entity.attributes.icon || defaultIcon;
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
    readonly offClickAction?: ClickAction;
    readonly offClickData?: string | Record<string, string> | ClickActionData;
    readonly onClickAction?: ClickAction;
    readonly onClickData?: string | Record<string, string> | ClickActionData;
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

export interface HassAreaInfo {
    area_id: string;
    name: string;
}

export interface HassEntityInfo {
    area_id?:string;
    config_entry_id:string;
    device_id:string;
    disabled_by?:string;
    entity_category?:string;
    entity_id:string;
    has_entity_name:boolean;
    hidden_by?:string;
    icon?:string;
    id:string;
    name?:string;
    original_name?:string;
    platform?:string;
}

export interface HassSearchDeviceResult {
    area?:string[];
    automation?:string[];
    config_entry:string[];
    scene?:string[];
}

export interface HomeAssistantEx extends HomeAssistant {
    areas: Record<string, HassAreaInfo>;
    entities: Record<string, HassEntityInfo>;
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
     * @returns icon for this container of lights.
     */
    getIcon(): string | undefined | null;

    /**
     * @returns suggested title for card with lights in this container.
     */
    getTitle(): string | undefined | null;

    /**
     * @returns background style for card with lights in this container.
     */
    getBackground(): Background | null;

    /**
     * @returns entity_id of light inside.
     * @throws Error when this container contains multiple lights.
     */
    getEntityId(): string;
}