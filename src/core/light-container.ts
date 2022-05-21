import { HomeAssistant } from "custom-card-helpers";
import { HassEntity } from "home-assistant-js-websocket";

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
        const domain = entity_id.split(".")[0];
        if (domain != "light")
            throw new Error(`Unsupported entity type: ${domain}. The only supported type is 'light'.`)

        this._entity_id = entity_id;
    }

    set hass(value: HomeAssistant) {
        this._hass = value;
        this._entity = this._hass.states[this._entity_id];
    }

    isUnavailable(): boolean {
        return !this._entity || this._entity.state === "unavailable";
    }
    isOn(): boolean {
        return !this.isUnavailable() && this._entity.state == "on";
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
        this._hass.callService("light", on ? "turn_on" : "turn_off", { entity_id: this._entity_id });
    }

    get value() {
        if (this.isOff())
            return 0;

        const attr = this._entity.attributes;
        return Math.round((attr.brightness * 100.0) / 255); // brightness is 0-255
    }
    set value(value: number) {
        value = Math.round((value / 100.0) * 255); // brightness is 0-255
        this._hass.callService("light", "turn_on", {
            entity_id: this._entity_id,
            ["brightness"]: value,
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

        if (!rgb)
            return '#ffda95'; // +-warm light

        return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    }
}

