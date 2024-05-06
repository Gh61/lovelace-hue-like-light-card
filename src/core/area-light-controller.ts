import { HomeAssistant } from 'custom-card-helpers';
import { IHassTextTemplate, ILightContainer, ILightFeatures, INotifyGeneric, ISingleLightContainer } from '../types/types-interface';
import { Background } from './colors/background';
import { Color } from './colors/color';
import { GlobalLights } from './global-lights';
import { HassTextTemplate, StaticTextTemplate } from './hass-text-template';
import { LightController } from './light-controller';
import { LightFeaturesCombined } from './light-features';
import { IconHelper } from './icon-helper';
import { localize } from '../localize/localize';
import { SceneData } from '../types/types-config';
import { Action2 } from '../types/functions';

/**
 * Serves as a controller for lights in single area.
 * This can contain multiple lights even some interactions can be different.
 * (Instead of turnOn, activate scene).
 */
export class AreaLightController implements ILightContainer, INotifyGeneric<LightController> {
    private _hass: HomeAssistant;
    private _lightGroup?: LightController;
    private _lights: LightController[];
    private _lightsFeatures: LightFeaturesCombined;
    private _defaultColor: Color;

    public constructor(entity_ids: string[], defaultColor: Color, lightGroupEntityId?: string) {
        // we need at least one
        if (!entity_ids.length)
            throw new Error('No entity specified.');

        this._defaultColor = defaultColor;
        this._lights = entity_ids.map(e => GlobalLights.getLightContainer(e));
        this._lightsFeatures = new LightFeaturesCombined(() => this._lights.map(l => l.features));
        if (lightGroupEntityId) {
            this._lightGroup = GlobalLights.getLightContainer(lightGroupEntityId);
        }
    }

    /**
     * @returns the default color (used when no light has color info).
     */
    public get defaultColor() {
        return this._defaultColor;
    }

    /**
     * @returns count of registered lights.
     */
    public get count() {
        return this._lights.length;
    }

    /**
     * @returns all lit lights.
     */
    public getLitLights(): ISingleLightContainer[] {
        return this._lights.filter(l => l.isOn());
    }

    /**
     * @returns all lights in this controller.
     */
    public getLights(): ISingleLightContainer[] {
        return this._lights.map(l => l); // map will cause creation of new array
    }

    /**
     * Will register for light changed events.
     */
    public registerOnPropertyChanged(id: string, callback: Action2<(keyof LightController)[], LightController>, includeHass = false): void {
        this._lights.forEach(l => l.registerOnPropertyChanged(id, callback, includeHass));
    }

    /**
     * Will unregister light changed events.
     */
    public unregisterOnPropertyChanged(id: string): void {
        this._lights.forEach(l => l.unregisterOnPropertyChanged(id));
    }

    public set hass(hass: HomeAssistant) {
        this._hass = hass;
        this._lights.forEach(l => l.hass = hass);
        if (this._lightGroup) {
            this._lightGroup.hass = hass;
        }
    }
    public get hass() {
        return this._hass;
    }

    public isOn(): boolean {
        if (this._lightGroup) {
            return this._lightGroup.isOn();
        }
        return this._lights.some(l => l.isOn());
    }
    public isOff(): boolean {
        if (this._lightGroup) {
            return this._lightGroup.isOff();
        }
        return this._lights.every(l => l.isOff());
    }
    public isUnavailable(): boolean {
        if (this._lightGroup) {
            return this._lightGroup.isUnavailable();
        }
        return this._lights.every(l => l.isUnavailable());
    }
    public turnOn(scene?: string): void {
        if (this._lightGroup) {
            return this._lightGroup.turnOn(scene);
        }

        // if scene is passed, activate it once and pass data to all lights
        let sceneData: SceneData;
        if (scene) {
            sceneData = new SceneData(scene);
            sceneData.hass = this._hass;
            sceneData.activate();
        }

        this._lights.filter(l => l.isOff()).forEach(l => l.turnOn(sceneData));
    }
    public turnOff(): void {
        if (this._lightGroup) {
            return this._lightGroup.turnOff();
        }
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
        }
        else if (litLights.length == 0) { // when no light is on, set value to all lights
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
        if (this._lightGroup) {
            return this._lightGroup.getTitle();
        }

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
    public getDescription(description: string | undefined): IHassTextTemplate {
        const total = this._lights.length;
        let lit = 0;
        this._lights.forEach(l => {
            if (l.isOn()) {
                lit++;
            }
        });

        let result: string;

        if (description != null) {
            if (description) {
                result = description.replace('%s', lit.toString());
                return new HassTextTemplate(result);
            }
            result = '';
        }
        else if (lit == 0) {
            result = localize(this.hass, 'card.description.noLightsOn');
        }
        else if (lit == total) {
            result = localize(this.hass, 'card.description.allLightsOn');
        }
        else if (lit == 1) {
            result = localize(this.hass, 'card.description.oneLightOn');
        }
        else {
            result = localize(this.hass, 'card.description.someLightsAreOn', '%s', lit.toString());
        }

        return new StaticTextTemplate(result);
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