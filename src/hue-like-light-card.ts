import { LovelaceCard, HomeAssistant } from 'custom-card-helpers';
import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LightController } from './core/light-controller';
import { HueLikeLightCardConfig } from './types/types';

@customElement('hue-like-light-card')
export class HueLikeLightCard extends LitElement implements LovelaceCard {
    private _config: HueLikeLightCardConfig;
    private _ctrl: LightController;

    @property() hass: HomeAssistant;

    setConfig(config: HueLikeLightCardConfig) {
        this._config = config;

        // set rounded borders
        if (this._config.roundedBorders != null) {
            this.classes['hue-borders'] = !!this._config.roundedBorders;
        }

        // create list of entities (prepend entity and then insert all entities)
        const ents: string[] = [];
        config.entity && ents.push(config.entity);
        config.entities && config.entities.forEach(e => ents.push(e));

        this._ctrl = new LightController(ents);
    }

    // The height of your card. Home Assistant uses this to automatically
    // distribute all cards over the available columns.
    getCardSize(): number {
        return 3;
    }

    private changed(isSlider: boolean) {
        if (isSlider) {
            const value = (this.shadowRoot?.querySelector("ha-slider") as HTMLInputElement).value;
            if (value != null) {
                this._ctrl.value = parseInt(value);
            }
        }
        else { // isToggle
            const checked = (this.shadowRoot?.querySelector("ha-switch") as HTMLInputElement).checked;
            if (checked) {
                this._ctrl.turnOn();
            } else {
                this._ctrl.turnOff();
            }
        }

        // update styles
        this.updateShadowStyles();
    }

    // #### UI:

    static styles = css`
    ha-card
    {
        color:white;
        height:80px;
        background:var(--off-color);
        position: relative;
    }
    ha-card.hue-borders
    {
        border-radius: 10px;
    }
    ha-icon
    {
        position: absolute;
        left: 22px;
        top: 17px;
        transform: scale(2);
    }
    h2
    {
        padding-top: 0.5em;
        margin: 0px 0px 0 80px;
        font-weight: 500;
    }
    ha-switch
    {
        position: absolute;
        right: 14px;
        top: 22px;
    }
    ha-slider
    {
        position: absolute;
        bottom: 0;
        width: 100%;
    }
    `;

    @property() classes = { 'hue-borders': true };
    @property() shadowStyles = { 'box-shadow': 'none' };

    private calculateCurrentShadow(): string {
        if (this._ctrl.isOff())
            return 'inset 0px 0px 10px rgba(0,0,0,0.2)';//'none';

        const card = <Element>this.renderRoot.querySelector('ha-card');
        const darkness = 100 - this._ctrl.value;
        const coef = (card.clientHeight / 100);
        const spread = 20;
        const position = spread + (darkness * 0.95) * coef;
        let width = card.clientHeight / 2;
        if (darkness > 70) {
            width -= (width - 20) * (darkness - 70) / 30; // width: 20-clientHeight/2
        }

        return `inset 0px -${position}px ${width}px -${spread}px rgba(0,0,0,0.75)`;
    }

    private getCurrentBackground(): string | boolean {
        if (this._ctrl.isOff())
            return false;

        return this._ctrl.getBackground();
    }

    private updateShadowStyles(): void {
        this.shadowStyles['background'] = this.getCurrentBackground();
        this.shadowStyles['box-shadow'] = this.calculateCurrentShadow();
    }

    protected render() {
        this._ctrl.hass = this.hass;

        const min = 0;
        const max = 100;
        const step = 1;

        return html`<ha-card class=${classMap(this.classes)} style=${styleMap(this.shadowStyles)}>
            <ha-icon icon="${this._config.icon || this._ctrl.getIcon()}"></ha-icon>
            <h2>${this._config.title}</h2>
            <ha-switch .checked=${this._ctrl.isOn()} .disabled=${this._ctrl.isUnavailable()} .haptic=true @change=${() => this.changed(false)}></ha-switch>

            <ha-slider .min=${min} .max=${max} .step=${step} .value=${this._ctrl.value}
            pin @change=${() => this.changed(true)}
            ignore-bar-touch
            ></ha-slider>
        </ha-card>`;
    }

    protected firstUpdated() {
        this.updated();
    }

    protected updated() {
        this.updateShadowStyles();
    }

    connectedCallback(): void {
        super.connectedCallback();
        this.style.setProperty(
            '--off-color',
            this._config.offColor || '#444'
        );
    }
}
