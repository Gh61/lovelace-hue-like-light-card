import { HomeAssistant } from "custom-card-helpers";
import { ILightContainer, LightContainer } from "./light-container";

export class LightController implements ILightContainer {
    private _hass: HomeAssistant;
    private _lights: LightContainer[];

    constructor(entity_ids: string[]) {
        // we need at least one
        if (!entity_ids.length)
            throw new Error(`No entity specified (use 'entity' and/or 'entities').`);

        this._lights = entity_ids.map(e => new LightContainer(e));
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
        var total = 0;
        var count = 0;
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
        var lightIcon = this._lights.length > 2
            ? "mdi:lightbulb-group" // 3 lightbulbs
            : this._lights.length > 1
                ? "mdi:lightbulb-multiple" // 2 lightbulbs
                : this._lights[0].getIcon() || "mdi:lightbulb"; // 1 lightbulb)

        return lightIcon;
    }

    getTitle() {
        var title = '';
        for (let i = 0; i < this._lights.length && i < 3; i++) {
            if (i > 0) {
                title += ", ";
            }
            title += this._lights[i].getTitle();
        }
        if (this._lights.length > 3)
            title += ", ...";

        return title;
    }

    getBackground(): string {
        var litLights = this._lights.filter(l => l.isOn());
        if (litLights.length == 0)
            return '';
        if (litLights.length == 1)
            return litLights[0].getBackground();

        var step = 100.0 / (litLights.length - 1);

        const offset = 10;
        var colors = `${litLights[0].getBackground()} 0%, ${litLights[0].getBackground()} ${offset}%`; // first 10% must be the first light
        var currentStep = 0;
        for (let i = 1; i < litLights.length; i++) {
            currentStep += step;

            // last 10% must be the last light
            if (i + 1 == litLights.length) {
                colors += `, ${litLights[i].getBackground()} ${100 - offset}%`;
            }
            colors += `, ${litLights[i].getBackground()} ${Math.round(currentStep)}%`;
        }

        return `linear-gradient(90deg, ${colors})`;
    }
}