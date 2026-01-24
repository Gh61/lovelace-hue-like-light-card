import { LovelaceCard, HomeAssistant, LovelaceCardConfig } from 'custom-card-helpers';
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
import { Manager, Press, Tap } from '@egjs/hammerjs';
import { PreventGhostClick } from './types/prevent-ghostclick';
import { IdLitElement } from './core/id-lit-element';
import { HueApiProvider } from './core/api-provider';
import { ICardApi } from './types/types-api';

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
    private _config?: HueLikeLightCardConfig;
    private _hass?: HomeAssistant;
    private _ctrl?: AreaLightController; // aggregated controller (all entities)
    private _ctrls?: AreaLightController[]; // per-entity controllers (one per entity) shown in grid
    private _ctrlListenerRegistered = false;
    private _actionHandler?: ActionHandler;
    private _error?: ErrorInfo;
    private _mc?: HammerManager;
    private _gc?: PreventGhostClick;
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

        // aggregated controller for the whole card (keeps previous behavior)
        this._ctrl = new AreaLightController(this._config.getEntities().getIdList(), this._config.getDefaultColor(), this._config.groupEntity);

        // create per-entity controllers for grid display (one AreaLightController per entity id)
        const ids = this._config.getEntities().getIdList();
        if (this._config.numColumns && this._config.numColumns > 0) {
            this._ctrls = ids.map(id => new AreaLightController([id], this._config.getDefaultColor()));
        }
        else {
            this._ctrls = undefined;
        }

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

        // pass hass instance to Controller(s)
        if (this._ctrl) {
            this._ctrl.hass = this.hass;
        }
        if (this._ctrls) {
            this._ctrls.forEach(c => c.hass = this.hass);
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

        if (this.parentElement?.tagName.toLowerCase() == 'hui-card-preview') {
            return 'editor';
        }

        return 'inplace';
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
    ha-slider.brightness-slider
    {
        /*since HA 2025.10*/
        width: calc(100% - 28px);
        margin: 14px;
    }
    ha-alert{
        display:flex;
        overflow:auto;
    }

    /* Grid for per-entity tiles (max 3 columns via inline style) */
    .entities-grid {
      display: grid;
      gap: 10px;
      padding: 8px 12px 12px 12px;
      box-sizing: border-box;
    
      /* number of columns is driven by CSS variable set in render() */
      grid-template-columns: repeat(var(--entity-grid-cols, 3), 1fr);
      align-items: start;
    }
    
    /* Tile */
    .entity-tile {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 8px;
      padding: 10px;
      border-radius: 10px;
    
      /* Background and border tuned to be subtle and theme-friendly */
      background: rgba(255,255,255,0.02); /* fallback for older themes */
      border: 1px solid rgba(0,0,0,0.06);
      transition: transform 140ms ease, box-shadow 140ms ease, background 140ms ease, border-color 140ms ease;
    
      /* Ensure consistent minimum size for controls */
      min-height: 76px;
    }
    
    /* Header (icon + title) */
    .entity-tile .tile-header {
      display:flex;
      align-items:center;
      gap:10px;
    }
    
    /* Force a consistent icon size */
    .entity-tile ha-icon {
      color: var(--hue-text-color);
      --mdc-icon-size: 20px;
      width: 20px;
      height: 20px;
      flex: 0 0 20px;
    }
    
    /* Title: single line truncation */
    .entity-tile .tile-title {
      font-weight:500;
      font-size:14px;
      color: var(--hue-text-color);
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      flex: 1 1 auto;
    }
    
    /* Controls area: switch + slider */
    .entity-tile .tile-controls {
      display:flex;
      align-items:center;
      gap:8px;
      width:100%;
    }
    
    /* Make the tile feel interactive on hover/focus */
    .entity-tile:hover,
    .entity-tile:focus-within {
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(0,0,0,0.08);
      border-color: rgba(0,0,0,0.10);
      cursor: pointer;
    }
    
    /* Subtle visual appearance when tile represents OFF lights */
    .entity-tile.state-off {
      opacity: 0.95;
      filter: none;
    }
    
    /* Accessibility focus outline */
    .entity-tile:focus-within {
      outline: 2px solid rgba(0,0,0,0.06);
      outline-offset: 2px;
    }
    
    /* Responsive: collapse to single column on narrow screens */
    @media (max-width: 520px) {
      .entities-grid {
        grid-template-columns: 1fr !important;
      }
    }
    
    /* Optional: more compact presentation for numColumns:1 */
    .entity-tile.compact {
      padding: 8px;
      min-height: 64px;
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
        if (!this._config || !this._ctrl || !this._hass || !this._config.isVisible)
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

        // compute grid columns for per-entity tiles (max 3 columns)
        let cols = 0;
        if (this._ctrls && this._ctrls.length > 0 && this._config.numColumns && this._config.numColumns > 0) {
            // respect requested columns, but clamp to [1..3] and to number of entities
            cols = Math.min(3, Math.max(1, this._config.numColumns), this._ctrls.length);
        }

        return html`<ha-card class="${classMap(cardClass)}">
            <div class="tap-area">
                <ha-icon icon="${this._config.icon || this._ctrl.getIcon()}"></ha-icon>
                <div class="${classMap(textClass)}">
                    <h2>${title}</h2>
                    <div class="desc">${description}</div>
                </div>
            </div>
            ${showSwitch ? ViewUtils.createSwitch(this._ctrl, this.onChangeHandler, this._config.switchOnScene) : nothing}

            ${ViewUtils.createSlider(this._ctrl, this._config, this.onChangeHandler)}

            ${this._ctrls && cols > 0 ? html`
                <div class="entities-grid" style="grid-template-columns: repeat(${cols}, 1fr);">
                    ${this._ctrls.map(ctrl => {
                        const icon = ctrl.getIcon() || this._config.icon || '';
                        const titleText = ctrl.getTitle().resolveToString(this._hass);
                        return html`<div class="entity-tile">
                            <div class="tile-header">
                                <ha-icon icon="${icon}"></ha-icon>
                                <div class="tile-title">${titleText}</div>
                            </div>
                            ${ViewUtils.createSwitch(ctrl, this.onChangeHandler, this._config.switchOnScene)}
                            ${ViewUtils.createSlider(ctrl, this._config, this.onChangeHandler)}
                        </div>`;
                    })}
                </div>
            ` : nothing}
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
        if (!this._ctrlListenerRegistered && this._ctrl) {
            this._ctrlListenerRegistered = true;
            this._ctrl.registerOnPropertyChanged(this._elementId, this.onChangeHandler);
        }

        // register on each per-entity controller as well
        if (this._ctrls) {
            this._ctrls.forEach(ctrl => ctrl.registerOnPropertyChanged(this._elementId, this.onChangeHandler));
        }

        const tapArea = this.renderRoot.querySelector('.tap-area');
        if (tapArea && !this._mc) {
            this._mc = new Manager(tapArea);
            this._mc.add(new Press());
            this._mc.on('press', (): void => {
                this.cardHolded();
            });
            this._mc.add(new Tap({ event: 'singletap' }));
            this._mc.on('singletap', (): void => {
                this.cardClicked();
            });
            this._gc = new PreventGhostClick(tapArea);
        }

        // API
        if (this._config?.apiId && !this._apiUnregister && this.getEditMode() != 'editor') {
            this._apiUnregister = HueApiProvider.registerCard(this._config.apiId, this);
        }
    }

    private destroyListeners() {
        if (this._ctrl) {
            this._ctrl.unregisterOnPropertyChanged(this._elementId);
            this._ctrlListenerRegistered = false;
        }
        if (this._ctrls) {
            this._ctrls.forEach(ctrl => ctrl.unregisterOnPropertyChanged(this._elementId));
        }
        if (this._mc) {
            this._mc.destroy();
            this._mc = undefined;
        }
        if (this._gc) {
            this._gc.destroy();
            this._gc = undefined;
        }
        // API
        if (this._apiUnregister) {
            this._apiUnregister();
            this._apiUnregister = undefined;
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
