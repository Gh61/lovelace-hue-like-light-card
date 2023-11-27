import { LovelaceCard, HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
import { LitElement, css, html, nothing, unsafeCSS, PropertyValues } from 'lit';
import { classMap } from 'lit-html/directives/class-map.js';
import { customElement } from 'lit/decorators.js';
import { ActionHandler } from './core/action-handler';
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
import { Action, AsyncAction } from './types/functions';
import { VersionNotifier } from './version-notifier';
import { Manager, Press, Tap } from '@egjs/hammerjs';

// Show version info in console
VersionNotifier.toConsole();

// This puts card into the UI card picker dialog
(window as IHassWindow).customCards = (window as IHassWindow).customCards || [];
(window as IHassWindow).customCards!.push({
    type: Consts.CardElementName,
    name: Consts.CardName,
    description: Consts.CardDescription
});

@customElement(Consts.CardElementName)
export class HueLikeLightCard extends LitElement implements LovelaceCard {
    private _config?: HueLikeLightCardConfig;
    private _hass?: HomeAssistant;
    private _ctrl?: LightController;
    private _actionHandler?: ActionHandler;
    private _error?: ErrorInfo;
    private _mc?: HammerManager;

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

    private catchErrors(action: Action | AsyncAction) {
        const catchRoutine = (e: unknown) => {
            this._error = new ErrorInfo(e);
            this.requestUpdate(); // render error

            // rethrow
            throw e;
        };

        try {
            this._error = undefined;

            if (action.constructor.name === 'AsyncFunction') {
                (action as AsyncAction)().catch(catchRoutine);
            }
            else {
                action();
            }
        }
        catch (e) {
            catchRoutine(e);
        }
    }

    public setConfig(plainConfig: HueLikeLightCardConfigInterface | LovelaceCardConfig) {
        this.catchErrors(() => {
            const oldConfig = this._config;
            this._config = new HueLikeLightCardConfig(<HueLikeLightCardConfigInterface>plainConfig);

            if (this._config.isInitialized) {
                this.useInitializedConfig(oldConfig);
            }
            else {
                this._oldConfig = oldConfig;
                this._configInitPending = true;
                // try to call init immediately (if hass is present)
                this.tryInitializeConfig(this.hass);
            }
        });
    }

    private _oldConfig?: HueLikeLightCardConfig;
    private _configInitPending = false;

    private tryInitializeConfig(hass: HomeAssistant | undefined) {
        if (!hass || !this._configInitPending)
            return;

        const oldConfig = this._oldConfig;

        // no longer pending
        this._configInitPending = false;
        this._oldConfig = undefined;

        this.catchErrors(async () => {
            // try to init the config
            await this._config!.init(hass);

            // if it ended up well, use the initialized config
            this.useInitializedConfig(oldConfig);
        });
    }

    private useInitializedConfig(oldConfig: HueLikeLightCardConfig | undefined) {
        if (this._config?.isInitialized != true)
            throw new Error('Config is not initialized.');

        this._ctrl = new LightController(this._config.getEntities(), this._config.getDefaultColor(), this._config.groupEntity);
        this._actionHandler = new ActionHandler(this._config, this._ctrl, this);

        // For theme color set background to null
        const offColor = this._config.getOffColor();
        if (!offColor.isThemeColor()) {
            this._offBackground = new Background([offColor.getBaseColor()]);
        }
        else {
            this._offBackground = null;
        }

        this._error = undefined;

        // try set hass
        this.trySetHassWhereNeeded();

        // custom @property() implementation
        this.requestUpdate('_config', oldConfig);
    }

    /** Will try to set Hass to lightController (will not fail if no lightController exists) */
    private trySetHassWhereNeeded() {
        if (!this.hass)
            return;

        // try to init config, if needed
        this.tryInitializeConfig(this.hass);

        // pass hass instance to Controller
        if (this._ctrl) {
            this._ctrl.hass = this.hass;
        }
    }

    // The height of your card. Home Assistant uses this to automatically
    // distribute all cards over the available columns.
    public getCardSize(): number {
        return 3;
    }

    private cardClicked(): void {
        // handle the click
        if (this._actionHandler) {
            this._actionHandler.handleCardClick();
        }

        // update styles
        this.updateStylesInner();
    }

    private cardHolded(): void {
        // handle the hold
        if (this._actionHandler) {
            this._actionHandler.handleCardHold();
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
        display: flex;
        flex-direction: column;
        justify-content: center;
        height: 50px;
        margin:0px 60px 0px 70px;
        line-height:normal;
        color:var(--hue-text-color);
        transition:${unsafeCSS(Consts.TransitionDefault)};
    }
    .text-area.no-switch{
        margin-right:10px;
    }
    .text-area h2
    {
        font-size:18px;
        font-weight:500;
        text-overflow:ellipsis;
        overflow:hidden;
        white-space:nowrap;
        margin:4px 0 2px 0;
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
        this.setupListeners();
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
                }
                else {
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
        const descriptionTemplate = this._ctrl.getDescription(this._config.description);

        const title = titleTemplate.resolveToString(this._hass);
        const description = descriptionTemplate.resolveToString(this._hass);

        const showSwitch = this._config.showSwitch;
        const textClass = { 'text-area': true, 'no-switch': !showSwitch };
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
            <div class="tap-area">
                <ha-icon icon="${this._config.icon || this._ctrl.getIcon()}"></ha-icon>
                <div class="${classMap(textClass)}">
                    <h2>${title}</h2>
                    <div class="desc">${description}</div>
                </div>
            </div>
            ${showSwitch ? ViewUtils.createSwitch(this._ctrl, onChangeCallback) : nothing}

            ${ViewUtils.createSlider(this._ctrl, this._config, onChangeCallback)}
        </ha-card>`;
    }

    public override connectedCallback(): void {
        super.connectedCallback();
        // CSS
        this.updateStylesInner();
        // Listeners
        this.setupListeners();
    }

    public override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.destroyListeners();
    }

    private setupListeners() {
        const tapArea = this.renderRoot.querySelector('.tap-area');
        if (tapArea && !this._mc) {
            this._mc = new Manager(tapArea);
            this._mc.add(new Press());
            this._mc.on('press', (): void => {
                this.cardHolded();
            });
            this._mc.add(new Tap());
            this._mc.on('tap', (): void => {
                this.cardClicked();
            });
        }
    }

    private destroyListeners() {
        if (this._mc) {
            this._mc.destroy();
            this._mc = undefined;
        }
    }
}
