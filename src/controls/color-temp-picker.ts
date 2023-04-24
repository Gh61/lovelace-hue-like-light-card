import { LitElement, css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Consts } from '../types/consts';
import { Color } from '../core/colors/color';

export type HueColorTempPickerMode = 'color' | 'temp';

@customElement(HueColorTempPicker.ElementName)
export class HueColorTempPicker extends LitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-color-temp-picker' + Consts.ElementPostfix;

    private static readonly overRender = 2;

    public constructor() {
        super();
    }

    @property()
    public width = 500;

    @property()
    public height = 500;

    @property()
    public mode: HueColorTempPickerMode = 'color';

    @property()
    public tempMin = 2000;

    @property()
    public tempMax = 6500;

    // #region Rendering

    private _canvas: HTMLDivElement;
    private _backgroundLayer: HTMLCanvasElement;
    private _interactionLayer: SVGElement;

    protected override firstUpdated(): void {
        this.setupLayers();
        this.drawWheel();

        this._interactionLayer.style.color = 'rgb(240,120,60)';
    }

    /**
     * Setup everything (get elements + set sizes).
     */
    private setupLayers() {
        this._canvas = <HTMLDivElement>this.renderRoot.querySelector('#canvas');
        this._backgroundLayer = <HTMLCanvasElement>this.renderRoot.querySelector('#backgroundLayer');
        this._interactionLayer = <SVGElement>this.renderRoot.querySelector('#interactionLayer');

        // coordinate origin position (center of the wheel)
        const originX = this.width / 2;
        const originY = originX;

        // synchronise width/height coordinates
        this._backgroundLayer.width = this.width;
        this._backgroundLayer.height = this.height;
        this._interactionLayer.setAttribute(
            'viewBox',
            `${-originX} ${-originY} ${this.width} ${this.height}`
        );
    }

    /*
     * Draws temp or color wheel depending on the selected mode.
     */
    private drawWheel() {
        if (this.mode == 'temp') {
            this.drawTempWheel();
        } else {
            this.drawColorWheel();
        }
    }

    /**
     * Draws color wheel to background layer.
     */
    private drawColorWheel() {
        const ctx = this._backgroundLayer.getContext('2d');
        if (ctx == null)
            throw Error('Cannot create convas context!');

        const radius = Math.min(this.width, this.height) / 2;

        const image = ctx.createImageData(2 * radius, 2 * radius);
        const data = image.data;

        for (let x = -radius; x < radius; x++) {
            for (let y = -radius; y < radius; y++) {

                const [r, phi] = HueColorTempPicker.utils.xy2polar(x, y);

                if (r - HueColorTempPicker.overRender > radius) {
                    // skip all (x,y) coordinates that are outside of the circle
                    continue;
                }

                let deg = HueColorTempPicker.utils.rad2deg(phi);

                // rotate to Hue position
                deg -= 80;
                if (deg < 0)
                    deg += 360;

                // Figure out the starting index of this pixel in the image data array.
                const rowLength = 2 * radius;
                const adjustedX = x + radius; // convert x from [-50, 50] to [0, 100] (the coordinates of the image data array)
                const adjustedY = y + radius; // convert y from [-50, 50] to [0, 100] (the coordinates of the image data array)
                const pixelWidth = 4; // each pixel requires 4 slots in the data array
                const index = (adjustedX + (adjustedY * rowLength)) * pixelWidth;

                const hue = deg;
                let saturation = (r * r) / (radius * radius);
                // saturation = r/radius;

                let value = 0.95;
                [saturation, value] = HueColorTempPicker.utils.fixSaturationAndValue(saturation, value, r, radius, deg, 60, true);
                [saturation, value] = HueColorTempPicker.utils.fixSaturationAndValue(saturation, value, r, radius, deg, 180, true);
                [saturation, value] = HueColorTempPicker.utils.fixSaturationAndValue(saturation, value, r, radius, deg, 240, false);
                [saturation, value] = HueColorTempPicker.utils.fixSaturationAndValue(saturation, value, r, radius, deg, 300, true);

                const [red, green, blue] = Color.hsv2rgb(hue, saturation, value);
                const alpha = 255;

                data[index] = red;
                data[index + 1] = green;
                data[index + 2] = blue;
                data[index + 3] = alpha;
            }
        }

        ctx.putImageData(image, 0, 0);
    }

    /**
     * Draws color temperature wheel to background layer.
     * Warning: Temp wheel is logarithmic.
     */
    private drawTempWheel() {
        const ctx = this._backgroundLayer.getContext('2d');
        if (ctx == null)
            throw Error('Cannot create convas context!');

        // Easy linear gradient style
        /*
        ctx.clearRect(0, 0, this._backgroundLayer.width, this._backgroundLayer.height);
        this._backgroundLayer.style.background = '-webkit-linear-gradient(bottom, rgb(190,228,243) 0%, white 13%, rgb(255,180,55) 100%)';
        */

        const radius = Math.min(this.width, this.height) / 2;

        const image = ctx.createImageData(2 * radius, 2 * radius);
        const data = image.data;

        for (let x = -radius; x < radius; x++) {
            for (let y = -radius; y < radius; y++) {

                const [r] = HueColorTempPicker.utils.xy2polar(x, y);

                if (r - HueColorTempPicker.overRender > radius) {
                    // skip all (x,y) coordinates that are outside of the circle
                    continue;
                }

                // Figure out the starting index of this pixel in the image data array.
                const rowLength = 2 * radius;
                const adjustedX = x + radius; // convert x from [-50, 50] to [0, 100] (the coordinates of the image data array)
                const adjustedY = y + radius; // convert y from [-50, 50] to [0, 100] (the coordinates of the image data array)
                const pixelWidth = 4; // each pixel requires 4 slots in the data array
                const index = (adjustedX + (adjustedY * rowLength)) * pixelWidth;

                const n = adjustedY / rowLength;
                const kelvin = HueColorTempPicker.utils.logarithmicalScale(n, this.tempMin, this.tempMax);

                const [red, green, blue] = HueColorTempPicker.utils.hueTempToRgb(kelvin);
                //HueColorTempPicker.utils.tempToRgb(kelvin + 700);
                const alpha = 255;

                data[index] = red;
                data[index + 1] = green;
                data[index + 2] = blue;
                data[index + 3] = alpha;
            }
        }

        ctx.putImageData(image, 0, 0);
    }

    private static utils = {
        /**
         * @param t normalized value 0 - 1
         * @param min Minimal returned value
         * @param max Maximal returned value
         */
        logarithmicalScale: function (t: number, min: number, max: number): number {
            return Math.pow(max / min, t) * min;
        },

        /**
         * @param t normalized value 0 - 1
         * @param min Minimal returned value
         * @param max Maximal returned value
         */
        linearScale: function (t: number, min: number, max: number): number {
            return (max - min) * t + min;
        },

        xy2polar: function (x: number, y: number) {
            const r = Math.sqrt(x * x + y * y);
            const phi = Math.atan2(y, x);
            return [r, phi];
        },

        /**
         * @param rad in [-π, π] range
         * @returns degree in [0, 360] range
         */
        rad2deg: function (rad: number) {
            return ((rad + Math.PI) / (2 * Math.PI)) * 360;
        },

        fixSaturationAndValue: function (saturation: number, value: number, r: number, radius: number, deg: number, fixPoint: number, lower: boolean, maxOffset = 5) {
            //return [saturation, value];

            const precondition = lower
                ? r > (radius / 2)
                : r < (3 * radius / 4) && r > (radius / 4);

            if (precondition && deg >= (fixPoint - maxOffset) && deg <= (fixPoint + maxOffset)) {
                let offset = fixPoint - deg;
                if (offset < 0) {
                    offset = - offset;
                }
                offset = maxOffset - offset;
                if (lower) {
                    value -= offset / 360;
                } else {
                    value += offset / 360;
                }
            }

            return [saturation, value];
        },

        hueTempToRgb: function (kelvin: number) {
            const start = 2000;
            const tres = 5300;
            const end = 6500;

            const startRgb = [255, 180, 55];
            const tresRgb = [255, 255, 255];
            const endRgb = [190, 228, 243];

            if (kelvin < start)
                kelvin = start;
            if (kelvin > end)
                kelvin = end;

            if (kelvin < tres) {
                const k = (kelvin - start) / (tres - start); // normalize
                const r1 = this.linearScale(k, startRgb[0], tresRgb[0]);
                const g1 = this.linearScale(k, startRgb[1], tresRgb[1]);
                const b1 = this.linearScale(k, startRgb[2], tresRgb[2]);
                return [r1, g1, b1];
            } else {
                const k = (kelvin - tres) / (end - tres); // normalize
                const r2 = this.linearScale(k, tresRgb[0], endRgb[0]);
                const g2 = this.linearScale(k, tresRgb[1], endRgb[1]);
                const b2 = this.linearScale(k, tresRgb[2], endRgb[2]);
                return [r2, g2, b2];
            }
        }
    };

    // #endregion

    public static override styles = css`
    :host {
        user-select: none;
        -webkit-user-select: none;
    }

    #canvas {
        position: relative;
        width: 100%;
        max-width: 330px;
        margin: auto;
    }
    #canvas > * {
        display: block;
    }
    #interactionLayer {
        color: white;
        position: absolute;
        cursor: crosshair;
        width: 100%;
        height: 100%;
        overflow: visible;
    }
    #backgroundLayer {
        width: 100%;

        border-radius: 50%;
        box-shadow: ${unsafeCSS(Consts.HueShadow)}
    }

    #marker {
        fill: currentColor;
        stroke: white;
        stroke-width: 2;
        filter: url(#marker-shadow);
    }
    `;

    protected override render() {
        return html`
        <div id='canvas'>
            <svg id="interactionLayer">
                <defs>
                    <filter
                    id="marker-shadow"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                    filterUnits="objectBoundingBox"
                    >
                        <feOffset
                            result="offOut"
                            in="SourceAlpha"
                            dx="2"
                            dy="2"
                        ></feOffset>
                        <feGaussianBlur
                            result="blurOut"
                            in="offOut"
                            stdDeviation="2"
                        ></feGaussianBlur>
                        <feComponentTransfer in="blurOut" result="alphaOut">
                            <feFuncA type="linear" slope="0.3"></feFuncA>
                        </feComponentTransfer>
                        <feBlend
                            in="SourceGraphic"
                            in2="alphaOut"
                            mode="normal"
                        ></feBlend>
                    </filter>
                </defs>
                <circle id="marker" r="18" transform="translate(76.33899625105616,72.09270178999559)"></circle>
            </svg>
            <canvas id="backgroundLayer"></canvas>
        </div>`;
    }
}