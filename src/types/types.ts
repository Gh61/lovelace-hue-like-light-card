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

// #region Hass

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

export interface HaDialog extends HTMLElement {
    close?():void;
}

// #endregion

export interface IHassTextTemplate {
    /**
     * Resolves this template to string, using hass states.
     */
    resolveToString(hass:HomeAssistant | null):string;
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
    getTitle(): IHassTextTemplate;

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