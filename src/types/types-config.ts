import { HomeAssistant } from 'custom-card-helpers';
import { HassEntity } from 'home-assistant-js-websocket';
import { Color } from '../core/colors/color';
import { ColorResolver } from '../core/colors/color-resolvers';
import { ensureEntityDomain } from './extensions';
import ColorThief from 'colorthief';

export enum KnownIconSize {
    Big = 'big',
    Original = 'original',
    Small = 'small'
}

export enum SliderType {
    Default = 'default',
    None = 'none',
    Mushroom = 'mushroom'
}

export enum ClickAction {
    Default = 'default',
    NoAction = 'none',
    TurnOn = 'turn-on',
    TurnOff = 'turn-off',
    MoreInfo = 'more-info',
    Scene = 'scene',
    HueScreen = 'hue-screen'
}

export enum SceneOrder {
    Default = 'default',
    NameAsc = 'name-asc',
    NameDesc = 'name-desc'
}

export class ClickActionData {
    private readonly _onlyValue: string;
    private readonly _valueStore: Record<string, string>;

    public constructor(plainConfig: string | Record<string, string> | ClickActionData | undefined) {
        if (typeof plainConfig == 'string') {
            this._onlyValue = plainConfig;
        }
        else if (plainConfig instanceof ClickActionData) {
            // eslint-disable-next-line no-underscore-dangle
            this._onlyValue = plainConfig._onlyValue;
            // eslint-disable-next-line no-underscore-dangle
            this._valueStore = plainConfig._valueStore;
        }
        else {
            this._valueStore = plainConfig || {};
        }
    }

    /**
     * Gets data parameter from config.
     */
    public getData(key: string): string {
        if (this._onlyValue)
            return this._onlyValue;

        return this._valueStore[key];
    }
}

export class SceneConfig {
    public constructor(entity: string) {
        ensureEntityDomain(entity, 'scene');

        this.entity = entity;
    }

    public entity: string;
    public title?: string;
    public icon?: string;
    public color?: string;
    // TODO: add posibility to set color gradient

    public activation?: string;
    public activationData?: Record<string, unknown>;

    public getActivationService() {
        const defaultService = 'scene.turn_on';
        const service = this.activation || defaultService;
        const splitted = service.split('.');

        if (splitted.length != 2) {
            throw new Error(`Unrecognized service '${service}'. The service should have 2 parts separated by '.' (dot). E.g.: '${defaultService}'`);
        }

        return splitted;
    }

    public getActivationData(): Record<string, unknown> {
        const result = <Record<string, unknown>>{ entity_id: this.entity };

        if (this.activationData) {
            // insert data from config (it is possible to overwrite entity_id)
            for (const key in this.activationData) {
                if (Object.prototype.hasOwnProperty.call(this.activationData, key)) {
                    result[key] = this.activationData[key];
                }
            }
        }

        return result;
    }
}

export class SceneData {
    private _config: SceneConfig;
    private _hass: HomeAssistant;
    private _entity: HassEntity;
    private _pictureColor?: Color;

    public constructor(configOrEntityId: SceneConfig | string) {
        if (typeof configOrEntityId == 'string') {
            this._config = new SceneConfig(configOrEntityId);
        }
        else {
            this._config = configOrEntityId;
        }
    }

    public set hass(value: HomeAssistant) {
        this._hass = value;
        this._entity = this._hass.states[this._config.entity];
    }

    /**
     * Will activate this scene
     */
    public activate() {
        this.ensureHass();

        const serviceParts = this._config.getActivationService();
        const data = this._config.getActivationData();

        this._hass.callService(serviceParts[0], serviceParts[1], data);
    }

    public getTitle(cardTitle: string): string | undefined {
        this.ensureHass();

        if (this._config.title)
            return this._config.title;

        // try to remove prefix of cardTitle from friendly name
        let friendlyName = this._entity.attributes.friendly_name;
        if (cardTitle && friendlyName?.toLowerCase().indexOf(cardTitle.toLowerCase()) == 0) {
            // remove the cardTitle prefix from this scene name
            friendlyName = friendlyName.substring(cardTitle.length).trimStart();
        }

        return friendlyName;
    }

    /**
     * @returns path to entity_picture of scene entity, if set in HA.
     */
    public getPicture(): string | undefined {
        this.ensureHass();

        return this._entity.attributes.entity_picture;
    }

    /**
     * @returns icon from config or from entity settings or passed defaultIcon.
     */
    public getIcon(defaultIcon: string | null = null): string | null {
        this.ensureHass();

        // if config has empty icon defined - return empty
        if (this._config.icon != undefined)
            return this._config.icon;

        return this._entity.attributes.icon || defaultIcon;
    }

    /**
     * @returns color from config, or from picture, or undefined.
     */
    public getAccentColor(): Promise<Color | undefined> {
        this.ensureHass();

        return new Promise((resolve) => {

            if (this._config.color) {
                return resolve(ColorResolver.getColor(this._config.color));
            }

            if (this._pictureColor) {
                return resolve(this._pictureColor);
            }

            const picture = this.getPicture();
            if (picture) {
                const img = new Image();
                img.crossOrigin = '';
                img.src = picture;
                img.onload = () => {
                    const ct = new ColorThief();
                    const mainColor = ct.getColor(img);
                    this._pictureColor = new Color(mainColor[0], mainColor[1], mainColor[2]);

                    resolve(this._pictureColor);
                };
            }
            else {
                return resolve(undefined);
            }
        });
    }

    /**
     * @returns brightness value [0-100] of scene, if present in entity data.
     */
    public getBrightnessValue(): number | null {
        this.ensureHass();

        const result = this._entity.attributes.brightness;
        if (typeof result === 'number') {
            return result;
        }
        return null;
    }

    private ensureHass() {
        if (!this._hass)
            throw new Error('Scene data not initialized - call setHass first!');
    }
}

export interface HueLikeLightCardConfigInterface extends HueLikeLightCardEntityConfigInterface {
    readonly entities?: string[] | HueLikeLightCardEntityConfigInterface[];
    readonly floor?: string;
    readonly area?: string;
    readonly label?: string;
    readonly groupEntity?: string;
    readonly description?: string;
    readonly iconSize?: string | number;
    readonly showSwitch?: boolean;
    readonly switchOnScene?: string;
    readonly slider?: string | SliderType;
    readonly scenes?: (string | SceneConfig)[];
    readonly sceneOrder?: SceneOrder;
    readonly offClickAction?: ClickAction;
    readonly offClickData?: string | Record<string, string> | ClickActionData;
    readonly onClickAction?: ClickAction;
    readonly onClickData?: string | Record<string, string> | ClickActionData;
    readonly offHoldAction?: ClickAction;
    readonly offHoldData?: string | Record<string, string> | ClickActionData;
    readonly onHoldAction?: ClickAction;
    readonly onHoldData?: string | Record<string, string> | ClickActionData;
    readonly allowZero?: boolean;
    readonly theme?: string;
    readonly defaultColor?: string;
    readonly offColor?: string;
    readonly hueScreenBgColor?: string;
    readonly offShadow?: boolean;
    readonly hueBorders?: boolean;
    readonly apiId?: string;
    readonly isVisible?: boolean;
    readonly enable_preset?: boolean;

    /** Support for card-mod styling */
    readonly style?: unknown;
    readonly card_mod?: unknown;
}

export interface HueLikeLightCardEntityConfigInterface {
    readonly entity?: string;
    readonly title?: string;
    readonly icon?: string;
}
