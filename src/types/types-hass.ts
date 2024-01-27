import { HomeAssistant } from 'custom-card-helpers';
import { HassEntity, HassEntityAttributeBase } from 'home-assistant-js-websocket';
import { LitElement } from 'lit';
import { IApiWrapper } from './types-api';

export class HassCustomCardInfo {
    public type: string;
    public name: string;
    public description: string;
}

interface HassWindowEventMap extends WindowEventMap {
    'pushstate': Event,
    'replacestate': Event
}

export interface IHassWindow extends Window {
    customCards?: HassCustomCardInfo[];
    customIcons?: Record<string, object>;
    hue_card?: IApiWrapper;
    hue_card_test?: IApiWrapper;

    // custom window events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addEventListener<K extends keyof HassWindowEventMap>(type: K, listener: (this: Window, ev: HassWindowEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeEventListener<K extends keyof HassWindowEventMap>(type: K, listener: (this: Window, ev: HassWindowEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
}

export interface HassLightAttributes extends HassEntityAttributeBase {
    supported_color_modes?: HassLightColorMode[];

    /** Actual color mode */
    color_mode?: HassLightColorMode;

    /** Minimal color temperature in Kelvins */
    min_color_temp_kelvin?: number;
    /** Maximal color temperature in Kelvins */
    max_color_temp_kelvin?: number;
    /** Current color temperature in Kelvins */
    color_temp_kelvin?: number;

    /** Minimal color temperature in Mireds */
    min_mireds?: number;
    /** Maximal color temperature in Mireds */
    max_mireds?: number;
    /** Current color temperature in Mireds */
    color_temp?: number;

    /** Brightness 0-255 */
    brightness?: number;

    /** Array [red, green, blue] */
    rgb_color?: number[];

    /** Array [hue, saturation] */
    hs_color?: number[];

    /** Array [x, y] */
    xy_color?: number[];
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
    entity?: string[];
    scene?: string[];
}

export interface HomeAssistantEx extends HomeAssistant {
    areas: Record<string, HassAreaInfo>;
    entities: Record<string, HassEntityInfo>;

    /**
     * Format the state of an entity.
     * @param stateObj - entity state object.
     * @param state - You can force the state value using this optional parameter.
     */
    formatEntityState?: (stateObj: HassEntity, state?: string) => string;

    /**
     * Format the attribute value of an entity.
     * @param stateObj - entity state object.
     * @param attribute - entity attribute name.
     * @param value - You can force the state value using this optional parameter.
     */
    formatEntityAttributeValue?: (stateObj: HassEntity, attribute: string, value?: unknown) => string;

    /**
     * Format the attribute name of an entity.
     * @param stateObj - entity state object.
     * @param attribute - entity attribute name.
     */
    formatEntityAttributeName?: (stateObj: HassEntity, attribute: string) => string;
}

export interface HaDialog extends LitElement {
    open: boolean;
    close(): void;
    show(): void;
}

export interface HaIcon extends LitElement {
    icon: string;
    /* private */ _loadIcon(): Promise<void>;
    /* private */ _path: string;
}

export interface HaControlSwitch extends LitElement {
    checked?: boolean;
}