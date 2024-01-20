import { css, nothing, PropertyValues, unsafeCSS } from 'lit';
import { html, unsafeStatic } from 'lit/static-html.js';
import { customElement, state } from 'lit/decorators.js';
import { classMap } from 'lit-html/directives/class-map.js';
import { Background } from '../core/colors/background';
import { Color } from '../core/colors/color';
import { AreaLightController } from '../core/area-light-controller';
import { ViewUtils } from '../core/view-utils';
import { HueLikeLightCardConfig } from '../types/config';
import { Consts } from '../types/consts';
import { HaDialog } from '../types/types-hass';
import { ThemeHelper } from '../types/theme-helper';
import { HueDialogSceneTile } from './dialog-scene-tile';
import { IdLitElement } from '../core/id-lit-element';
import { HueDialogLightTile, ILightSelectedEventDetail } from './dialog-light-tile';
import { ILightContainer } from '../types/types-interface';
import { ITileEventDetail } from './dialog-tile';
import { HueLightDetail } from './light-detail';
import { LightController } from '../core/light-controller';
import { HueHistoryStateManager, HueHistoryStep } from './history-state-manager';
import { localize } from '../localize/localize';
import { ActionHandler } from '../core/action-handler';

@customElement(HueDialog.ElementName)
export class HueDialog extends IdLitElement {

    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-dialog' + Consts.ElementPostfix;

    /*
    Doc:
    https://material-components.github.io/material-components-web-catalog/#/component/dialog
    */

    private _isRendered = false;
    private _config: HueLikeLightCardConfig;
    private _ctrl: AreaLightController;
    private _actionHandler: ActionHandler;

    @state()
    private _selectedLight: ILightContainer | null;

    public constructor(config: HueLikeLightCardConfig, lightController: AreaLightController, actionHandler: ActionHandler) {
        super('HueDialog');

        this._config = config;
        this._ctrl = lightController;
        this._actionHandler = actionHandler;
    }

    //#region Hass changes

    private onLightControllerChanged(propertyNames: (keyof LightController)[]) {
        // when LightController changed - update this
        if (propertyNames.includes('hass')) {
            this.requestUpdate();
        }
    }

    //#endregion

    //#region Tile interactions

    // lightDetail as history step
    private _lightDetailHistoryStep: HueHistoryStep | undefined;

    private onLightSelected(ev: CustomEvent<ILightSelectedEventDetail>) {
        if (ev.detail.isSelected) {

            const show = () => {
                this._selectedLight = ev.detail.lightContainer;

                // scroll to selected light
                HueDialog.tileScrollTo(ev.detail.tileElement);

                // set light into detail
                if (this._lightDetailElement) {
                    this._lightDetailElement.lightContainer = <LightController>this._selectedLight;
                    this._lightDetailElement.show();
                }
            };
            const hide = () => {
                this._selectedLight = null;

                // hide detail of selected light
                this._lightDetailElement?.hide();
            };

            // show with history
            this._lightDetailHistoryStep = new HueHistoryStep(show, hide, HueLightDetail.ElementName);
            HueHistoryStateManager.instance.addStep(this._lightDetailHistoryStep);

        }
        else if (this._selectedLight == ev.detail.lightContainer) {
            this.hideLightDetail();
        }
    }

    private hideLightDetail() {
        // hide with history
        if (this._lightDetailHistoryStep) {
            HueHistoryStateManager.instance.goBefore(this._lightDetailHistoryStep);
        }
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

    private afterSceneActivated(ev: CustomEvent<ITileEventDetail>) {
        // scroll to selected scene
        HueDialog.tileScrollTo(ev.detail.tileElement);
    }

    //#endregion

    //#region Tile-Scrollers

    private static tileScrollTo(el: HTMLElement) {
        if (!el)
            return;

        const tileScroller = <HTMLElement>el.closest('.tile-scroller');
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
        if (isBefore == isAfter)
            return;

        if (isBefore) {
            tileScroller.scrollBy({ left: elStart - tileScrollerStart, behavior: 'smooth' });
        }
        else {
            tileScroller.scrollBy({ left: elEnd - tileScrollerEnd, behavior: 'smooth' });
        }
    }

    //#endregion

    //#region show/hide

    private _historyStep: HueHistoryStep | undefined;

    /**
     * Insert and renders this dialog into <home-assistant>.
     */
    public show(): void {
        if (this._isRendered)
            throw new Error('Already rendered!');

        // open with history
        this._historyStep = new HueHistoryStep(
            () => this.showInternal(),
            () => this.close(),
            HueDialog.ElementName
        );
        HueHistoryStateManager.instance.addStep(this._historyStep);
    }

    private showInternal() {
        this._isRendered = true;

        // try to render ha-dialog as open
        const haDialog = this.getDialogElement();
        if (haDialog) {
            haDialog.open = true;
        }

        // append to DOM
        const haDom = document.getElementsByTagName('home-assistant');
        const haRoot = haDom.length ? haDom[0].shadowRoot : null;
        if (haRoot) {
            haRoot.appendChild(this);
        }
        else {
            document.body.appendChild(this);
        }

        // register update delegate
        this._ctrl.registerOnPropertyChanged(this._elementId, (p) => this.onLightControllerChanged(p));
    }

    public close(): void {
        if (!this._isRendered)
            return;

        // try to find dialog
        const haDialog = this.getDialogElement();
        if (haDialog) {
            // if dialog closed - will call onDialogClose event
            haDialog.close();
        }
        else {
            // no haDialog found - use legacy way
            this.onDialogClose();
        }
    }

    private getDialogElement(): HaDialog | null {
        if (!this._isRendered || !this.renderRoot)
            return null;

        return this.renderRoot.querySelector('ha-dialog');
    }

    /** When the dialog is closed. Removes itself from the DOM. */
    private onDialogClose() {
        if (this._isRendered) {
            this.remove();

            // unregister update delegate
            this._ctrl.unregisterOnPropertyChanged(this._elementId);

            this._isRendered = false;
        }

        // go back in history
        if (this._historyStep) {
            HueHistoryStateManager.instance.goBefore(this._historyStep);
        }
    }

    //#endregion

    /**
     * Default ha-dialog styles from HA.
     * See https://github.com/home-assistant/frontend/blob/dev/src/resources/styles.ts
     */
    private static haStyleDialog = css`
    /* mwc-dialog (ha-dialog) styles */
    ha-dialog {
      --mdc-dialog-min-width: 400px;
      --mdc-dialog-max-width: 600px;
      --mdc-dialog-heading-ink-color: var(--primary-text-color);
      --mdc-dialog-content-ink-color: var(--primary-text-color);
      --justify-action-buttons: space-between;
    }
    ha-dialog .form {
      color: var(--primary-text-color);
    }
    a {
      color: var(--primary-color);
    }
    /* make dialog fullscreen on small screens */
    @media all and (max-width: 450px), all and (max-height: 500px) {
      ha-dialog {
        --mdc-dialog-min-width: calc(
          100vw - env(safe-area-inset-right) - env(safe-area-inset-left)
        );
        --mdc-dialog-max-width: calc(
          100vw - env(safe-area-inset-right) - env(safe-area-inset-left)
        );
        --mdc-dialog-min-height: 100%;
        --mdc-dialog-max-height: 100%;
        --vertical-align-dialog: flex-end;
        --ha-dialog-border-radius: 0px;
      }
    }
    mwc-button.warning {
      --mdc-theme-primary: var(--error-color);
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
            css`
    /* hiding controls when light detail is open */
    .detail-hide {
        transition:${unsafeCSS(Consts.TransitionDefault)};
    }

    .hue-hidden {
        opacity: 0;
        pointer-events: none;
    }

    /* icon centering */
    .mdc-icon-button i,
    .mdc-icon-button svg,
    .mdc-icon-button img,
    .mdc-icon-button ::slotted(*){
        height:auto;
    }

    /* same color header */
    .hue-heading {
        --hue-heading-text-color: var(--hue-text-color, ${unsafeCSS(Consts.ThemeDialogHeadingColorVar)});
        color:var(--hue-heading-text-color);
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
    ha-dialog-header {
        --mdc-theme-on-primary: var(--hue-heading-text-color);
        --mdc-theme-primary: transparent;
        flex-shrink: 0;
        display: block;
    }
    .hue-heading ha-switch {
        padding: 12px;
        margin: 4px 0;
    }
    .hue-heading .brightness-slider {
        width: 100%;
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
        font-family: var(--paper-font-title_-_font-family);
        -webkit-font-smoothing: var( --paper-font-title_-_-webkit-font-smoothing );
        font-size: var(--paper-font-subhead_-_font-size);
        font-weight: var(--paper-font-title_-_font-weight);
        letter-spacing: var(--paper-font-title_-_letter-spacing);
        line-height: var(--paper-font-title_-_line-height);
    }

    .content {
        outline: none;
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
            width: calc(100% - ${2 * this.haPadding}px);
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
            const surface = dialogShadowRoot && <HTMLElement>dialogShadowRoot.querySelector('.mdc-dialog__surface');

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

                    // action for show and hide
                    detailElement.addEventListener('show', () => {
                        this.toggleUnderDetailControls(true);
                    });
                    detailElement.addEventListener('hide', () => {
                        this.toggleUnderDetailControls(false);
                        this.hideLightDetail();
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
        }

        // ## Heading styles
        const heading = <Element>this.renderRoot.querySelector('.hue-heading');
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
    }

    protected override render() {
        this._isRendered = true;

        // inspiration: https://github.com/home-assistant/frontend/blob/dev/src/dialogs/more-info/ha-more-info-dialog.ts

        const cardTitle = this._config.getTitle(this._ctrl).resolveToString(this._ctrl.hass);
        const mdiClose = 'mdi:close';

        const onChangeCallback = () => {
            this.requestUpdate();
            this.updateStylesInner(false);
        };

        /*eslint-disable */
        return html`
        <ha-dialog
          open
          @closed=${() => this.onDialogClose()}
          .heading=${cardTitle}
          hideActions
        >
          <ha-dialog-header slot="heading" class="hue-heading detail-hide">
            <ha-icon-button
              slot="navigationIcon"
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
              ${ViewUtils.createSwitch(this._ctrl, onChangeCallback, this._config.switchOnScene)}
            </div>
            ${ViewUtils.createSlider(this._ctrl, this._config, onChangeCallback)}
          </ha-dialog-header>
          <div class="${classMap({
            'content': true,
            'detail-active': !!this._selectedLight
        })}" tabindex="-1" dialogInitialFocus>
            <div class='header detail-hide'>
                <div class='title'>${this._config.scenes.length ? localize(this._ctrl.hass, "dialog.scenes") : nothing}</div>
            </div>
            <div class='tile-scroller scene-tiles detail-hide'>
                <div class='tiles'>
                    ${(this._config.scenes.map((s, i) => i % 2 == 1 ? nothing :
            html`<${unsafeStatic(HueDialogSceneTile.ElementName)}
                            .cardTitle=${cardTitle}
                            .sceneConfig=${s}
                            @activated=${(e: CustomEvent) => this.afterSceneActivated(e)}
                            .hass=${this._ctrl.hass}
                            .actionHandler=${this._actionHandler}>
                        </${unsafeStatic(HueDialogSceneTile.ElementName)}>`))}
                </div>
                <div class='tiles'>
                    ${(this._config.scenes.map((s, i) => i % 2 == 0 ? nothing :
                html`<${unsafeStatic(HueDialogSceneTile.ElementName)}
                            .cardTitle=${cardTitle}
                            .sceneConfig=${s}
                            @activated=${(e: CustomEvent) => this.afterSceneActivated(e)}
                            .hass=${this._ctrl.hass}
                            .actionHandler=${this._actionHandler}>
                        </${unsafeStatic(HueDialogSceneTile.ElementName)}>`))}
                </div>
            </div>

            <div class='header detail-hide'>
                <div class='title'>${localize(this._ctrl.hass, "dialog.lights")}</div>
            </div>
            <div class='tile-scroller light-tiles'>
                <div class='tiles'>
                    ${(this._ctrl.getLights().map((l) =>
                    html`<${unsafeStatic(HueDialogLightTile.ElementName)}
                            .cardTitle=${cardTitle}
                            .lightContainer=${l}
                            .isSelected=${this._selectedLight == l}
                            .isUnselected=${this._selectedLight && this._selectedLight != l}
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
        /*eslint-enable */
    }

    //#region updateStyles hooks

    protected override updated(changedProps: PropertyValues) {
        super.updated(changedProps);

        this.updateStylesInner(false);
    }

    public override connectedCallback(): void {
        super.connectedCallback();

        this.updateComplete.then(() => {
            this.tryCreateBackdropAndLightDetail(true);
            this.updateStylesInner(true);
        });
    }

    //#endregion
}
