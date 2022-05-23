import { HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import { HassEntityAttributeBase } from 'home-assistant-js-websocket';
import { Background } from '../core/colors/background';

export type ValueFactory = () => unknown;

export interface HueLikeLightCardConfig extends LovelaceCardConfig {
    readonly title?: string;
    readonly icon?: string;
    readonly hueBorders?: boolean;
    readonly offColor?: string;
    readonly defaultColor?: string;
    readonly allowZero?: boolean;
    readonly entity?: string;
    readonly entities?: string[]
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