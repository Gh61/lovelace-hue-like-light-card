import { customElement, property } from 'lit/decorators.js';
import { html, unsafeStatic } from 'lit/static-html.js';
import { IdLitElement } from '../core/id-lit-element';
import { Consts } from '../types/consts';
import { PropertyValues, css, unsafeCSS } from 'lit';
import { HueBrightnessRollup, IRollupValueChangeEventDetail } from './brightness-rollup';
import { HueColorTempPicker, HueColorTempPickerMarker, IHueColorTempPickerEventDetail } from './color-temp-picker';
import { LightContainer } from '../core/light-container';

/*
 * TODO:
 * - disabled brightness control when light is off
 * - hide (brightness, color, temp) controls when light doesn't support it
 * - color/temp picker mode changer
 * - bind light to marker
 * - closing the colorpicker (back button or ESC)
 */

@customElement(HueLightDetail.ElementName)
export class HueLightDetail extends IdLitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-light-detail' + Consts.ElementPostfix;
    private static readonly colorPickerMargin = 12;

    private _colorPicker: HueColorTempPicker;
    private _colorMarker: HueColorTempPickerMarker;

    public constructor() {
        super('HueLightDetail');

        this.hide(true);
    }

    @property() public lightContainer: LightContainer | null = null;

    /**
     * Called after new lightContainer is set.
     */
    private onLightContainerChanged() {
        if (!this.lightContainer)
            return;

        // TODO: light features

        this._colorMarker.icon = this.lightContainer.getIcon() || Consts.DefaultOneIcon;
        if (this.lightContainer.isColorModeColor()) {
            this._colorPicker.mode = 'color';
            if (this.lightContainer.color) {
                this._colorMarker.color = this.lightContainer.color;
            }
        } else if (this.lightContainer.isColorModeTemp()) {
            this._colorPicker.mode = 'temp';
            if (this.lightContainer.colorTemp) {
                this._colorMarker.temp = this.lightContainer.colorTemp;
            }
        }
    }

    /** Will show this element (with animation). */
    public show() {
        this.style.removeProperty('display');
        setTimeout(() => this.classList.add('visible'));
        this.updateColorPickerSize();

        // to allow the color marker to overflow parent div
        if (this.parentElement) {
            this.parentElement.style.overflow = 'visible';
        }
    }

    /** Will hide this element (with animation). */
    public hide(instant = false) {
        this.classList.remove('visible');
        if (instant) {
            this.style.display = 'none';
        } else {
            setTimeout(() => {
                this.style.display = 'none';
            }, 300);
        }

        // remove temporary overflow allowing
        if (this.parentElement) {
            this.parentElement.style.overflow = '';
        }
    }

    private brightnessValueChanged(ev: CustomEvent<IRollupValueChangeEventDetail>) {
        if (this.lightContainer) {
            this.lightContainer.brightnessValue = ev.detail.newValue;
        }
    }

    protected override updated(changedProps: PropertyValues<HueLightDetail>): void {
        // register for changes on light
        if (changedProps.has('lightContainer')) {
            const oldValue = changedProps.get('lightContainer') as LightContainer | null;
            if (oldValue) {
                oldValue.unregisterOnPropertyChanged(this._id);
            }
            if (this.lightContainer) {
                this.lightContainer.registerOnPropertyChanged(this._id, () => this.requestUpdate());
                this.onLightContainerChanged();
            }
        }
    }

    public static override styles = css`
    :host {
        margin-top: -30px;
        opacity: 0;
        transition:${unsafeCSS(Consts.TransitionDefault)};
    }
    :host(.visible) {
        margin-top: 0;
        opacity: 1;
    }

    .color-picker {
        display: block;
        margin: ${HueLightDetail.colorPickerMargin}px auto;
    }
    .brightness-picker {
        position: absolute;
        bottom: 10px;
        right: 10px;
    }
    `;

    private _lastRenderedContainer: LightContainer | null;
    protected override render() {
        this._lastRenderedContainer = this.lightContainer || this._lastRenderedContainer;
        const value = this._lastRenderedContainer?.brightnessValue || 100;

        return html`
        <div>
            <${unsafeStatic(HueColorTempPicker.ElementName)} class='color-picker'
                mode='color'
            >
            </${unsafeStatic(HueColorTempPicker.ElementName)}>
            <${unsafeStatic(HueBrightnessRollup.ElementName)} class='brightness-picker'
                width='60'
                height='40'
                .value=${value}
                @change=${(ev: CustomEvent) => this.brightnessValueChanged(ev)}
            >
            </${unsafeStatic(HueBrightnessRollup.ElementName)}>
        </div>`;
    }

    protected override firstUpdated(changedProps: PropertyValues) {
        super.firstUpdated(changedProps);

        this._colorPicker = <HueColorTempPicker>this.renderRoot.querySelector('.color-picker');
        this._colorMarker = this._colorPicker.addMarker();

        const listener = (ev: CustomEvent<IHueColorTempPickerEventDetail>) => {
            console.log(ev.detail.mode + ' changed to ' + (ev.detail.newTemp ?? ev.detail.newColor));
        };
        this._colorPicker.addEventListener('change', <EventListenerOrEventListenerObject>listener);
    }

    private updateColorPickerSize(): void {
        const colorPicker = <HueColorTempPicker>this.renderRoot.querySelector('.color-picker');
        const maxSize = Math.min(this.clientHeight, this.clientWidth);
        if (maxSize == 0) // not rendered
            return;
        const size = maxSize - 2 * HueLightDetail.colorPickerMargin;
        colorPicker.style.width = size + 'px';
        colorPicker.style.height = size + 'px';
    }
}