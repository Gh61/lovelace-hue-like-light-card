import { LovelaceCard, HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import { LitElement, css, html, nothing, unsafeCSS, PropertyValues } from 'lit';
import { classMap } from 'lit-html/directives/class-map.js';
import { customElement } from 'lit/decorators.js';
import { ClickHandler } from './core/click-handler';
import { Background } from './core/colors/background';
import { LightController } from './core/light-controller';
import { ViewUtils } from './core/view-utils';
import { HueLikeLightCardConfig } from './types/config';
import { Consts } from './types/consts';
import { nameof } from './types/extensions';
import { ThemeHelper } from './types/theme-helper';
import { IHassWindow } from './types/types-hass';
import { HueLikeLightCardConfigInterface, KnownIconSize } from './types/types-config';
import { ErrorInfo } from './core/error-info';
import { Action } from './types/functions';

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
(window as IHassWindow).customCards = (window as IHassWindow).customCards || [];
(window as IHassWindow).customCards!.push({
    type: Consts.CardElementName,
    name: Consts.CardName,
    description: Consts.CardDescription
});

@customElement(Consts.CardElementName)
export class HueLikeLightCard extends LitElement implements LovelaceCard {
    private _config: HueLikeLightCardConfig | undefined;
    private _hass: HomeAssistant | undefined;
    private _ctrl: LightController | undefined;
    private _clickHandler: ClickHandler | undefined;
    private _error: ErrorInfo | undefined;

    /**
     * Off background color.
     * Null for theme color.
     */
    private _offBackground: Background | null;

    public set hass(hass: HomeAssistant | undefined) {
        if (!hass)
            return;

        const oldHass = this._hass;
        this._hass = hass; // save hass instance

        // set hass instance where needed
        this.trySetHassWhereNeeded();

        // custom @property() implementation
        this.requestUpdate(nameof(this, 'hass'), oldHass);
    }
    public get hass() {
        return this._hass;
    }

    private catchErrors(action: Action) {
        try {
            this._error = undefined;

            action();
        } catch (e) {
            this._error = new ErrorInfo(e);
            this.requestUpdate(); // render error

            // rethrow
            throw e;
        }
    }

    public setConfig(plainConfig: HueLikeLightCardConfigInterface | LovelaceCardConfig) {
        this.catchErrors(() => {
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

            this._error = undefined;

            // try set hass
            this.trySetHassWhereNeeded();

            // custom @property() implementation
            this.requestUpdate('_config', oldConfig);
        });
    }

    /** Will try to set Hass to lightController (will not fail if no lightController exists) */
    private trySetHassWhereNeeded() {
        if (!this.hass)
            return;

        const hass = this.hass;
        this.catchErrors(() => {

            // try load scenes
            if (this._config && !this._config.scenesLoaded) {
                this._config.tryLoadScenes(hass);
            }

            // pass hass instance to Controller
            if (this._ctrl) {
                this._ctrl.hass = hass;
            }
        });
    }

    // The height of your card. Home Assistant uses this to automatically
    // distribute all cards over the available columns.
    public getCardSize(): number {
        return 3;
    }

    private cardClicked(): void {
        // handle the click
        if (this._clickHandler) {
            this._clickHandler.handleClick();
        }

        // update styles
        this.updateStylesInner();
    }

    // #### UI:

    public static override styles = css`
    ha-card
    {
        min-height:80px;
        background:var(--hue-background);
        position:relative;
        box-shadow:var(--hue-box-shadow), var(--ha-default-shadow);
        background-origin: border-box;
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
        height:46px; /* card(80) - slider(32) - border(2) */
        cursor: pointer;
    }
    ha-icon
    {
        position:absolute;
        left:22px;
        top:17px;
        transform:scale(var(--hue-icon-size, ${Consts.IconSize[KnownIconSize.Original]}));
        color:var(--hue-text-color);
        transition:${unsafeCSS(Consts.TransitionDefault)};
    }
    .text-area{
        padding-top:0.5em;
        margin:0px 60px 0px 70px;
        vertical-align:top;
        color:var(--hue-text-color);
        transition:${unsafeCSS(Consts.TransitionDefault)};
    }
    .text-area.no-switch{
        margin-right:10px;
    }
    .text-area h2
    {
        font-weight:400;
        min-height:22px;
        text-overflow:ellipsis;
        overflow:hidden;
        white-space:nowrap;
        margin:0;
        margin-top:4px;
    }
    .text-area .desc
    {
        font-size:13px;
        margin-top:-2px;
    }
    ha-switch
    {
        position:absolute;
        right:14px;
        top:22px;
    }
    .brightness-slider
    {
        width:100%;
    }
    ha-alert{
        display:flex;
        overflow:auto;
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

    private _haShadow: string | null;
    private _switchColorDetected = false;

    // Can't be named 'updateStyles', because HA searches for that method and calls it instead of applying theme
    private updateStylesInner(forceRefresh = false): void {
        // no config or controller, do nothing
        if (!this._config || !this._ctrl)
            return;

        if (!this._switchColorDetected) {
            // Detect switch colors
            if (this._config.showSwitch) {
                ThemeHelper.detectSwitchColors(this);
            }
            this._switchColorDetected = true;
        }

        const card = <HTMLElement>this.renderRoot.querySelector('ha-card');

        // get defaultShadow (when not using hueBorders)
        if (!this._config.hueBorders && (this._haShadow == null || forceRefresh)) {

            // get default haShadow
            const c = document.createElement('ha-card');
            document.body.appendChild(c);
            const s = getComputedStyle(c);
            this._haShadow = s.boxShadow;
            c.remove();

            if (this._haShadow == 'none') {
                if (card == null) {
                    // wait for card element
                    this._haShadow = null;
                } else {
                    // since HA 2022.11 default ha-card has no shadow
                    card.classList.add('new-borders');
                }
            }

            // set default shadow property
            this.style.setProperty(
                '--ha-default-shadow',
                this._haShadow
            );
        }

        // Set icon size
        this.style.setProperty(
            '--hue-icon-size',
            this._config.iconSize.toString()
        );

        // Detect theme color if needed
        if (this._offBackground == null) {
            ThemeHelper.detectThemeCardBackground(this, forceRefresh);
        }

        // Theme colors:
        // BG: --card-background-color OR OLD: --paper-card-background-color
        // FG: --primary-text-color (for off: --secondary-text-color)

        const bfg = ViewUtils.calculateBackAndForeground(this._ctrl, this._offBackground);
        const shadow = ViewUtils.calculateDefaultShadow(card, this._ctrl, this._config.offShadow);

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
        if (this._error) {
            return html`<ha-alert alert-type="error" .title=${this._error.message}>
                ${this._error.stack ? html`<pre>${this._error.stack}</pre>` : nothing}
            </ha-alert>`;
        }

        // no config, ctrl or hass
        if (!this._config || !this._ctrl || !this._hass)
            return nothing;

        const titleTemplate = this._config.getTitle(this._ctrl);
        const title = titleTemplate.resolveToString(this._hass);
        const showSwitch = this._config.showSwitch;
        const textClass = { 'text-area':true, 'no-switch': !showSwitch };
        const cardClass = {
            'state-on': this._ctrl.isOn(),
            'state-off': this._ctrl.isOff(),
            'state-unavailable': this._ctrl.isUnavailable(),
            'hue-borders': this._config.hueBorders
        };

        const onChangeCallback = () => {
            this.requestUpdate();
            this.updateStylesInner();
        };

        return html`<ha-card class="${classMap(cardClass)}">
            <div class="tap-area" @click="${(): void => this.cardClicked()}">
                <ha-icon icon="${this._config.icon || this._ctrl.getIcon()}"></ha-icon>
                <div class="${classMap(textClass)}">
                    <h2>${title}</h2>
                    <div class="desc">Whatever is just lit.</div>
                </div>
            </div>
            ${showSwitch ? ViewUtils.createSwitch(this._ctrl, onChangeCallback) : nothing}

            ${ViewUtils.createSlider(this._ctrl, this._config, onChangeCallback)}
        </ha-card>`;
    }

    //#region updateStyles hooks

    public override connectedCallback(): void {
        super.connectedCallback();
        // CSS
        this.updateStylesInner();
    }

    //#endregion
}
