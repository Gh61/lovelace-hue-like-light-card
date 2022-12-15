import { css, LitElement } from 'lit';
import { html, unsafeStatic } from 'lit/static-html.js';
import { customElement, state } from 'lit/decorators.js';
import { cache } from 'lit/directives/cache.js';
import { Background } from '../core/colors/background';
import { Color } from '../core/colors/color';
import { LightController } from '../core/light-controller';
import { ViewUtils } from '../core/view-utils';
import { HueLikeLightCardConfig } from '../types/config';
import { Consts } from '../types/consts';
import { HueDialogTile } from './dialog-tile';
import { HaDialog } from '../types/types';

type Tab = 'colors' | 'scenes';

@customElement(HueDialog.ElementName)
export class HueDialog extends LitElement {

    /**
     * Name of this Element
     */
    public static readonly ElementName = Consts.CardElementName + '-hue-dialog';

    /*
    Doc:
    https://material-components.github.io/material-components-web-catalog/#/component/dialog
    */

    private _isRendered = false;
    private _config:HueLikeLightCardConfig;
    private _ctrl:LightController;
    private _id:string;

    constructor(config:HueLikeLightCardConfig, lightController:LightController) {
        super();

        this._config = config;
        this._ctrl = lightController;
        this._id = 'HueDialog_' + HueDialog.maxDialogId++;
    }

    //#region Hass changes

    private static maxDialogId = 1;

    private onLightControllerChanged(propertyName:keyof LightController) {
        // when LightController changed - update this
        if (propertyName == 'hass') {
            this.requestUpdate();
        }
    }

    //#endregion

    //#region Tabs

    private static readonly colorsTab:Tab = 'colors';
    private static readonly scenesTab:Tab = 'scenes';
    private static readonly tabs = [ HueDialog.colorsTab, HueDialog.scenesTab ]; //TODO: Remove tabs, use css animation hide of scenes and show of colorpicker

    @state()
    private _currTab = HueDialog.scenesTab;

    //#endregion

    //#region show/hide

    /**
     * Insert and renders this dialog into <home-assistant>.
     */
    public show(): void {
        if (this._isRendered)
            throw new Error('Already rendered!');

        window.history.pushState(
            { dialog: 'hue-dialog', open: true },
            ''
        );
        window.addEventListener('popstate', this._onHistoryBackListener);

        // append to DOM
        document.body.appendChild(this);

        // register update delegate
        this._ctrl.registerOnPropertyChanged(this._id, (p) => this.onLightControllerChanged(p));
    }

    public close(): void {
        if (!this._isRendered)
            return;

        // try to find dialog (if no success, call standard remove)
        const haDialog = <HaDialog>this.renderRoot.querySelector('ha-dialog');
        if (haDialog && haDialog.close) {
            haDialog.close();
        } else {
            this.onDialogClose();
        }
    }

    private readonly _onHistoryBackListener = () => this.close();

    /** When the dialog is closed. Removes itself from the DOM. */
    private onDialogClose() {
        if (this._isRendered) {
            this.remove();

            // unregister popstate
            window.removeEventListener('popstate', this._onHistoryBackListener);

            // unregister update delegate
            this._ctrl.unregisterOnPropertyChanged(this._id);

            this._isRendered = false;
        }
    }

    //#endregion

    /**
     * Default ha-dialog styles from HA.
     * See https://github.com/home-assistant/frontend/blob/dev/src/resources/styles.ts
     */
    static haStyleDialog = css`
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

    private static readonly tileGap = 10;
    private static readonly haPadding = 24;

    static get styles() {
        return [
            HueDialog.haStyleDialog,
            css`
        /* icon centering */
        .mdc-icon-button i,
        .mdc-icon-button svg,
        .mdc-icon-button img,
        .mdc-icon-button ::slotted(*){
            height:auto;
        }

        /* same color header */
        .heading {
            color:var(--hue-text-color);
            background:var(--hue-background);
            box-shadow:var(--hue-box-shadow), 0px 5px 10px rgba(0,0,0,0.5);
            transition:all 0.3s ease-out 0s;

            border-bottom-left-radius: var(--ha-dialog-border-radius, 28px);
            border-bottom-right-radius: var(--ha-dialog-border-radius, 28px);
            padding-bottom: calc(var(--ha-dialog-border-radius, 28px) / 2);

            overflow:hidden;
        }
        ha-header-bar {
            --mdc-theme-on-primary: var(--hue-text-color);
            --mdc-theme-primary: transparent;/*var(--hue-background);*/
            flex-shrink: 0;
            display: block;
        }
        .heading ha-switch {
            margin-right: 10px;
        }
        .heading ha-slider {
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
            margin-bottom: 8px;
        }
        .header .title{
            color: var(--mdc-dialog-content-ink-color);
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
        .tiles {
            display: flex;
            flex-flow: row;
            gap: ${HueDialog.tileGap}px;
            margin-bottom: ${HueDialog.tileGap}px;
        }
        .tiles::after {
            /* Flex loosing right padding, when overflowing */
            content: '';
            min-width: ${HueDialog.haPadding - HueDialog.tileGap}px;
        }
        `];
    }

    private updateStyles(isFirst: boolean): void {
        // default text-color: '--primary-text-color'
        // default background: '--mdc-theme-surface'

        // content text color: '--mdc-dialog-content-ink-color'

        // ## Content styles
        if (isFirst) {
            const configColor = this._config.getHueScreenBgColor();
            let contentBg = null;
            let contentFg = null;
            if (!configColor.isThemeColor()) {
                contentBg = configColor;
                contentFg = contentBg.getForeground(Consts.DialogFgLightColor, Consts.DarkColor, +120); // for most colors use dark

                this.style.setProperty(
                    '--mdc-theme-surface',
                    contentBg.toString()
                );
                this.style.setProperty(
                    '--primary-text-color',
                    contentFg.toString()
                );
            } else {
                this.style.removeProperty('--mdc-theme-surface');
                this.style.removeProperty('--primary-text-color');
            }
        }

        // ## Heading styles
        const heading = <Element>this.renderRoot.querySelector('.heading');

        let offBackground:Background | null;
        // if the user sets custom off color - use it
        if (this._config.wasOffColorSet) {
            const offColor = this._config.getOffColor();
            if (!offColor.isThemeColor()) {
                offBackground = new Background([offColor.getBaseColor()]);
            } else {
                offBackground = null;
            }
        } else {
            offBackground = new Background([new Color(Consts.DialogOffColor)]);
        }

        const bfg = ViewUtils.calculateBackAndForeground(this._ctrl, offBackground, true);
        const shadow = ViewUtils.calculateDefaultShadow(heading, this._ctrl, this._config);

        // when first rendered, clientHeight is 0, so no shadow is genered - plan new update:
        if (!shadow) {
            this.requestUpdate();
        }

        if (this._config.hueBorders) {
            this.style.setProperty(
                '--ha-dialog-border-radius',
                Consts.HueBorderRadius + 'px'
            );
        }

        this.style.setProperty(
            '--hue-background',
            bfg.background?.toString() ?? 'var(--mdc-theme-surface)'
        );
        this.style.setProperty(
            '--hue-box-shadow',
            shadow
        );
        this.style.setProperty(
            '--hue-text-color',
            bfg.foreground?.toString() ?? 'var(--primary-text-color)'
        );
    }

    protected render() {
        this._isRendered = true;

        // inspiration: https://github.com/home-assistant/frontend/blob/dev/src/dialogs/more-info/ha-more-info-dialog.ts

        const cardTitle = this._config.getTitle(this._ctrl).resolveToString(this._ctrl.hass);
        const mdiClose = 'mdi:close';

        const onChangeCallback = () => {
            this.requestUpdate();
            this.updateStyles(false);
        };

        /*eslint-disable */
        return html`
        <ha-dialog
          open
          @closed=${this.onDialogClose}
          .heading=${cardTitle}
          hideActions
        >
          <div slot="heading" class="heading">
            <ha-header-bar>
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
              ${ViewUtils.createSwitch(this._ctrl, onChangeCallback)}
              </div>
            </ha-header-bar>
            ${ViewUtils.createSlider(this._ctrl, this._config, onChangeCallback)}
          </div>
          <div class="content" tabindex="-1" dialogInitialFocus>
            ${cache(
              this._currTab === HueDialog.scenesTab
                ? html`
                    <div class='header'>
                        <div class='title'>${this._config.resources.scenes}</div>
                    </div>
                    <div class='tile-scroller'>
                        <div class='tiles'>
                            ${(this._config.scenes.map((s, i) => i % 2 == 1 ? html`` : html`<${unsafeStatic(HueDialogTile.ElementName)} .cardTitle=${cardTitle} .sceneConfig=${s} .hass=${this._ctrl.hass}></${unsafeStatic(HueDialogTile.ElementName)}>`))}
                        </div>
                        <div class='tiles'>
                            ${(this._config.scenes.map((s, i) => i % 2 == 0 ? html`` : html`<${unsafeStatic(HueDialogTile.ElementName)} .cardTitle=${cardTitle} .sceneConfig=${s} .hass=${this._ctrl.hass}></${unsafeStatic(HueDialogTile.ElementName)}>`))}
                        </div>
                    </div>
                  `
                : html`
                    <h3>Here for Colors</h3>
                  `
            )}
            <!--
            <div class='header'>
                <div class='title'>${this._config.resources.lights}</div>
            </div>
            -->
          </div>
        </ha-dialog>
        `;
        /*eslint-enable */
    }

    //#region updateStyles hooks

    protected firstUpdated() {
        this.updateStyles(true);
    }

    protected updated() {
        this.updateStyles(false);
    }

    //#endregion
}
