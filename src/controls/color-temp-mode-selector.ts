import { LitElement, PropertyValues, css, html, nothing, unsafeCSS } from 'lit';
import { classMap } from 'lit-html/directives/class-map.js';
import { customElement, property } from 'lit/decorators.js';
import { Consts } from '../types/consts';
import { HueColorTempPicker, HueColorTempPickerMode } from './color-temp-picker';
import { ControlResources } from './control-resources';

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
    public mode: HueColorTempPickerMode = 'color';

    @property()
    public showColor = true;

    @property()
    public showTemp = true;

    @property()
    public colorPicker: HueColorTempPicker | null = null;

    protected override updated(changedProps: PropertyValues<HueColorTempModeSelector>): void {
        super.updated(changedProps);

        if (changedProps.has('mode') && this.colorPicker) {
            this.colorPicker.mode = this.mode;
        }
    }

    private static readonly totalHeight = 40;
    private static readonly totalPadding = 6;
    private static readonly wrapperHeight = HueColorTempModeSelector.totalHeight - 2 * HueColorTempModeSelector.totalPadding;
    private static readonly wrapperPadding = 2;
    private static readonly wrapperBorder = 2;
    private static readonly wheelHeight = HueColorTempModeSelector.wrapperHeight - 2 * (HueColorTempModeSelector.wrapperPadding + HueColorTempModeSelector.wrapperBorder);

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
        gap: ${Math.round(HueColorTempModeSelector.wrapperHeight / 3)}px;
        border-radius: ${HueColorTempModeSelector.totalHeight / 2}px;
        box-shadow: ${unsafeCSS(Consts.HueShadow)};
        background: ${unsafeCSS(Consts.TileOffColor)};
    }
    .controls .wheel-wrapper{
        box-sizing: border-box;
        width: ${HueColorTempModeSelector.wrapperHeight}px;
        height: ${HueColorTempModeSelector.wrapperHeight}px;
        padding: ${HueColorTempModeSelector.wrapperPadding}px;
        border-radius: ${HueColorTempModeSelector.wrapperHeight / 2}px;
        border: ${HueColorTempModeSelector.wrapperBorder}px solid transparent;
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
    `;

    protected override render() {
        if (!this.showColor && !this.showTemp)
            return nothing;

        return html`
        <div class='controls'>
            ${this.createWheel('color')}
            ${this.createWheel('temp')}
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