import { HomeAssistant } from 'custom-card-helpers';
import { HassLightEntity } from '../types/types-hass';
import { Consts } from '../types/consts';
import { ensureEntityDomain } from '../types/extensions';
import { ILightContainer, ILightFeatures } from '../types/types';
import { Background } from './colors/background';
import { Color } from './colors/color';
import { StaticTextTemplate } from './hass-text-template';
import { LightFeatures } from './light-features';
import { TimeCache, TimeCacheValue } from './time-cache';
import { NotifyBase } from './notify-base';

export class LightContainer extends NotifyBase<LightContainer> implements ILightContainer {
    private _entity_id: string;
    private _hass: HomeAssistant;
    private _entity: HassLightEntity;
    private _entityFeatures: LightFeatures;

    public constructor(entity_id: string) {
        super();

        ensureEntityDomain(entity_id, 'light');

        this._entity_id = entity_id;

        this.initTimeCache();
    }

    public set hass(value: HomeAssistant) {
        this._hass = value;
        this._entity = <HassLightEntity>this._hass.states[this._entity_id];
        this._entityFeatures = new LightFeatures(this._entity);
        this.raisePropertyChanged('hass');
    }

    //#region TimeCache

    /*
     * This TimeCache is here, so the UI control can react instantly on changes.
     * When user do some change, it might take up to about 2 seconds for HA to register these changes on devices.
     * So the cache is here to tell the UI that the expected change has happened instantly.
     * After the specified interval, cached values are invalidated and in the moment of getting these values, live values are read from HA.
     */

    // TODO: also implement some change notify mechanizm

    private _cache: TimeCache;
    private _lastOnValue: number;
    private _lastBackground: Background;

    private initTimeCache(): void {
        this._cache = new TimeCache(Consts.TimeCacheInterval);// ms
        this._cache.registerProperty('state', () => new TimeCacheValue(this._entity?.state, this.getDontCacheState()));
        this._cache.registerProperty('value', () => new TimeCacheValue(this.valueGetFactory(), this.getDontCacheValue()));
    }

    private getDontCacheState(): boolean {
        return !this._entity || this._entity.state == 'unavailable';
    }
    private getDontCacheValue(): boolean {
        return this.getDontCacheState() || this._entity.attributes.brightness == null;
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

    public isUnavailable(): boolean {
        return this._cache.getValue('state') == 'unavailable';
    }
    public isOn(): boolean {
        return this._cache.getValue('state') == 'on';
    }
    public isOff(): boolean {
        return !this.isOn();
    }
    public turnOn(): void {
        this.toggle(true);
    }
    public turnOff(): void {
        this.toggle(false);
    }
    public toggle(on: boolean) {
        if (this.isUnavailable())
            return;

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
        const brightness = attr.brightness ?? 255;
        this._lastOnValue = Math.round((brightness / 255.0) * 100); // brightness is 0-255
        return this._lastOnValue;
    }
    public get value() {
        return <number>this._cache.getValue('value');
    }
    public set value(value: number) {
        // just to be sure
        if (value < 0) {
            value = 0;
        } else if (value > 100) {
            value = 100;
        }

        this.notifyValueChanged(value);
        const brightness = Math.round((value / 100.0) * 255); // value is 0-100
        this._hass.callService('light', 'turn_on', {
            entity_id: this._entity_id,
            ['brightness']: brightness
        });
    }

    public getIcon() {
        return this._entity && this._entity.attributes.icon;
    }

    public getTitle() {
        return new StaticTextTemplate(this._entity.attributes.friendly_name ?? this._entity_id);
    }

    public getBackground(): Background | null {
        const attr = this._entity.attributes;
        const rgb = <number[]>attr.rgb_color; // array with value r,g,b

        if (!rgb) {
            if (this._lastBackground)
                return this._lastBackground;

            return null;
        }

        const color = new Color(rgb[0], rgb[1], rgb[2]);
        this._lastBackground = new Background([color]);
        return new Background([this._lastBackground]);
    }

    public getEntityId(): string {
        return this._entity_id;
    }

    public get features(): ILightFeatures {
        return this._entityFeatures;
    }
}

