import { LovelaceCard, HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import { LitElement, css, html, unsafeCSS, PropertyValues } from 'lit';
import { classMap } from 'lit-html/directives/class-map.js';
import { customElement } from 'lit/decorators.js';
import { HueBrightnessRollup } from './controls/brightness-rollup';
import { ClickHandler } from './core/click-handler';
import { Background } from './core/colors/background';
import { LightController } from './core/light-controller';
import { ViewUtils } from './core/view-utils';
import { HueLikeLightCardConfig } from './types/config';
import { Consts } from './types/consts';
import { nameof } from './types/extensions';
import { ThemeHelper } from './types/theme-helper';
import { WindowWithCards } from './types/types';
import { HueLikeLightCardConfigInterface } from './types/types-config';

/* eslint no-console: 0 */
console.info(
    `%cHUE-%cLIKE%c LIGHT%c CARD %c${Consts.Version}`,
    'font-weight:bold;color:white;background:#0046FF',
    'font-weight:bold;color:white;background:#9E00FF',
    'font-weight:bold;color:white;background:#FF00F3',
    'font-weight:bold;color:white;background:#FF0032',
    'font-weight:bold;color:white;background:#FF8B00'
);
// TODO: Remove after testing
console.log(HueBrightnessRollup.ElementName); // reference to Rollup

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
    private _hass: HomeAssistant;
    private _ctrl: LightController;
    private _clickHandler: ClickHandler;

    /**
     * Off background color.
     * Null for theme color.
     */
    private _offBackground: Background | null;

    public set hass(hass: HomeAssistant) {
        const oldHass = this._hass;

        // first load hass - try load scenes
        if (!this._hass) {
            this._config.tryLoadScenes(hass);
        }

        this._hass = hass; // save hass instance
        this._ctrl.hass = hass; // pass hass instance to Controller

        // custom @property() implementation
        this.requestUpdate(nameof(this, 'hass'), oldHass);
    }
    public get hass() {
        return this._hass;
    }

    public async setConfig(plainConfig: HueLikeLightCardConfigInterface | LovelaceCardConfig) {
        const oldConfig = this._config;
        this._config = new HueLikeLightCardConfig(<HueLikeLightCardConfigInterface>plainConfig);

        this._ctrl = new LightController(this._config.getEntities(), this._config.getDefaultColor());
        this._clickHandler = new ClickHandler(this._config, this._ctrl, this);

        // For theme color set background to null
        const offColor = this._config.getOffColor();
        if (!offColor.isThemeColor()) {
            this._offBackground = new Background([offColor.getBaseColor()]);
        } else {
            this._offBackground = null;
        }

        // custom @property() implementation
        this.requestUpdate('_config', oldConfig);
    }

    // The height of your card. Home Assistant uses this to automatically
    // distribute all cards over the available columns.
    public getCardSize(): number {
        return 3;
    }

    private cardClicked(): void {
        // handle the click
        this._clickHandler.handleClick();

        // update styles
        this.updateStylesInner();
    }

    // #### UI:

    public static override styles = css`
    ha-card
    {
        height:80px;
        background:var(--hue-background);
        position:relative;
        box-shadow:var(--hue-box-shadow), var(--ha-default-shadow);
    }
    ha-card.new-borders
    {
        /* since HA 2022.11 */
        box-shadow:var(--hue-box-shadow);
    }
    ha-card.hue-borders
    {
        border-radius:${Consts.HueBorderRadius}px;
        box-shadow:var(--hue-box-shadow), ${unsafeCSS(Consts.HueShadow)};
        border:none;
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
    h2.no-switch{
        margin-right:10px;
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

    protected override updated(changedProps: PropertyValues): void {
        super.updated(changedProps);
        this.updateStylesInner();

        if (!this._config || !this.hass) {
            return;
        }

        const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
        const oldConfig = changedProps.get('_config') as HueLikeLightCardConfig | undefined;

        if (!oldHass || !oldConfig || oldHass.themes !== this.hass.themes || oldConfig.theme !== this._config.theme) {

            // Try apply theme
            if (ThemeHelper.applyTheme(this, this.hass.themes, this._config.theme)) {
                // Update styles - when theme changes
                this.updateStylesInner(true);
            }
        }
    }

    private haShadow: string | null;

    // Can't be named 'updateStyles', because HA searches for that method and calls it instead of applying theme
    private updateStylesInner(forceRefresh = false): void {
        const card = <Element>this.renderRoot.querySelector('ha-card');

        // get defaultShadow (when not using hueBorders)
        if (!this._config.hueBorders && (this.haShadow == null || forceRefresh)) {

            // get default haShadow
            const c = document.createElement('ha-card');
            document.body.appendChild(c);
            const s = getComputedStyle(c);
            this.haShadow = s.boxShadow;
            c.remove();

            if (this.haShadow == 'none') {
                if (card == null) {
                    // wait for card element
                    this.haShadow = null;
                } else {
                    // since HA 2022.11 default ha-card has no shadow
                    card.classList.add('new-borders');
                }
            }

            // set default shadow property
            this.style.setProperty(
                '--ha-default-shadow',
                this.haShadow
            );
        }

        // Detect theme color if needed
        if (this._offBackground == null) {
            ThemeHelper.detectThemeCardBackground(this, forceRefresh);
        }

        // Theme colors:
        // BG: --card-background-color OR OLD: --paper-card-background-color
        // FG: --primary-text-color (for off: --secondary-text-color)

        const bfg = ViewUtils.calculateBackAndForeground(this._ctrl, this._offBackground);
        const shadow = ViewUtils.calculateDefaultShadow(card, this._ctrl, this._config);

        this.style.setProperty(
            '--hue-background',
            bfg.background?.toString() ?? Consts.ThemeCardBackgroundVar
        );
        this.style.setProperty(
            '--hue-text-color',
            bfg.foreground?.toString() ?? Consts.ThemeSecondaryTextColorVar
        );
        this.style.setProperty(
            '--ha-card-box-shadow',
            shadow
        );
        this.style.setProperty(
            '--hue-box-shadow',
            shadow
        );
    }

    protected override render() {
        const titleTemplate = this._config.getTitle(this._ctrl);
        const title = titleTemplate.resolveToString(this._hass);
        const showSwitch = this._config.showSwitch;
        const h2Class = { 'no-switch': !showSwitch };

        const onChangeCallback = () => {
            this.requestUpdate();
            this.updateStylesInner();
        };

        return html`<ha-card>
            <div class="tap-area" @click="${(): void => this.cardClicked()}">
                <ha-icon icon="${this._config.icon || this._ctrl.getIcon()}"></ha-icon>
                <h2 class="${classMap(h2Class)}">${title}</h2>
            </div>
            ${showSwitch ? ViewUtils.createSwitch(this._ctrl, onChangeCallback) : html``}

            ${ViewUtils.createSlider(this._ctrl, this._config, onChangeCallback)}
        </ha-card>`;
    }

    //#region updateStyles hooks

    protected override firstUpdated(changedProps: PropertyValues) {
        super.firstUpdated(changedProps);

        // CSS
        if (this._config.hueBorders) {
            (this.renderRoot.querySelector('ha-card') as Element).className = 'hue-borders';
        }

        this.updated(changedProps);
    }

    public override connectedCallback(): void {
        super.connectedCallback();
        // CSS
        this.updateStylesInner();
    }

    //#endregion
}
