import { LitElement, PropertyValues, css, html, nothing, unsafeCSS } from 'lit';
import { classMap } from 'lit-html/directives/class-map.js';
import { cache } from 'lit/directives/cache.js';
import { customElement, property } from 'lit/decorators.js';
import { Consts } from '../types/consts';
import { HueColorTempPicker, HueColorTempPickerMode } from './color-temp-picker';
import { ControlResources } from './control-resources';
import { ViewUtils } from '../core/view-utils';
import { HaIcon } from '../types/types-hass';

export type HueColorTempModeSelectorMode = HueColorTempPickerMode | 'brightness';

/**
 * Mode selector for Color and Temp picker.
 */
@customElement(HueColorTempModeSelector.ElementName)
export class HueColorTempModeSelector extends LitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-color-temp-mode-selector' + Consts.ElementPostfix;

    public constructor() {
        super();
    }

    @property()
    public mode: HueColorTempModeSelectorMode = 'color';

    @property()
    public showColor = true;

    @property()
    public showTemp = true;

    @property()
    public colorPicker: HueColorTempPicker | null = null;

    /**
     * Will select possible mode based on current property settings.
     * Will never select 'brightness mode'.
     */
    public selectPossibleMode() {
        if (this.showColor) {
            this.mode = 'color';
        } else if (this.showTemp) {
            this.mode = 'temp';
        }
    }

    protected override updated(changedProps: PropertyValues<HueColorTempModeSelector>): void {
        super.updated(changedProps);

        if (changedProps.has('mode') && this.colorPicker) {
            if (this.mode == 'color' || this.mode == 'temp') {
                this.colorPicker.mode = this.mode;
            }
        }

        if (changedProps.has('mode') && this.mode == 'brightness') {
            const haIcon = <HaIcon>this.renderRoot.querySelector('.wheel.brightness ha-icon');
            ViewUtils.setIconSize(haIcon, HueColorTempModeSelector.wheelHeight);
        }
    }

    private static readonly wheelHeight = 24; // same as default icon size
    private static readonly wheelSpace = 2;
    private static readonly wheelBorderWidth = 2;
    private static readonly wrapperHeight = HueColorTempModeSelector.wheelHeight + 2 * (HueColorTempModeSelector.wheelSpace + HueColorTempModeSelector.wheelBorderWidth);
    private static readonly totalPadding = 8;
    private static readonly wrapperGap = HueColorTempModeSelector.totalPadding;
    public static readonly totalHeight = HueColorTempModeSelector.wrapperHeight + 2 * HueColorTempModeSelector.totalPadding;

    public static override styles = css`
    :host{
        user-select: none;
        -webkit-user-select: none;
        display:inline-block;
    }
    .controls{
        box-sizing: border-box;
        display: flex;
        height: ${HueColorTempModeSelector.totalHeight}px;
        padding: ${HueColorTempModeSelector.totalPadding}px;
        gap: ${HueColorTempModeSelector.wrapperGap}px;
        border-radius: ${HueColorTempModeSelector.totalHeight / 2}px;
        box-shadow: ${unsafeCSS(Consts.HueShadow)};
        background: ${unsafeCSS(Consts.TileOffColor)};
    }
    .controls .wheel-wrapper{
        box-sizing: border-box;
        width: ${HueColorTempModeSelector.wrapperHeight}px;
        height: ${HueColorTempModeSelector.wrapperHeight}px;
        padding: ${HueColorTempModeSelector.wheelSpace}px;
        border-radius: ${HueColorTempModeSelector.wrapperHeight / 2}px;
        border: ${HueColorTempModeSelector.wheelBorderWidth}px solid transparent;
        cursor: pointer;
    }
    .controls .wheel-wrapper:hover,
    .controls .wheel-wrapper:active{
        background-color: ${unsafeCSS(Consts.TileOffColor)};
    }
    .controls .wheel-wrapper.active{
        border-color: white;
    }
    .controls .wheel-wrapper .wheel{
        display:inline-block;
        width: ${HueColorTempModeSelector.wheelHeight}px;
        height: ${HueColorTempModeSelector.wheelHeight}px;
        border-radius: ${HueColorTempModeSelector.wheelHeight / 2}px;
        background-size: cover;
    }
    .wheel.color{
        background-image: url(${unsafeCSS(ControlResources.ModeColorIcon64)});
    }
    .wheel.temp{
        background-image: url(${unsafeCSS(ControlResources.ModeTempIcon64)});
    }
    .wheel.brightness{
        color: white;
    }
    `;

    protected override render() {
        if (!this.showColor && !this.showTemp && this.mode != 'brightness')
            return nothing;

        return html`
        <div class='controls'>
        ${cache(
        this.mode == 'brightness'
            ? this.createBrightnessWheel()
            : html`
                ${this.createWheel('color')}
                ${this.createWheel('temp')}
            `
    )}
        </div>`;
    }

    private createBrightnessWheel() {
        if (this.mode != 'brightness')
            return nothing;

        const icon = ViewUtils.hasHueIcons() ? 'hue:scene-bright' : 'mdi:brightness-7';

        return html`
        <div class='wheel-wrapper active' @click=${() => this.mode = 'brightness'}>
            <span class='wheel brightness'>
                <ha-icon icon="${icon}"></ha-icon>
            </span>
        </div>`;
    }

    private createWheel(mode: HueColorTempPickerMode) {
        if (mode == 'temp' && !this.showTemp)
            return nothing;
        if (mode == 'color' && !this.showColor)
            return nothing;

        const wrapperClass = {
            'wheel-wrapper': true,
            'active': this.mode == mode
        };

        return html`
        <div class='${classMap(wrapperClass)}' @click=${() => this.mode = mode}>
            <span class='wheel ${mode}'></span>
        </div>`;
    }
}