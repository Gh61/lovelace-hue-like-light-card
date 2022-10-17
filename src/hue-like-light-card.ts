import { LovelaceCard, HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import { LitElement, css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ClickHandler } from './core/click-handler';
import { Background } from './core/colors/background';
import { LightController } from './core/light-controller';
import { ViewUtils } from './core/view-utils';
import { HueLikeLightCardConfig } from './types/config';
import { Consts } from './types/consts';
import { HueLikeLightCardConfigInterface, WindowWithCards } from './types/types';

/* eslint no-console: 0 */
console.info(
    `%cHUE-%cLIKE%c LIGHT%c CARD %c${Consts.Version}`,
    'font-weight:bold;color:white;background:#0046FF',
    'font-weight:bold;color:white;background:#9E00FF',
    'font-weight:bold;color:white;background:#FF00F3',
    'font-weight:bold;color:white;background:#FF0032',
    'font-weight:bold;color:white;background:#FF8B00'
);

// This puts card into the UI card picker dialog
(window as WindowWithCards).customCards = (window as WindowWithCards).customCards || [];
(window as WindowWithCards).customCards!.push({
    type: Consts.CardElementName,
    name: Consts.CardName,
    description: Consts.CardDescription
});

@customElement(Consts.CardElementName)
export class HueLikeLightCard extends LitElement implements LovelaceCard {
    private _config: HueLikeLightCardConfig;
    private _ctrl: LightController;
    private _clickHandler: ClickHandler;
    private _offBackground: Background;

    @property() hass: HomeAssistant;

    setConfig(plainConfig: HueLikeLightCardConfigInterface | LovelaceCardConfig) {
        this._config = new HueLikeLightCardConfig(plainConfig);

        this._ctrl = new LightController(this._config.getEntities(), this._config.getDefaultColor());
        this._offBackground = new Background([this._config.getOffColor()]);
        this._clickHandler = new ClickHandler(this._config, this._ctrl, this);
    }

    // The height of your card. Home Assistant uses this to automatically
    // distribute all cards over the available columns.
    getCardSize(): number {
        return 3;
    }

    private cardClicked() : void {
        // handle the click
        this._clickHandler.handleClick();

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
        box-shadow:var(--hue-box-shadow), var(--ha-default-shadow);
    }
    ha-card.hue-borders
    {
        border-radius:${Consts.HueBorderRadius}px;
        box-shadow:var(--hue-box-shadow), ${unsafeCSS(Consts.HueShadow)};
    }
    ha-card div.tap-area
    {
        height:48px; /* card(80) - slider(32) */
        cursor: pointer;
    }
    ha-icon
    {
        position:absolute;
        left:22px;
        top:17px;
        transform:scale(2);
        color:var(--hue-text-color);
        transition:all 0.3s ease-out 0s;
    }
    h2
    {
        padding-top:0.5em;
        margin:0px 60px 0px 70px;
        min-height:22px;
        vertical-align:top;
        font-weight:400;
        text-overflow:ellipsis;
        overflow:hidden;
        white-space:nowrap;
        color:var(--hue-text-color);
        transition:all 0.3s ease-out 0s;
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

    private haShadow:string;

    private updateStyles(): void {
        // get defaultShadow (when not using hueBorders)
        if (!this._config.hueBorders && !this.haShadow) {

            // get default haShadow
            const c = document.createElement('ha-card');
            document.body.appendChild(c);
            const s = getComputedStyle(c);
            this.haShadow = s.boxShadow;
            c.remove();

            // set default shadow property
            this.style.setProperty(
                '--ha-default-shadow',
                this.haShadow
            );
        }

        const card = <Element>this.renderRoot.querySelector('ha-card');
        const bfg = ViewUtils.calculateBackAndForeground(this._ctrl, this._offBackground);
        const shadow = ViewUtils.calculateDefaultShadow(card, this._ctrl, this._config);

        this.style.setProperty(
            '--hue-background',
            bfg.background.toString()
        );
        this.style.setProperty(
            '--ha-card-box-shadow',
            shadow
        );
        this.style.setProperty(
            '--hue-box-shadow',
            shadow
        );
        this.style.setProperty(
            '--hue-text-color',
            bfg.foreground
        );
    }

    protected render() {
        this._ctrl.hass = this.hass;

        const title = this._config.title || this._ctrl.getTitle();
        const onChangeCallback = () => {
            this.requestUpdate();
            this.updateStyles();
        };

        return html`<ha-card>
            <div class="tap-area" @click="${(): void => this.cardClicked()}">
                <ha-icon icon="${this._config.icon || this._ctrl.getIcon()}"></ha-icon>
                <h2>${title}</h2>
            </div>
            ${ViewUtils.createSwitch(this._ctrl, onChangeCallback)}

            ${ViewUtils.createSlider(this._ctrl, this._config, onChangeCallback)}
        </ha-card>`;
    }

    //#region updateStyles hooks

    protected firstUpdated() {
        // CSS
        if (this._config.hueBorders) {
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

    //#endregion
}
