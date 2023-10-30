import { HomeAssistant } from 'custom-card-helpers';
import { ILightContainer, ILightFeatures } from '../types/types-interface';
import { Background } from './colors/background';
import { Color } from './colors/color';
import { GlobalLights } from './global-lights';
import { StaticTextTemplate } from './hass-text-template';
import { LightContainer } from './light-container';
import { LightFeaturesCombined } from './light-features';
import { NotifyBase } from './notify-base';
import { IconHelper } from './icon-helper';
import { localize } from '../localize/localize';

export class LightController extends NotifyBase<LightController> implements ILightContainer {
    private _hass: HomeAssistant;
    private _lights: LightContainer[];
    private _lightsFeatures: LightFeaturesCombined;
    private _defaultColor: Color;

    public constructor(entity_ids: string[], defaultColor: Color) {
        super();

        // we need at least one
        if (!entity_ids.length)
            throw new Error('No entity specified (use "entity" and/or "entities").');

        this._defaultColor = defaultColor;
        this._lights = entity_ids.map(e => GlobalLights.getLightContainer(e));
        this._lightsFeatures = new LightFeaturesCombined(() => this._lights.map(l => l.features));
    }

    /**
     * Returns count of registered lights.
     */
    public get count() {
        return this._lights.length;
    }

    /**
     * @returns all lit lights.
     */
    public getLitLights(): ILightContainer[] {
        return this._lights.filter(l => l.isOn());
    }

    /**
     * @returns all lights in this controller.
     */
    public getLights(): ILightContainer[] {
        return this._lights.map(l => l); // map will cause creation of new array
    }

    public set hass(hass: HomeAssistant) {
        this._hass = hass;
        this._lights.forEach(l => l.hass = hass);
        this.raisePropertyChanged('hass');
    }
    public get hass() {
        return this._hass;
    }

    public isOn(): boolean {
        return this._lights.some(l => l.isOn());
    }
    public isOff(): boolean {
        return this._lights.every(l => l.isOff());
    }
    public isUnavailable(): boolean {
        return this._lights.every(l => l.isUnavailable());
    }
    public turnOn(): void {
        this._lights.filter(l => l.isOff()).forEach(l => l.turnOn());
    }
    public turnOff(): void {
        this._lights.filter(l => l.isOn()).forEach(l => l.turnOff());
    }

    public get brightnessValue() {
        return this.valueGetFactory();
    }
    public set brightnessValue(value: number) {
        const litLights = this._lights.filter(l => l.isOn());
        // when only one light is on, set the value to that light
        if (litLights.length == 1) {
            litLights[0].brightnessValue = value;
            return;
        } else if (litLights.length == 0) { // when no light is on, set value to all lights
            this._lights.forEach(l => l.brightnessValue = value);
            return;
        }

        // get percentage change of remaining value
        const oldValue = this.brightnessValue;
        const valueChange = value - oldValue;
        const remainingValue = valueChange > 0 ? (100 - this.brightnessValue) : this.brightnessValue;
        const percentualChange = valueChange / remainingValue; // percentual of remaining

        // calculate the value for each light
        this._lights.filter(l => l.isOn()).forEach(l => {
            const lightOldValue = l.brightnessValue;
            // of value of this light is the same asi value of controller, set it exactly to value
            if (lightOldValue == oldValue) {
                l.brightnessValue = value;
                return;
            }

            // get remaining part of this one light
            const remainingLightValue = valueChange > 0 ? (100 - l.brightnessValue) : l.brightnessValue;
            // compute value increment
            const lightValueChange = Math.round(remainingLightValue * percentualChange);
            // get new value
            let newValue = l.brightnessValue + lightValueChange;

            // don't let the value drop to zero, if the target value isn't exactly zero
            if (newValue < 1 && value > 0) {
                newValue = 1;
            }
            l.brightnessValue = newValue;
        });
    }

    private valueGetFactory() {
        // get average from every light that is on
        let total = 0;
        let count = 0;
        this._lights.forEach(e => {
            if (e.isOn()) {
                count++;
                total += e.brightnessValue;
            }
        });
        if (count == 0)
            return 0;

        const value = total / count * 1.0;
        return value;
    }

    public getIcon(): string {
        if (this._lights.length == 1) {
            return this._lights[0].getIcon() || IconHelper.getIcon(1);
        }

        return IconHelper.getIcon(this._lights.length);
    }

    public getTitle() {
        let title = '';
        for (let i = 0; i < this._lights.length && i < 3; i++) {
            if (i > 0) {
                title += ', ';
            }
            title += this._lights[i].getTitle();
        }
        if (this._lights.length > 3)
            title += ', ...';

        return new StaticTextTemplate(title);
    }

    /**
     * @returns localized description of how many lights are on.
     */
    public getDescription() {
        const total = this._lights.length;
        let lit = 0;
        this._lights.forEach(l => {
            if (l.isOn()) {
                lit++;
            }
        });

        if (lit == 0) {
            return localize(this.hass, 'card.description.noLightsOn');
        } else if (lit == total) {
            return localize(this.hass, 'card.description.allLightsOn');
        } else if (lit == 1) {
            return localize(this.hass, 'card.description.oneLightOn');
        } else {
            return localize(this.hass, 'card.description.someLightsAreOn', '%s', lit.toString());
        }
    }

    public getBackground(): Background | null {
        const backgrounds = this._lights.filter(l => l.isOn()).map(l => l.getBackground() || this._defaultColor);
        if (backgrounds.length == 0)
            return null;
        return new Background(backgrounds);
    }

    public getEntityId(): string {
        throw Error('Cannot get entity id from LightController');
    }

    public get features(): ILightFeatures {
        return this._lightsFeatures;
    }
}