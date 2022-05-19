import { HomeAssistant } from "custom-card-helpers";
import { ILightContainer, LightContainer } from "./light-container";
import { TimeCache } from "./time-cache";

export class LightController implements ILightContainer {
    private _hass: HomeAssistant;
    private _lights: LightContainer[];
    private _cache: TimeCache;
    private _lastOnValue: number;

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

    private initTimeCache() {
        this._cache = new TimeCache(1500);// ms
        this._cache.registerProperty("isOn", () => this._lights.some(l => l.isOn()));
        this._cache.registerProperty("isOff", () => this._lights.every(l => l.isOff()));
        this._cache.registerProperty("value", () => this.valueGetFactory());
    }

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
        this._cache.setValue("isOn", true);
        this._cache.setValue("isOff", false);
        if (this._lastOnValue) {
            this._cache.setValue("value", this._lastOnValue);
        }
    }
    turnOff(): void {
        this._lights.filter(l => l.isOn()).forEach(l => l.turnOff());
        this._cache.setValue("isOn", false);
        this._cache.setValue("isOff", true);
        this._cache.setValue("value", 0);
    }

    get value() {
        return this._cache.getValue("value");
        //return this.valueGetFactory();
    }
    set value(value: number) {
        // set value only to lights that are on
        let isOn = false;
        this._lights.filter(l => l.isOn()).forEach(l => { l.value = value; isOn = true; });
        // if no light is on, turn them on now
        if (isOn == false) {
            this._lights.forEach(l => l.value = value);
        }
        // TODO: smart value setting

        if (value > 0) {
            this._lastOnValue = value;
        }
        this._cache.setValue("value", value);
        this._cache.setValue("isOn", value > 0);
        this._cache.setValue("isOff", value == 0);
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
}