import { HomeAssistant } from 'custom-card-helpers';
import { HassEntity, HassEntityAttributeBase } from 'home-assistant-js-websocket';

export class HassCustomCardInfo {
    public type: string;
    public name: string;
    public description: string;
}

export interface IHassWindow extends Window {
    customCards?: HassCustomCardInfo[];
    customIcons?: Record<string, object>;
}

export interface HassLightAttributes extends HassEntityAttributeBase {
    supported_color_modes?: HassLightColorMode[];
    color_mode: HassLightColorMode;
    brightness?: number;
    rgb_color?: number[];
}

export interface HassAreaInfo {
    area_id: string;
    name: string;
}

export enum HassLightColorMode {
    unknown = 'unknown',

    /**
     * The light can only be turned on or off.
     * Must be the only mode in supported_modes.
     */
    onoff = 'onoff',

    /**
     * Brightness of the light can be set.
     * Must be the only mode in supported_modes.
     */
    brightness = 'brightness',

    /**
     * Brightness and White color temperature can be set.
     * (If this is active mode, it means the light is in white temp mode as opposed to possible color mode.)
     */
    color_temp = 'color_temp',

    /**
     * Brightness and Color can be set.
     * Color can be found in `hs_color` as (hue, saturation) tuple and can be set using parameter of the same name.
     */
    hs = 'hs',

    /**
     * Brightness and Color can be set.
     * Color can be found in `xy_color` as (x, y) tuple and can be set using parameter of the same name.
     */
    xy = 'xy',

    /**
     * Brightness and Color can be set.
     * Color can be found in `rgb_color` as (r, g, b) tuple (brightness not normalized) and can be set using parameter of the same name.
     */
    rgb = 'rgb',

    /**
     * Brightness and Color can be set.
     * Color can be found in `rgbw_color` as (r, g, b, w) tuple (brightness not normalized) and can be set using parameter of the same name.
     */
    rgbw = 'rgbw',

    /**
     * Brightness and Color can be set.
     * Color can be found in `rgbww_color` as (r, g, b, cw, ww) tuple (brightness not normalized) and can be set using parameter of the same name.
     */
    rgbww = 'rgbww',

    /**
     * The light can be set to white mode, using the parameter `white` and setting brightness.
     * Must *NOT* be the only mode in supported_modes.
     */
    white = 'white'
}

export interface HassLightEntity extends HassEntity {
    attributes: HassLightAttributes;
}

export interface HassEntityInfo {
    area_id?: string;
    config_entry_id: string;
    device_id: string;
    disabled_by?: string;
    entity_category?: string;
    entity_id: string;
    has_entity_name: boolean;
    hidden_by?: string;
    icon?: string;
    id: string;
    name?: string;
    original_name?: string;
    platform?: string;
}

export interface HassSearchDeviceResult {
    area?: string[];
    automation?: string[];
    config_entry: string[];
    scene?: string[];
}

export interface HomeAssistantEx extends HomeAssistant {
    areas: Record<string, HassAreaInfo>;
    entities: Record<string, HassEntityInfo>;
}

export interface HaDialog extends HTMLElement {
    close?(): void;
}