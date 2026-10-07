import { HomeAssistant } from './ha/types';
import { LovelaceCard } from './ha/panels/lovelace/types';
import { LovelaceCardConfig } from './ha/data/lovelace/config/card';
import { css, html, nothing, unsafeCSS, PropertyValues } from 'lit';
import { classMap } from 'lit-html/directives/class-map.js';
import { customElement } from 'lit/decorators.js';
import { ActionHandler } from './core/action-handler';
import { Background } from './core/colors/background';
import { AreaLightController } from './core/area-light-controller';
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
import { ActionHandlerEvent, ActionHandlerOptions } from './ha/data/lovelace/action_handler';
import { actionHandler } from './ha/panels/lovelace/common/directives/action-handler-directive';
import { IdLitElement } from './core/id-lit-element';
import { HueApiProvider } from './core/api-provider';
import { ICardApi } from './types/types-api';
import { DisplayObserver } from './core/display-observer';
import { LiveUpdateSession } from './core/live-update-session';

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
export class HueLikeLightCard extends IdLitElement implements LovelaceCard {
    private readonly _displayObserver = new DisplayObserver(() => this.updateStylesInner(false));
    private _config?: HueLikeLightCardConfig;
    private _hass?: HomeAssistant;
    private _ctrl?: AreaLightController;
    private _sliderSession?: LiveUpdateSession<number>;
    private _ctrlListenerRegistered = false;
    private _actionHandler?: ActionHandler;
    private _error?: ErrorInfo;
    private _apiUnregister?: Action;

    public constructor() {
        super('HueLikeLightCard');
    }

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
            this._config = new HueLikeLightCardConfig(plainConfig as HueLikeLightCardConfigInterface);

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
        if (this._config?.isInitialized !== true)
            throw new Error('Config is not initialized.');

        // stop listening to the replaced controller - updated() registers on the new one
        this.unregisterCtrlListener();

        const ctrl = new AreaLightController(this._config.getEntities().getIdList(), this._config.getDefaultColor(), this._config.groupEntity);
        this._ctrl = ctrl;
        this._sliderSession?.stop();
        this._sliderSession = new LiveUpdateSession<number>(this._config.liveUpdate, () => {
            ctrl.releaseBrightnessPreview();
            this.onChangeHandler();
        });
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

    /*
     * Gets or sets whether the card is in edit mode (in place editor or dialog editor). 
     */
    public editMode?: boolean;

    /**
     * Returns actual edit mode of the card.
     */
    private getEditMode() {
        if (!this.editMode)
            return null;

        if (this.parentElement?.tagName.toLowerCase() === 'hui-card-preview') {
            return 'editor';
        }

        return 'inplace';
    }

    // The height of your card. Home Assistant uses this to automatically
    // distribute all cards over the available columns.
    public getCardSize(): number {
        return 3;
    }

    protected get actionHandlerConfig(): ActionHandlerOptions {
        return {
            hasTap: true,
            hasHold: true,
            hasDoubleClick: !!this._config?.actions.hasDoubleTap
        };
    }

    private handleAction(ev: ActionHandlerEvent): void {
        this._actionHandler?.handleCardAction(ev.detail.action);

        // update styles
        this.updateStylesInner();
    }

    // #### UI:

    public static override styles = [
        ViewUtils.SwitchStyles,
        css`
    ha-card
    {
        min-height:80px;
        background:var(--hue-background);
        position:relative;
        box-shadow:var(--hue-card-box-shadow);
        background-origin: border-box;
        --hue-card-margin: 14px;
    }
    ha-card.hue-borders
    {
        border-radius:${Consts.HueBorderRadius}px;
        box-shadow:var(--hue-box-shadow), ${unsafeCSS(Consts.HueShadow)};
        border:none;
    }
    ha-card div.main-info
    {
        display: flex;
        justify-content: space-between;
        padding: var(--hue-card-margin);
        padding-bottom: 0;
    }
    ha-card div.tap-area
    {
        flex-grow:1;
        min-width: 0;
        /* height = card(80) - slider(32) - border(2) */
        height: calc(46px - var(--hue-card-margin));
        cursor: pointer;
        display: flex;
        align-items: center;
    }
    ha-icon
    {
        flex-shrink: 0;
        display:inline-block;
        --mdc-icon-size: calc(24px * var(--hue-icon-size, ${Consts.IconSize[KnownIconSize.Original]}));
        width: 70px;
        margin-left: calc(-1* var(--hue-card-margin));
        text-align: center;
        color:var(--hue-text-color);
        transition:${unsafeCSS(Consts.TransitionDefault)};
    }
    .text-area{
        flex-grow: 1;
        min-width: 0;
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
        margin: 0;
    }
    .text-area .desc
    {
        font-size:13px;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
    }
    .brightness-slider
    {
        width:100%;
    }
    ha-slider.brightness-slider
    {
        /*since HA 2025.10*/
        width: calc(100% - 2 * var(--hue-card-margin));
        margin: var(--hue-card-margin);
    }
    ha-alert{
        display:flex;
        overflow:auto;
    }
    `];

    protected override updated(changedProps: PropertyValues): void {
        super.updated(changedProps);

        // nothing to do until the card has its config and hass (#424)
        if (!this._config || !this.hass) {
            return;
        }

        this.setupListeners();
        this.updateStylesInner();

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

        const card = this.renderRoot.querySelector('ha-card') as HTMLElement;

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
            '--hue-box-shadow',
            shadow
        );

        // the theme's card shadow under our own - read from the card itself ('none' is the HA default since 2022.11
        // and can't be part of a shadow list)
        const themeShadow = card ? getComputedStyle(card).getPropertyValue('--ha-card-box-shadow').trim() : '';
        this.style.setProperty(
            '--hue-card-box-shadow',
            shadow && themeShadow && themeShadow !== 'none' ? `${shadow}, ${themeShadow}` : shadow
        );

        // sometimes the element is not yet displayed, so we need to calculate shadow later
        // (when the card is not rendered yet, updated() will call this again)
        if (!shadow) {
            if (card) {
                this._displayObserver.waitForDisplay(card);
            }
        }
        else {
            this._displayObserver.stop();
        }
    }

    private onChangeHandler = () => this.onChangeCallback();
    private onChangeCallback() {
        this.requestUpdate();
        this.updateStylesInner();
    }

    protected override render() {
        if (this._error) {
            return html`<ha-alert alert-type="error" .title=${this._error.message}>
                ${this._error.stack ? html`<pre>${this._error.stack}</pre>` : nothing}
            </ha-alert>`;
        }

        // no config, ctrl or hass
        if (!this._config || !this._ctrl || !this._sliderSession || !this._hass || !this._config.isVisible)
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

        return html`<ha-card class="${classMap(cardClass)}">
            <div class="main-info">
                <div class="tap-area" @action=${this.handleAction} .actionHandler=${actionHandler(this.actionHandlerConfig)}>
                <ha-icon icon="${this._config.icon || this._ctrl.getIcon()}"></ha-icon>
                <div class="${classMap(textClass)}">
                        <h2>${title}</h2>
                        <div class="desc">${description}</div>
                    </div>
                </div>
                ${showSwitch ? ViewUtils.createSwitch(this._ctrl, this.onChangeHandler, this._config.switchOnScene) : nothing}
            </div>
            ${ViewUtils.createSlider(this._ctrl, this._config, this.onChangeHandler, this._sliderSession)}
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
        this.destroyListeners();
        this._displayObserver.stop();
        super.disconnectedCallback();
    }

    private setupListeners() {
        // a disconnected card can still receive hass updates (and run updated()) - don't re-register after teardown
        if (!this.isConnected)
            return;

        if (!this._ctrlListenerRegistered && this._ctrl) {
            this._ctrlListenerRegistered = true;
            this._ctrl.registerOnPropertyChanged(this._elementId, this.onChangeHandler);
        }

        // API
        if (this._config?.apiId && !this._apiUnregister && this.getEditMode() !== 'editor') {
            this._apiUnregister = HueApiProvider.registerCard(this._config.apiId, this);
        }
    }

    private destroyListeners() {
        this.unregisterCtrlListener();
        this._sliderSession?.stop();
        // API
        if (this._apiUnregister) {
            this._apiUnregister();
            this._apiUnregister = undefined;
        }
    }

    private unregisterCtrlListener() {
        if (this._ctrl) {
            this._ctrl.unregisterOnPropertyChanged(this._elementId);
            this._ctrlListenerRegistered = false;
        }
    }

    /**
     * @returns Public API object
     */
    public api(): ICardApi {
        return {
            openHueScreen: () => this._actionHandler?.openHueScreen()
        };
    }
}
