import { HomeAssistant } from 'custom-card-helpers';
import { Consts } from '../types/consts';
import { ILightContainer } from '../types/types';
import { Background } from './colors/background';
import { Color } from './colors/color';
import { GlobalLights } from './global-lights';
import { LightContainer } from './light-container';

export class LightController implements ILightContainer {
    private _hass: HomeAssistant;
    private _lights: LightContainer[];
    private _defaultColor: Color;

    constructor(entity_ids: string[], defaultColor: Color) {
        // we need at least one
        if (!entity_ids.length)
            throw new Error('No entity specified (use "entity" and/or "entities").');

        this._defaultColor = defaultColor;
        this._lights = entity_ids.map(e => GlobalLights.getLightContainer(e));
    }

    set hass(hass: HomeAssistant) {
        this._hass = hass;
        this._lights.forEach(l => l.hass = hass);
    }

    isOn(): boolean {
        return this._lights.some(l => l.isOn());
    }
    isOff(): boolean {
        return this._lights.every(l => l.isOff());
    }
    isUnavailable(): boolean {
        return this._lights.every(l => l.isUnavailable());
    }
    turnOn(): void {
        this._lights.filter(l => l.isOff()).forEach(l => l.turnOn());
    }
    turnOff(): void {
        this._lights.filter(l => l.isOn()).forEach(l => l.turnOff());
    }

    get value() {
        return this.valueGetFactory();
    }
    set value(value: number) {
        // set value only to lights that are on
        let isOn = false;
        this._lights.filter(l => l.isOn()).forEach(l => { l.value = value; isOn = true; });
        // if no light is on, turn them all on now
        if (isOn == false) {
            this._lights.forEach(l => l.value = value);
        }
        // TODO: smart value setting
    }

    private valueGetFactory() {
        // get average from every light that is on
        let total = 0;
        let count = 0;
        this._lights.forEach(e => {
            if (e.isOn()) {
                count++;
                total += e.value;
            }
        });
        if (count == 0)
            return 0;

        const value = total / count * 1.0;
        return value;
    }

    getIcon(): string {
        const lightIcon = this._lights.length > 2
            ? Consts.DefaultMoreIcon // 3 lightbulbs
            : this._lights.length > 1
                ? Consts.DefaultTwoIcon // 2 lightbulbs
                : this._lights[0].getIcon() || Consts.DefaultOneIcon; // 1 lightbulb)

        return lightIcon;
    }

    getTitle() {
        let title = '';
        for (let i = 0; i < this._lights.length && i < 3; i++) {
            if (i > 0) {
                title += ', ';
            }
            title += this._lights[i].getTitle();
        }
        if (this._lights.length > 3)
            title += ', ...';

        return title;
    }

    getBackground(): Background | null {
        const backgrounds = this._lights.filter(l => l.isOn()).map(l => l.getBackground() || this._defaultColor);
        if (backgrounds.length == 0)
            return null;
        return new Background(backgrounds);
    }
}