import { HomeAssistant } from 'custom-card-helpers';
import { Background } from '../core/colors/background';
import { Action1, Action2 } from './functions';
import { Color } from '../core/colors/color';
import { HassLightColorMode } from './types-hass';

export interface INotify {
    /**
     * Will register callback on property change events. 
     * @param id Id for this specific callback. If this id already exists, it's callback will be overwriten.
     * @param callback Action that will be called when any supported property if changed (takes propertyName as parameter).
     * @param includeHass Specifies, whether change only in 'hass' property should be included (set to false to ignore).
     */
    registerOnPropertyChanged(id: string, callback: Action1<(string | number | symbol)[]>, includeHass?: boolean): void;

    /**
     * Will unregister callback from property change events.
     * @param id Id for specific callback
     */
    unregisterOnPropertyChanged(id: string): void;
}

export interface INotifyGeneric<TThis> extends INotify {
    /**
     * Will register callback on property change events. 
     * @param id Id for this specific callback. If this id already exists, it's callback will be overwriten.
     * @param callback Action that will be called when any supported property if changed (takes propertyName as parameter).
     * @param includeHass Specifies, whether change only in 'hass' property should be included (set to false to ignore).
     */
    registerOnPropertyChanged(id: string, callback: Action2<(keyof TThis)[], TThis>, includeHass?: boolean): void;
}

export interface IHassTextTemplate {
    /**
     * Resolves this template to string, using hass states.
     */
    resolveToString(hass: HomeAssistant | null): string;
}

export interface ILightConfig {
    /**
     * Sets current hass instance to this container.
     */
    set hass(hass: HomeAssistant);

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

    /**
     * Gets features of lights in this container.
     */
    get features(): ILightFeatures;
}

export interface ILightContainer extends ILightConfig {
    /**
     * @returns all lights in this container. May return array containing only itself, when current container is already single light.
     */
    getLights(): ISingleLightContainer[];

    /**
     * @returns true if any light in this container is on.
     */
    isOn(): boolean;

    /**
     * @returns true if all lights in this container are off.
     */
    isOff(): boolean;

    /**
     * @returns true if all lights in this container are unavailable.
     */
    isUnavailable(): boolean;

    /**
     * Will turn all lights on.
     *  @param scene When passed, instead of turning on the light, given scene will be activated.
     */
    turnOn(scene?: string): void;

    /**
     * Will turn all lights off.
     */
    turnOff(): void;

    /**
     * If supported.
     * Gets or sets current brightness percentage (0 - 100) of lights in this container.
     */
    brightnessValue: number;

    /**
     * If supported.
     * Sets brightness percentage (0 - 100) of lights in this container.
     * @returns Promise resolved when Home Assistant confirmed the change.
     */
    setBrightnessValue(value: number): Promise<void>;

    /**
     * If supported.
     * Shows brightness percentage (0 - 100) on all controls of these lights without calling Home Assistant (live preview while dragging).
     * The previewed value is kept (state from Home Assistant is ignored) until `releaseBrightnessPreview` is called or the light is turned on/off.
     * Only brightness of the lights is previewed - on/off state of a group entity (`groupEntity`) still comes from Home Assistant.
     */
    previewBrightnessValue(value: number): void;

    /**
     * Releases the previewed brightness - controls show the state from Home Assistant again.
     */
    releaseBrightnessPreview(): void;
}

export interface ISingleLightContainer extends ILightContainer, INotify {
    /**
     * @returns if light is in COLOR color mode.
     */
    isColorModeColor(): boolean;

    /**
     * @returns if light is in TEMP color mode.
     */
    isColorModeTemp(): boolean;

    /**
     * Gets current color mode.
     */
    get colorMode(): HassLightColorMode;

    /**
     * If supported.
     * Gets or sets light temperature in kelvin (typically between 2000 and 6500 K).
     * When set, causes mode to switch.
     */
    colorTemp: number | null;

    /**
     * If supported.
     * Gets or sets light color.
     * When set, causes mode to switch.
     */
    color: Color | null;

    /**
     * If supported.
     * Sets light temperature in kelvin, causes mode to switch.
     * @returns Promise resolved when Home Assistant confirmed the change.
     */
    setColorTemp(newTemp: number | null): Promise<void>;

    /**
     * If supported.
     * Sets light color, causes mode to switch.
     * @returns Promise resolved when Home Assistant confirmed the change.
     */
    setColor(newColor: Color | null): Promise<void>;
}

export interface ILightFeatures {
    /**
     * @returns whether no extended light feature is supported.
     */
    isEmpty(): boolean;

    /**
     * @returns whether the only feature is brightness.
     */
    isOnlyBrightness(): boolean;

    /**
     * Gets if it's possible to set the lights brightness.
     */
    get brightness(): boolean;

    /**
     * Gets if it's possible to set temperature of white color (warm, cold) in Kelvins.
     */
    get colorTemp(): boolean;

    /**
     * Gets minimal value of colorTemp in kelvins (only if supported).
     */
    get colorTempMinKelvin(): number | null;

    /**
     * Gets minimal value of colorTemp in kelvins (only if supported).
     */
    get colorTempMaxKelvin(): number | null;

    /**
     * Gets if it's possible to set color of the light.
     */
    get color(): boolean;
}