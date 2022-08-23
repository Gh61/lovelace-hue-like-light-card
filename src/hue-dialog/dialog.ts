import { html, css, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { cache } from 'lit/directives/cache.js';
import { LightController } from '../core/light-controller';
import { Consts } from '../types/consts';

type Tab = 'colors' | 'scenes';

@customElement(Consts.HueDialogName)
export class HueDialog extends LitElement {

    /*
    Doc:
    https://material-components.github.io/material-components-web-catalog/#/component/dialog
    */

    private _isRendered = false;
    private _lightController:LightController;

    constructor(lightController:LightController) {
        super();

        this._lightController = lightController;
    }

    //#region Tabs

    private static readonly colorsTab:Tab = 'colors';
    private static readonly scenesTab:Tab = 'scenes';
    private static readonly tabs = [ HueDialog.colorsTab, HueDialog.scenesTab ];

    @state()
    private _currTab:Tab = HueDialog.colorsTab;

    private onTabChanged(ev: CustomEvent):void {
        this._currTab = HueDialog.tabs[<number>ev.detail.index];

        // TODO: not working render
    }

    //#endregion

    //#region show/hide

    /**
     * Insert and renders this dialog into <home-assistant>.
     */
    public show(): void {
        if (this._isRendered)
            throw new Error('Already rendered!');

        // append to DOM
        document.body.appendChild(this);
    }

    /** When the dialog is closed. Removes itself from the DOM. */
    private onDialogClose() {
        if (this._isRendered) {
            this.remove();
        }
    }

    //#endregion

    static get styles() {
        return css`
        /* icon centering */
        .mdc-icon-button i,
        .mdc-icon-button svg,
        .mdc-icon-button img,
        .mdc-icon-button ::slotted(*){
            height:auto;
        }

        /* same color header */
        ha-header-bar {
            --mdc-theme-on-primary: var(--primary-text-color);
            --mdc-theme-primary: var(--mdc-theme-surface);
            flex-shrink: 0;
            display: block;
        }
        `;
    }

    protected render() {
        this._isRendered = true;

        // inspiration: https://github.com/home-assistant/frontend/blob/dev/src/dialogs/more-info/ha-more-info-dialog.ts

        const name = 'Test header';
        const mdiClose = 'mdi:close';

        /*eslint-disable */
        return html`
        <ha-dialog
          open
          @closed=${this.onDialogClose}
          .heading=${name}
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
                .title=${name}
              >
                ${name}
              </div>
            </ha-header-bar>
            ${HueDialog.tabs.length > 1
              ? html`
                  <mwc-tab-bar
                  .activeIndex=${HueDialog.tabs.indexOf(this._currTab)}
                  @MDCTabBar:activated=${this.onTabChanged}
                  >
                  ${HueDialog.tabs.map(
                      (tab) => html`
                      <mwc-tab
                          .label=${tab}
                      ></mwc-tab>
                      `
                  )}
                  </mwc-tab-bar>
            `
            : ''}
          </div>
          <div class="content" tabindex="-1" dialogInitialFocus>
            ${cache(
              this._currTab === HueDialog.scenesTab
                ? html`
                    <h3>Here for SCENES</h3>
                  `
                : html`
                    <h3>Here for Colors</h3>
                  `
            )}
          </div>
        </ha-dialog>
        `;
        /*eslint-enable */
    }
}