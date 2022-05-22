import { HomeAssistant } from 'custom-card-helpers';
import { HassEntity } from 'home-assistant-js-websocket';
import { TimeCache, TimeCacheValue } from './time-cache';

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
    getBackground(): string;
}

export class LightContainer implements ILightContainer {
    private _entity_id: string;
    private _hass: HomeAssistant;
    private _entity: HassEntity;

    constructor(entity_id: string) {
        const domain = entity_id.split('.')[0];
        if (domain != 'light')
            throw new Error(`Unsupported entity type: ${domain}. The only supported type is 'light'.`);

        this._entity_id = entity_id;

        this.initTimeCache();
    }

    set hass(value: HomeAssistant) {
        this._hass = value;
        this._entity = this._hass.states[this._entity_id];
    }

    //#region TimeCache

    /*
     * This TimeCache is here, so the UI control can react instantly on changes.
     * When user do some change, it might take up to about 2 seconds for HA to register these changes on devices.
     * So the cache is here to tell the UI that the expected change has happened instantly.
     * After the specified interval, cached values are invalidated and in the moment of getting these values, live values are read from HA.
     */

    // TODO: make the cache somehow public,
    // maybe make LightContainer instances system-wide, so all cards can react to changes instantly
    // TODO: also implement some change notify mechanizm

    private _cache: TimeCache;
    private _lastOnValue: number;
    private _lastColor: string;

    private initTimeCache(): void {
        this._cache = new TimeCache(1500);// ms
        this._cache.registerProperty('state', () => new TimeCacheValue(this._entity?.state, this.getDontCache()));
        this._cache.registerProperty('value', () => new TimeCacheValue(this.valueGetFactory(), this.getDontCache()));
    }

    private getDontCache(): boolean {
        return !this._entity || this._entity.state == 'unavailable';
    }

    private notifyTurnOn(): void {
        this._cache.setValue('state', 'on');
        if (this._lastOnValue) {
            this._cache.setValue('value', this._lastOnValue);
        }
    }

    private notifyTurnOff(): void {
        this._cache.setValue('state', 'off');
        this._cache.setValue('value', 0);
    }

    private notifyValueChanged(value: number): void {
        if (value > 0) {
            this._lastOnValue = value;
        }
        this._cache.setValue('value', value);
        this._cache.setValue('state', value > 0 ? 'on' : 'off');
    }

    //#endregion

    isUnavailable(): boolean {
        return this._cache.getValue('state') == 'unavailable';
    }
    isOn(): boolean {
        return this._cache.getValue('state') == 'on';
    }
    isOff(): boolean {
        return !this.isOn();
    }
    turnOn(): void {
        this.toggle(true);
    }
    turnOff(): void {
        this.toggle(false);
    }
    toggle(on: boolean) {
        if (on) {
            this.notifyTurnOn();
        } else {
            this.notifyTurnOff();
        }
        this._hass.callService('light', on ? 'turn_on' : 'turn_off', { entity_id: this._entity_id });
    }

    private valueGetFactory() {
        if (this.isOff())
            return 0;

        const attr = this._entity.attributes;
        return Math.round((attr.brightness * 100.0) / 255); // brightness is 0-255
    }
    get value() {
        return <number>this._cache.getValue('value');
    }
    set value(value: number) {
        this.notifyValueChanged(value);
        const brightness = Math.round((value / 100.0) * 255); // brightness is 0-255
        this._hass.callService('light', 'turn_on', {
            entity_id: this._entity_id,
            ['brightness']: brightness
        });
    }

    getIcon() {
        return this._entity && this._entity.attributes.icon;
    }

    getTitle() {
        return this._entity.attributes.friendly_name;
    }

    getBackground(): string {
        const attr = this._entity.attributes;
        const rgb = <number[]>attr.rgb_color; // array with value r,g,b

        if (!rgb) {
            if (this._lastColor)
                return this._lastColor;

            return '#ffda95'; // +-warm light
        }

        this._lastColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        return this._lastColor;
    }
}

