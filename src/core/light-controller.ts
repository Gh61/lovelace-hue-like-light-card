import { HomeAssistant } from "custom-card-helpers";
import { ILightContainer, LightContainer } from "./light-container";
import { TimeCache } from "./time-cache";

export class LightController implements ILightContainer {
    private _hass: HomeAssistant;
    private _lights: LightContainer[];

    constructor(entity_ids: string[]) {
        // we need at least one
        if (!entity_ids.length)
            throw new Error(`No entity specified (use 'entity' and/or 'entities').`);

        this._lights = entity_ids.map(e => new LightContainer(e));

        this.initTimeCache();
    }

    set hass(hass: HomeAssistant) {
        this._hass = hass;
        this._lights.forEach(l => l.hass = hass);
    }

    //#region TimeCache

    /*
     * This TimeCache is here, so the UI control can react instantly on changes.
     * When user do some change, it might take up to about 2 seconds for HA to register these changes on devices.
     * So the cache is here to tell the UI that the expected change has happened instantly.
     * After the specified interval, cached values are invalidated and in the moment of getting these values, live values are read from HA.
     */

    // TODO: make the cache somehow public,
    // maybe implement in LightContainer and make LightContainer instances system-wide, so all cards can react to changes instantly
    // TODO: also implement some change notify mechanizm

    private _cache: TimeCache;
    private _lastOnValue: number;

    private initTimeCache(): void {
        this._cache = new TimeCache(1500);// ms
        this._cache.registerProperty("isOn", () => this._lights.some(l => l.isOn()));
        this._cache.registerProperty("isOff", () => this._lights.every(l => l.isOff()));
        this._cache.registerProperty("value", () => this.valueGetFactory());
    }

    private notifyTurnOn(): void {
        this._cache.setValue("isOn", true);
        this._cache.setValue("isOff", false);
        if (this._lastOnValue) {
            this._cache.setValue("value", this._lastOnValue);
        }
    }

    private notifyTurnOff(): void {
        this._cache.setValue("isOn", false);
        this._cache.setValue("isOff", true);
        this._cache.setValue("value", 0);
    }

    private notifyValueChanged(value: number): void {
        if (value > 0) {
            this._lastOnValue = value;
        }
        this._cache.setValue("value", value);
        this._cache.setValue("isOn", value > 0);
        this._cache.setValue("isOff", value == 0);
    }

    //#endregion

    isOn(): boolean {
        return this._cache.getValue("isOn");
        //return this._lights.some(l => l.isOn());
    }
    isOff(): boolean {
        return this._cache.getValue("isOff");
        //return this._lights.every(l => l.isOff());
    }
    isUnavailable(): boolean {
        return this._lights.every(l => l.isUnavailable());
    }
    turnOn(): void {
        this._lights.filter(l => l.isOff()).forEach(l => l.turnOn());
        this.notifyTurnOn();
    }
    turnOff(): void {
        this._lights.filter(l => l.isOn()).forEach(l => l.turnOff());
        this.notifyTurnOff();
    }

    get value() {
        return this._cache.getValue("value");
        //return this.valueGetFactory();
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

        this.notifyValueChanged(value);
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

        this._lastOnValue = total / count * 1.0;
        return this._lastOnValue;
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