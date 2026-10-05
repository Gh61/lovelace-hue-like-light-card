import { css, nothing, PropertyValues, unsafeCSS } from 'lit';
import { html, unsafeStatic } from 'lit/static-html.js';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit-html/directives/class-map.js';
import { Background } from '../core/colors/background';
import { Color } from '../core/colors/color';
import { AreaLightController } from '../core/area-light-controller';
import { ViewUtils } from '../core/view-utils';
import { HueLikeLightCardConfig, HueLikeLightCardEntityConfigCollection } from '../types/config';
import { Consts } from '../types/consts';
import { fireEvent } from '../ha/common/dom/fire_event';
import { HassDialog } from '../ha/dialogs/make-dialog-manager';
import { ThemeHelper } from '../types/theme-helper';
import { SceneConfig, SceneProvider } from '../types/types-config';
import { PresetConfig } from '../types/types-hue-preset';
import { HueDialogScenePresetTile } from './dialog-scene-preset-tile';
import { IdLitElement } from '../core/id-lit-element';
import { HueDialogLightTile, ILightSelectedEventDetail } from './dialog-light-tile';
import { ILightContainer } from '../types/types-interface';
import { ITileEventDetail } from './dialog-tile';
import { HueLightDetail } from './light-detail';
import { LightController } from '../core/light-controller';
import { localize } from '../localize/localize';
import { ActionHandler } from '../core/action-handler';
import { LimitedTimeout } from '../core/limited-timeout';
import { HueDialogSceneHATile } from './dialog-scene-ha-tile';
import { horizontalScroll } from '../directives/horizontal-scroll';

/** Parameters of the Hue screen - passed through the HA `show-dialog` event. */
export interface HueDialogParams {
    config: HueLikeLightCardConfig;
    lightController: AreaLightController;
    actionHandler: ActionHandler;
}

/**
 * History state of the dialog levels. HA pattern (HA 2026.9: `src/panels/config/automation/add-automation-element-dialog.ts`,
 * handled by `src/state/url-sync-mixin.ts`): the dialog manager pushes `{ dialog: <tag> }`, the dialog pushes
 * `{ dialogData: {} }` as its root level and `{ dialogData: { lightDetail: true } }` for the light detail.
 * On the browser back HA calls `closeDialog(historyState)` with the entry the user navigated to (and `closeDialog()`
 * without state when that entry also marks a dialog that was stacked on top of this one).
 */
interface HueDialogHistoryState {
    dialogData?: {
        lightDetail?: boolean;
    };
}

/**
 * The Hue screen. Managed by the HA dialog manager: opened by the `show-dialog` event (`ActionHandler.openHueScreen`),
 * one instance per element name, re-shown with new params; HA owns the history (back closes the dialog).
 */
@customElement(HueDialog.ElementName)
export class HueDialog extends IdLitElement implements HassDialog<HueDialogParams> {

    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-dialog' + Consts.ElementPostfix;

    /*
    Doc:
    https://material-components.github.io/material-components-web-catalog/#/component/dialog
    */

    private readonly _lt: LimitedTimeout = new LimitedTimeout(20);
    @state()
    private _open = false;
    private _config: HueLikeLightCardConfig;
    private _entitiesConfig: HueLikeLightCardEntityConfigCollection;
    private _ctrl: AreaLightController;
    private _actionHandler: ActionHandler;

    // #region selectedLights

    private readonly _selectedLights = new Array<ILightContainer>();

    /**
     * @returns Whether the given light is the only selected light.
     */
    private isOnlySelectedLight(light: ILightContainer) {
        return this._selectedLights.length === 1 && this._selectedLights[0] === light;
    }

    /**
     * Will add light to collection of selected lights.
     */
    private setSelectedLights(...lights: ILightContainer[]) {
        this._selectedLights.length = 0;
        lights.forEach(l => this._selectedLights.push(l));
        this.requestUpdate('_selectedLights');
    }

    /**
     * Will remove all lights from collection of selected lights.
     */
    private clearSelectedLights() {
        this._selectedLights.length = 0;
        this.requestUpdate('_selectedLights');
    }

    private loadSelectedLights(detail: HueLightDetail) {
        const lights = detail.lightContainer?.getLights();
        if (lights) {
            this.setSelectedLights(...lights);
        }
    }

    // #endregion

    public constructor() {
        super('HueDialog');
    }

    //#region Tile interactions

    private get isLightDetailOpen() {
        return this._selectedLights.length > 0;
    }

    private onLightSelected(ev: CustomEvent<ILightSelectedEventDetail>) {
        // only hide selector if unselected the only one last selected light
        if (ev.detail.isSelected || !this.isOnlySelectedLight(ev.detail.lightContainer!)) {
            const wasOpen = this.isLightDetailOpen;
            this.setSelectedLights(ev.detail.lightContainer!);

            // to be in sync
            (ev.detail.tileElement as HueDialogLightTile).isSelected = true;

            // scroll to selected light
            HueDialog.tileScrollTo(ev.detail.tileElement);

            // set light into detail
            if (this._lightDetailElement) {
                this._lightDetailElement.lightContainer = ev.detail.lightContainer as LightController;
                this._lightDetailElement.show();
            }

            // the detail is an inner level of the dialog - one history entry, so the browser back closes only the detail
            if (!wasOpen) {
                // HA re-pushes its own `{ dialog }` state after a stacked dialog (e.g. more-info) closes - make it our root level again
                if (!(window.history.state as HueDialogHistoryState | null)?.dialogData) {
                    const rootState: HueDialogHistoryState = { dialogData: {} };
                    window.history.replaceState(rootState, '');
                }
                const state: HueDialogHistoryState = { dialogData: { lightDetail: true } };
                window.history.pushState(state, '');
            }
        }
        else {
            this.hideLightDetail();
        }
    }

    /** Leaves the light detail level through the history, HA calls `closeDialog` with the root state. */
    private hideLightDetail() {
        if (this.isLightDetailOpen) {
            window.history.back();
        }
    }

    private hideLightDetailInternal(instant = false) {
        this.clearSelectedLights();
        this._lightDetailElement?.hide(instant);
    }

    private toggleUnderDetailControls(show: boolean) {
        const controls = this.renderRoot.querySelectorAll('.detail-hide');
        controls.forEach((el) => {
            el.classList.toggle('hue-hidden', show);
        });

        // scroll content down to lights
        const dialogShadowRoot = this.shadowRoot?.querySelector('ha-dialog')?.shadowRoot;
        if (dialogShadowRoot) {
            const contentDiv = dialogShadowRoot.getElementById('content');
            if (contentDiv) {
                if (show) {
                    contentDiv.style.overflowY = 'hidden';
                    contentDiv.scrollBy({ top: contentDiv.scrollHeight, behavior: 'smooth' });
                }
                else {
                    contentDiv.style.overflowY = '';
                }
            }
        }
    }

    private afterSceneTileActivated(ev: CustomEvent<ITileEventDetail>) {
        // scroll to selected scene
        HueDialog.tileScrollTo(ev.detail.tileElement);
    }

    //#endregion

    //#region Tile-Scrollers

    private static tileScrollTo(el: HTMLElement) {
        if (!el)
            return;

        const tileScroller = el.closest('.tile-scroller') as HTMLElement;
        if (tileScroller == null)
            throw Error('Parent tile-scroller not found.');

        // get tile scroller bounds
        const tileScrollerStart = tileScroller.offsetLeft + tileScroller.scrollLeft;
        const tileScrollerEnd = tileScroller.clientWidth + tileScrollerStart;

        const minSpace = 10; // reasonable space before/after the element
        const elStart = el.offsetLeft - minSpace;
        const elEnd = el.offsetLeft + el.clientWidth + minSpace;

        // is reasonably visible?
        const isBefore = elStart < tileScrollerStart;
        const isAfter = elEnd > tileScrollerEnd;

        // if is inside or is outside on both sides (fail) - no scroll
        if (isBefore === isAfter)
            return;

        if (isBefore) {
            tileScroller.scrollBy({ left: elStart - tileScrollerStart, behavior: 'smooth' });
        }
        else {
            tileScroller.scrollBy({ left: elEnd - tileScrollerEnd, behavior: 'smooth' });
        }
    }

    //#endregion

    //#region show/hide (HA dialog manager)

    /**
     * Called by the HA dialog manager (the `show-dialog` event). The element stays in the DOM and is re-shown with new params.
     */
    public showDialog(params: HueDialogParams): void {
        this._config = params.config;
        this._entitiesConfig = params.config.getEntities();
        this._ctrl = params.lightController;
        this._actionHandler = params.actionHandler;
        this._open = true;

        // root level of the dialog - the inner levels push their own `dialogData` states on top of it
        const state: HueDialogHistoryState = { dialogData: {} };
        window.history.pushState(state, '');

        // register update delegate (include hass - we need to update the dialog)
        this._ctrl.registerOnPropertyChanged(this._elementId, this.onChangeHandler, /* includeHass: */ true);

        this.resetConfigStyles();
        this.requestUpdate();
        this.updateComplete.then(() => {
            this.tryCreateBackdropAndLightDetail(true);
            this._lightDetailElement!.areaController = this._ctrl; // the detail element is shared by all cards
            this.updateStylesInner(true);
        });
    }

    /**
     * Called by the HA dialog manager - directly (closing all dialogs) or from the browser back with the history state
     * the user navigated to. Unwinds the dialog levels the way HA dialogs do: returns `false` while an inner level
     * is left or the history is cleaned up, `true` when the dialog is closed for good.
     */
    public closeDialog(historyState?: HueDialogHistoryState): boolean {
        // the level the user navigated to, or the current one when HA asks to close
        const level = historyState ?? (window.history.state as HueDialogHistoryState | null);
        if (level?.dialogData) {
            // closing in progress - keep unwinding the inner history entries down to the dialog state of HA
            if (!this._open) {
                window.history.back();
                return false;
            }

            const atRoot = !level.dialogData.lightDetail;

            // navigated back from the detail to the root level (HA passes no state when the root entry also marks a stacked dialog)
            if (atRoot && this.isLightDetailOpen) {
                this.hideLightDetailInternal();
                return false;
            }

            // navigated back from a dialog stacked on top of this one - nothing to leave
            if (atRoot && historyState) {
                return false;
            }

            // closed from the dialog itself while inner history entries exist - hide now, let the history unwind
            this._open = false;
            window.history.back();
            return false;
        }

        this._open = false;
        this.hideLightDetailInternal(true);
        this._ctrl?.unregisterOnPropertyChanged(this._elementId);
        fireEvent(this, 'dialog-closed', { dialog: this.localName });
        return true;
    }

    /** ha-dialog was closed by the user (scrim, Esc, close button) - close through the HA dialog manager flow. */
    private onDialogClosed() {
        if (this._open) {
            this.closeDialog();
        }
    }

    public override disconnectedCallback(): void {
        this._ctrl?.unregisterOnPropertyChanged(this._elementId);
        this._lt.reset();
        super.disconnectedCallback();
    }

    //#endregion

    /**
     * Default ha-dialog styles from HA.
     * See https://github.com/home-assistant/frontend/blob/dev/src/resources/styles.ts
     */
    private static readonly haStyleDialog = css`
  ha-dialog,
  ha-adaptive-dialog {
    --mdc-dialog-min-width: 400px;
    --mdc-dialog-max-width: 600px;
    --mdc-dialog-max-width: min(600px, 95vw);
    --justify-action-buttons: space-between;
    --dialog-container-padding: var(--safe-area-inset-top, 0)
      var(--safe-area-inset-right, 0) var(--safe-area-inset-bottom, 0)
      var(--safe-area-inset-left, 0);
    --dialog-surface-padding: 0px;
  }

  ha-dialog .form,
  ha-adaptive-dialog .form {
    color: var(--primary-text-color);
  }

  a {
    color: var(--primary-color);
  }

  /* make dialog fullscreen on small screens */
  @media all and (max-width: 450px), all and (max-height: 500px) {
    ha-dialog,
    ha-adaptive-dialog {
      --mdc-dialog-min-width: 100vw;
      --mdc-dialog-max-width: 100vw;
      --mdc-dialog-min-height: 100vh;
      --mdc-dialog-min-height: 100svh;
      --mdc-dialog-max-height: 100vh;
      --mdc-dialog-max-height: 100svh;
      --dialog-container-padding: 0px;
      --dialog-surface-padding: var(--safe-area-inset-top, 0)
        var(--safe-area-inset-right, 0) var(--safe-area-inset-bottom, 0)
        var(--safe-area-inset-left, 0);
      --vertical-align-dialog: flex-end;
    }
    ha-dialog {
      --ha-dialog-border-radius: var(--ha-border-radius-square);
    }
  }
  .error {
    color: var(--error-color);
  }
`;

    private static readonly headerMargin = 8;
    private static readonly tileGap = 10;
    private static readonly haPadding = 24;

    public static override get styles() {
        return [
            HueDialog.haStyleDialog,
            ViewUtils.SwitchStyles,
            css`
    /* hiding controls when light detail is open */
    .detail-hide {
        transition:${unsafeCSS(Consts.TransitionDefault)};
    }

    .hue-hidden {
        opacity: 0;
        pointer-events: none;
    }

    /* same color header */
    .hue-heading {
        --hue-heading-text-color: var(--hue-text-color, ${unsafeCSS(Consts.ThemeDialogHeadingColorVar)});
        
        background:var(--hue-background, ${unsafeCSS(Consts.ThemeCardBackgroundVar)} );
        box-shadow:var(--hue-box-shadow), 0px 5px 10px rgba(0,0,0,0.5);
        transition:${unsafeCSS(Consts.TransitionDefault)};

        border-bottom-left-radius: var(--ha-dialog-border-radius, 28px);
        border-bottom-right-radius: var(--ha-dialog-border-radius, 28px);
        padding-bottom: calc(var(--ha-dialog-border-radius, 28px) / 2);

        /* HA will show bottom border when scrolled down */
        border-bottom-width: 0;

        overflow:hidden;

        /* is above the backdrop */
        z-index:1;
    }
    .hue-heading ha-icon-button,
    .hue-heading .main-title {
        color:var(--hue-heading-text-color);
    }
    ha-dialog-header {
        --mdc-theme-on-primary: var(--hue-heading-text-color);
        --mdc-theme-primary: transparent;
        flex-shrink: 0;
        display: block;
    }
    .hue-heading ha-switch {
        padding: 12px;
    }
    .hue-heading .brightness-slider {
        width: 100%;
    }
    .hue-heading ha-slider.brightness-slider {
        width: calc(100% - 36px);
        margin: 18px;
        margin-top: 12px;
    }
    /* Disable the bottom border radius */
    /* in default styles: --ha-border-radius=0 in this case */
    /*
    @media all and (max-width: 450px), all and (max-height: 500px) {
        border-bottom-left-radius: none;
        border-bottom-right-radius: none;
        padding-bottom: none;
    }
    */

    /* titles */
    .header{
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0;
    }
    .header .title{
        color: ${unsafeCSS(Consts.ThemeSecondaryTextColorVar)};
    }

    .content {
        outline: none;
        padding-top: var(--ha-space-6);
    }

    /* tiles - scenes, lights */
    .tile-scroller {
        display: flex;
        flex-flow: column;
        /*gap: ${HueDialog.tileGap}px;*/
        max-width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 0 ${HueDialog.haPadding}px;
        margin: 0 -${HueDialog.haPadding}px;
    }
    /* width */
    ::-webkit-scrollbar {
        height: 10px;
    }

    /* Track */
    ::-webkit-scrollbar-track {
        background: transparent;
        /*background: #f1f1f1;*/
    }
    
    /* Handle */
    ::-webkit-scrollbar-thumb {
        border-radius: 5px;
        background: #888; 
    }

    /* Handle on hover */
    ::-webkit-scrollbar-thumb:hover {
        background: #555; 
    }

    @media screen and (max-width: 768px){
        ::-webkit-scrollbar {
            -webkit-appearance: none;
            height: 0px;
            background: transparent;
        }
    }

    .tiles {
        display: flex;
        flex-flow: row;
        gap: ${HueDialog.tileGap}px;
        margin-bottom: ${HueDialog.tileGap}px;
    }
    .tile-scroller .tiles:first-child{
        margin-top: ${HueDialog.headerMargin}px;
    }
    .tiles::after {
        /* Flex loosing right padding, when overflowing */
        content: '';
        min-width: ${HueDialog.haPadding - HueDialog.tileGap}px;
    }

    /* Scene tiles */
    .tile-scroller.scene-tiles{
        min-height: 100px;
    }

    /* Light tiles */
    .tile-scroller.light-tiles{
        transition: ${unsafeCSS(Consts.TransitionDefault)};
        bottom: 100px;
    }

    @media all and (max-width: 450px), all and (max-height: 500px){
        .detail-active .tile-scroller.light-tiles{
            position: absolute;
            bottom: 30px;
            width: calc(100% - ${2 * HueDialog.haPadding}px);
        }
    }
    `];
    }

    private _backdropSet = false;
    private _lightDetailElement: HueLightDetail | null = null;

    private tryCreateBackdropAndLightDetail(throwError = false) {
        // Allow gradient backdrop on dialog
        if (!this._backdropSet || !this._lightDetailElement) {

            // Trying to find surface element (it's not available during first load)
            const dialogShadowRoot = this.shadowRoot?.querySelector('ha-dialog')?.shadowRoot;
            const surface = dialogShadowRoot && dialogShadowRoot.querySelector('wa-dialog') as HTMLElement;

            // finally got surface element, let's create backdrop and other stuff
            if (surface) {

                if (!this._backdropSet) {
                    const backdropElement = document.createElement('div');
                    backdropElement.id = 'hue-backdrop';
                    backdropElement.style.position = 'absolute';
                    backdropElement.style.width = '100%';
                    backdropElement.style.height = '100%';
                    backdropElement.style.borderRadius = 'var(--ha-dialog-border-radius, 28px)'; // same as dialog
                    backdropElement.style.background = 'var(--hue-background)';
                    backdropElement.style.transition = Consts.TransitionDefault;

                    const mask = 'linear-gradient(rgba(255, 255, 255, .25) 0%, transparent 70%)';
                    backdropElement.style.mask = mask;
                    backdropElement.style.webkitMask = mask;
                    //backdropElement.style.zIndex = '0';

                    // if the browser doesn't support mask - don't render the backdrop element
                    if (backdropElement.style.mask || backdropElement.style.webkitMask) {
                        surface.prepend(backdropElement);
                    }

                    this._backdropSet = true;
                }

                if (!this._lightDetailElement) {
                    const detailElement = new HueLightDetail();
                    detailElement.style.position = 'absolute';
                    detailElement.style.width = '100%';
                    detailElement.style.height = 'calc(100% - 200px)';
                    detailElement.style.zIndex = '2'; // over header

                    detailElement.areaController = this._ctrl;

                    // action for show and hide
                    detailElement.addEventListener('show', () => {
                        this.toggleUnderDetailControls(true);
                    });
                    detailElement.addEventListener('hide', () => {
                        this.toggleUnderDetailControls(false);
                        this.hideLightDetail();
                    });
                    // when lightContainer changes from picker
                    detailElement.addEventListener('lightcontainer-change', () => {
                        this.loadSelectedLights(detailElement);
                    });

                    surface.prepend(detailElement);

                    this._lightDetailElement = detailElement;
                }
            }
            else if (throwError) {
                throw new Error('Cannot create backdrop and lightDetail. Surface not found.');
            }
        }
    }

    // Can't be named 'updateStyles', because HA searches for that method and calls it instead of applying theme
    private updateStylesInner(isFirst: boolean): void {
        const configBgColor = this._config.getHueScreenBgColor();

        // ## Content styles
        if (isFirst) {
            // apply theme
            ThemeHelper.applyTheme(this, this._ctrl.hass.themes, this._config.theme);

            // To help change themes on the fly
            ThemeHelper.setDialogThemeStyles(this, '--hue-screen-background', configBgColor.isThemeColor() || this._config.getOffColor().isThemeColor());

            let contentBg = null;
            let contentFg = null;
            if (!configBgColor.isThemeColor()) {
                contentBg = configBgColor;
                contentFg = contentBg.getForeground(Consts.DialogFgLightColor, Consts.DarkColor, +120); // for most colors use dark

                this.style.setProperty(
                    '--hue-screen-background',
                    contentBg.toString()
                );
                this.style.setProperty(
                    '--primary-text-color',
                    contentFg.toString()
                );
            }
            else {
                this.style.setProperty(
                    '--hue-screen-back-button-color',
                    Consts.ThemePrimaryTextColorVar
                );
            }
        }

        // ## Heading styles
        const heading = this.renderRoot.querySelector('.hue-heading') as Element;
        if (!heading)
            throw new Error('Hue heading not found!');

        let offBackground: Background | null;
        // if the user sets custom off color - use it
        if (this._config.wasOffColorSet) {
            const offColor = this._config.getOffColor();
            if (!offColor.isThemeColor()) {
                offBackground = new Background([offColor.getBaseColor()]);
            }
            else {
                offBackground = null;
            }
        }
        else {
            offBackground = new Background([new Color(Consts.DialogOffColor)]);
        }

        const bfg = ViewUtils.calculateBackAndForeground(this._ctrl, offBackground, true);
        const shadow = ViewUtils.calculateDefaultShadow(heading, this._ctrl, this._config.offShadow);

        if (this._config.hueBorders) {
            this.style.setProperty(
                '--ha-dialog-border-radius',
                Consts.HueBorderRadius + 'px'
            );
        }

        this.style.setProperty(
            '--hue-background',
            bfg.background?.toString() ?? Consts.ThemeCardBackgroundVar
        );
        this.style.setProperty(
            '--hue-box-shadow',
            shadow
        );

        if (bfg.foreground != null) {
            this.style.setProperty(
                '--hue-text-color',
                bfg.foreground.toString()
            );
        }
        else {
            this.style.removeProperty('--hue-text-color');
        }

        // sometimes the element is not yet displayed, so we need to try calculate shadow later
        if (!shadow) {
            this._lt.setTimeout(() => this.updateStylesInner(false), 100);
        }
        else {
            this._lt.reset();
        }
    }

    private onChangeHandler = () => this.onChangeCallback();
    private onChangeCallback() {
        this.requestUpdate();
        this.updateStylesInner(false);
    }

    protected override render() {
        if (!this._config) {
            return nothing;
        }

        // inspiration: https://github.com/home-assistant/frontend/blob/dev/src/dialogs/more-info/ha-more-info-dialog.ts

        const cardTitle = this._config.getTitle(this._ctrl).resolveToString(this._ctrl.hass);
        const mdiClose = 'mdi:close';
        const sceneTiles: ({ kind: 'scene', config: SceneConfig } | { kind: 'preset', config: PresetConfig })[] = [];
        this._config.sceneProvider.forEach(provider => {
            if (provider === SceneProvider.HaScenes) {
                sceneTiles.push(...this._config.scenes.map(sceneConfig => ({ kind: 'scene' as const, config: sceneConfig })));
            }
            else if (provider === SceneProvider.ScenePresets) {
                sceneTiles.push(...this._config.presets.map(presetConfig => ({ kind: 'preset' as const, config: presetConfig })));
            }
        });

        const renderSceneTile = (tile: { kind: 'scene', config: SceneConfig } | { kind: 'preset', config: PresetConfig }) => {
            if (tile.kind === 'scene') {
                return html`<${unsafeStatic(HueDialogSceneHATile.ElementName)}
                                .cardTitle=${cardTitle}
                                .sceneConfig=${tile.config}
                                @activated=${(e: CustomEvent) => this.afterSceneTileActivated(e)}
                                .hass=${this._ctrl.hass}
                                .actionHandler=${this._actionHandler}>
                            </${unsafeStatic(HueDialogSceneHATile.ElementName)}>`;
            }
            else if (tile.kind === 'preset') {
                return html`<${unsafeStatic(HueDialogScenePresetTile.ElementName)}
                                .presetConfig=${tile.config}
                                .targets=${this._config.getPresetTargets()}
                                @activated=${(e: CustomEvent) => this.afterSceneTileActivated(e)}
                                .hass=${this._ctrl.hass}
                                .actionHandler=${this._actionHandler}>
                            </${unsafeStatic(HueDialogScenePresetTile.ElementName)}>`;
            } 

            return nothing;
        };

        /* eslint-disable @/indent */
        return html`
        <ha-dialog
          .open=${this._open}
          @closed=${() => this.onDialogClosed()}
          .heading=${cardTitle}
          hideActions
        >
          <ha-dialog-header slot="header" class="hue-heading detail-hide">
            <ha-icon-button
              slot="navigationIcon"
              data-dialog="close"
              dialogAction="cancel"
            >
              <ha-icon
                icon=${mdiClose}
                style="height:auto"
              >
              </ha-icon>
            </ha-icon-button>
            <div
              slot="title"
              class="main-title"
              .title=${cardTitle}
            >
              ${cardTitle}
            </div>
            <div slot="actionItems">
              ${ViewUtils.createSwitch(this._ctrl, this.onChangeHandler, this._config.switchOnScene)}
            </div>
            ${ViewUtils.createSlider(this._ctrl, this._config, this.onChangeHandler)}
          </ha-dialog-header>
          <div class="${classMap({
            'content': true,
            'detail-active': !!this._selectedLights.length
        })}" tabindex="-1" dialogInitialFocus>
            <div class='header detail-hide'>
                <div class='title'>${sceneTiles.length ? localize(this._ctrl.hass, 'dialog.scenes') : nothing}</div>
            </div>
            <div class='tile-scroller scene-tiles detail-hide' ${horizontalScroll()}>
                <div class='tiles'>
                    ${(sceneTiles.map((tile, i) => i % 2 === 1 ? nothing : renderSceneTile(tile)))}
                </div>
                <div class='tiles'>
                    ${(sceneTiles.map((tile, i) => i % 2 === 0 ? nothing : renderSceneTile(tile)))}
                </div>
            </div>

            <div class='header detail-hide'>
                <div class='title'>${localize(this._ctrl.hass, 'dialog.lights')}</div>
            </div>
            <div class='tile-scroller light-tiles' ${horizontalScroll()}>
                <div class='tiles'>
                    ${(this._ctrl.getLights().map((l) =>
                    html`<${unsafeStatic(HueDialogLightTile.ElementName)}
                            .cardTitle=${cardTitle}
                            .lightContainer=${l}
                            .entityConfig=${this._entitiesConfig.getConfig(l.getEntityId())}
                            .isSelected=${this._selectedLights.indexOf(l) >= 0}
                            .isUnselected=${this._selectedLights.length && this._selectedLights.indexOf(l) === -1}
                            @selected-change=${(e: CustomEvent) => this.onLightSelected(e)}
                            .defaultColor=${this._config.getDefaultColor()}
                            .hass=${this._ctrl.hass}
                            .actionHandler=${this._actionHandler}>
                        </${unsafeStatic(HueDialogLightTile.ElementName)}>`))}
                </div>
            </div>
          </div>
        </ha-dialog>
        `;
        /* eslint-enable @/indent */
    }

    //#region updateStyles hooks

    protected override updated(changedProps: PropertyValues): void {
        super.updated(changedProps);

        if (this._open) {
            this.updateStylesInner(false);
        }
    }

    /** Removes the style properties derived from the previous params, so a re-show with another config starts clean. */
    private resetConfigStyles() {
        ['--hue-screen-background', '--primary-text-color', '--hue-screen-back-button-color', '--ha-dialog-border-radius']
            .forEach(property => this.style.removeProperty(property));
    }

    //#endregion
}
