import { HomeAssistant } from 'custom-card-helpers';
import { HassEntityAttributeBase } from 'home-assistant-js-websocket';
import { Background } from '../core/colors/background';

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

export interface HueLikeLightCardConfigInterface {
    readonly entity?: string;
    readonly entities?: string[];
    readonly title?: string;
    readonly icon?: string;
    //readonly scenes?: string[];
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