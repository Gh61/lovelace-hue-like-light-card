import { LovelaceCard, HomeAssistant } from 'custom-card-helpers';
import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Background } from './core/colors/background';
import { Color } from './core/colors/color';
import { ColorResolver } from './core/colors/color-resolvers';
import { LightController } from './core/light-controller';
import { Consts } from './types/consts';
import { HueLikeLightCardConfig } from './types/types';

@customElement('hue-like-light-card')
export class HueLikeLightCard extends LitElement implements LovelaceCard {
    private _config: HueLikeLightCardConfig;
    private _ctrl: LightController;
    private _offBackground: Background;

    @property() hass: HomeAssistant;

    setConfig(config: HueLikeLightCardConfig) {
        this._config = config;

        // create list of entities (prepend entity and then insert all entities)
        const ents: string[] = [];
        config.entity && ents.push(config.entity);
        config.entities && config.entities.forEach(e => ents.push(e));

        this._ctrl = new LightController(ents, ColorResolver.getColor(config.defaultColor || Consts.DefaultColor));

        this._offBackground = new Background([new Color(this._config.offColor || Consts.OffColor)]);
    }

    // The height of your card. Home Assistant uses this to automatically
    // distribute all cards over the available columns.
    getCardSize(): number {
        return 3;
    }

    private changed(isSlider: boolean) {
        // TODO: try to update on sliding (use debounce) not only on change. (https://www.webcomponents.org/element/@polymer/paper-slider/elements/paper-slider#events)
        // TODO: make title clickable
        // TODO: add subtext

        if (isSlider) {
            const value = (this.shadowRoot?.querySelector('ha-slider') as HTMLInputElement).value;
            if (value != null) {
                this._ctrl.value = parseInt(value);
            }
        } else { // isToggle
            const checked = (this.shadowRoot?.querySelector('ha-switch') as HTMLInputElement).checked;
            if (checked) {
                this._ctrl.turnOn();
            } else {
                this._ctrl.turnOff();
            }
        }

        // update styles
        this.updateStyles();
    }

    // #### UI:

    static styles = css`
    ha-card
    {
        height:80px;
        background:var(--hue-background);
        position:relative;
        box-shadow:var(--hue-box-shadow),
            var( --ha-card-box-shadow, 0px 2px 1px -1px rgba(0, 0, 0, 0.2), 0px 1px 1px 0px rgba(0, 0, 0, 0.14), 0px 1px 3px 0px rgba(0, 0, 0, 0.12) /* default_ha_shadows */
        );
    }
    ha-card.hue-borders
    {
        border-radius:10px;
        box-shadow:var(--hue-box-shadow), 0px 2px 3px rgba(0,0,0,0.85);
    }
    ha-icon
    {
        position:absolute;
        left:22px;
        top:17px;
        transform:scale(2);
        color:var(--hue-text-color);
    }
    h2
    {
        padding-top:0.5em;
        margin:0px 60px 0px 70px;
        font-weight:400;
        text-overflow:ellipsis;
        overflow:hidden;
        white-space:nowrap;
        color:var(--hue-text-color);
    }
    ha-switch
    {
        position:absolute;
        right:14px;
        top:22px;
    }
    ha-slider
    {
        position:absolute;
        bottom:0;
        width:100%;
    }
    `;

    private calculateCurrentShadow(): string {
        if (this._ctrl.isOff())
            return 'inset 0px 0px 10px rgba(0,0,0,0.2)';//'none';

        const card = <Element>this.renderRoot.querySelector('ha-card');
        if (!card)
            return '';
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

    private getCurrentBackground(): Background {
        if (this._ctrl.isOff())
            return this._offBackground;

        return this._ctrl.getBackground() || this._offBackground;
    }

    private updateStyles(): void {
        const background = this.getCurrentBackground() || this._offBackground;
        const foreground = this._ctrl.isOn() && this._ctrl.value <= 50 
            ? Consts.LightColor // is on and under 50 => Light
            : background.getForeground(
                Consts.LightColor, // should be light
                this._ctrl.isOn() // should be dark
                    ? Consts.DarkColor
                    : Consts.DarkOffColor // make it little lighter, when isOff
            );

        this.style.setProperty(
            '--hue-background',
            background.toString()
        );
        this.style.setProperty(
            '--hue-box-shadow',
            this.calculateCurrentShadow()
        );
        this.style.setProperty(
            '--hue-text-color',
            foreground
        );
    }

    protected render() {
        this._ctrl.hass = this.hass;

        const min = this._config.allowZero ? 0 : 1;
        const max = 100;
        const step = 1;

        const title = this._config.title || this._ctrl.getTitle();

        return html`<ha-card>
            <ha-icon icon="${this._config.icon || this._ctrl.getIcon()}"></ha-icon>
            <h2>${title}</h2>
            <ha-switch .checked=${this._ctrl.isOn()} .disabled=${this._ctrl.isUnavailable()} .haptic=true @change=${() => this.changed(false)}></ha-switch>

            <ha-slider .min=${min} .max=${max} .step=${step} .disabled=${this._config.allowZero ? false : this._ctrl.isOff()} .value=${this._ctrl.value}
            pin @change=${() => this.changed(true)}
            ignore-bar-touch
            ></ha-slider>
        </ha-card>`;
    }

    protected firstUpdated() {
        // CSS
        if (this._config.hueBorders == null || !!this._config.hueBorders) {
            (this.renderRoot.querySelector('ha-card') as Element).className = 'hue-borders';
        }

        this.updated();
    }

    protected updated() {
        this.updateStyles();
    }

    connectedCallback(): void {
        super.connectedCallback();
        // CSS
        this.updateStyles();
    }
}
