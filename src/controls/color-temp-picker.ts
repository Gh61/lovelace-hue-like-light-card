import { LitElement, css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Consts } from '../types/consts';
import { Color } from '../core/colors/color';
import { MousePoint, Point, TouchPoint } from '../types/point';
import { PointerDragHelper } from './pointer-drag-helper';

export type HueColorTempPickerMode = 'color' | 'temp';

/**
 * Color marker used in HueColorTempPicker
 */
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
    public width = 600;

    @property()
    public height = 600;

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
    private _markers = new Array<ColorMarker>();

    protected override firstUpdated(): void {
        this.setupLayers();
        this.drawWheel();
        this.renderMarkers();
    }

    /**
     * Setup everything (get elements + set sizes).
     */
    private setupLayers() {
        this._canvas = <HTMLDivElement>this.renderRoot.querySelector('#canvas');
        this._backgroundLayer = <HTMLCanvasElement>this.renderRoot.querySelector('#backgroundLayer');
        this._interactionLayer = <SVGElement>this.renderRoot.querySelector('#interactionLayer');

        // synchronise width/height coordinates
        this._backgroundLayer.width = this.width;
        this._backgroundLayer.height = this.height;
    }

    /**
     * Draws markers.
     */
    private renderMarkers() {
        const m = new ColorMarker(this._canvas);
        this._markers.push(m);
        this.requestUpdate('_markers');
    }

    /**
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

        /**
         * From X and Y coordinates @returns [length from center, angle in RAD].
         */
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
        max-width: 400px;
        margin: auto;
    }
    #canvas > * {
        display: block;
    }
    #interactionLayer {
        color: white;
        position: absolute;
        width: 100%;
        height: 100%;
        overflow: visible;
    }
    #backgroundLayer {
        width: 100%;

        border-radius: 50%;
        box-shadow: ${unsafeCSS(Consts.HueShadow)}
    }

    .marker {
        fill: currentColor;
        filter: url(#new-shadow);
        transform: scale(2);
        cursor: pointer;
    }
    `;

    protected override render() {
        return html`
        <div id='canvas'>
            <svg id="interactionLayer">
                <defs>
                    <filter id="new-shadow">
                        <feDropShadow dx="0" dy="0.4" stdDeviation="0.5" flood-opacity="1"></feDropShadow>
                    </filter>
                </defs>
                ${this._markers.map(m => m.render())}
            </svg>
            <canvas id="backgroundLayer"></canvas>
        </div>`;
    }

    public override disconnectedCallback() {
        // remove document events
        this._markers.forEach(m => m.removeAllListeners());
    }
}

class ColorMarker {
    private readonly _canvas: HTMLElement;
    private readonly _markerG: SVGGraphicsElement;

    private _color: Color = new Color('cyan');
    private _position: Point = new Point(125, 125);

    public constructor(canvas: HTMLElement) {
        this._canvas = canvas;
        this._markerG = ColorMarker.drawMarker();
        this.makeDraggable();
    }

    public get color() {
        return this._color;
    }
    public set color(val: Color) {
        this._color = val;
        this._markerG.style.color = this.color.toString();
    }

    public get position() {
        return this._position;
    }
    public set position(pos: Point) {
        const radius = this._canvas.clientWidth / 2;
        this._position = ColorMarker.limitCoordinates(pos, radius);

        const offset = this.getMarkerOffset();
        const x = this.position.X - offset.X;
        const y = this.position.Y - offset.Y;

        this._markerG.style.transform = `translate(${x}px,${y}px)`;
    }

    private static limitCoordinates(pointFromTopLeft: Point, radius: number) {
        // get coordinates from center
        const x1 = pointFromTopLeft.X - radius;
        const y1 = pointFromTopLeft.Y - radius;

        const vect1 = Math.abs(Math.sqrt(x1 * x1 + y1 * y1));
        // it's outside - make it inside
        if (vect1 > radius) {
            const coef = radius / vect1;
            const x2 = x1 * coef + radius;
            const y2 = y1 * coef + radius;
            return new Point(x2, y2);
        }

        // it's inside
        return pointFromTopLeft;
    }

    public render() {
        // set properties
        this.color = this.color;
        this.position = this.position;

        return this._markerG;
    }

    /**
     * @returns offset of marker tip (point where color is taken).
     */
    private getMarkerOffset() {
        const rect = this._markerG.getBBox();

        // init fallback
        if (rect.width == 0) {
            rect.width = 32;
            rect.height = 40;
        }

        const x = rect.width / 2;
        const y = rect.height;
        return new Point(x, y);
    }

    // #region Drag

    private _dragHelper: PointerDragHelper;

    private makeDraggable() {
        this._dragHelper = new PointerDragHelper(
            this._markerG,
            (ev) => this.onDragStart(ev),
            (ev) => this.onDrag(ev)
        );
    }

    private _dragOffset?: Point;
    private onDragStart(ev: MouseEvent | TouchEvent) {
        const mousePoint = this.getCanvasMousePoint(ev);
        this._dragOffset = mousePoint.getDiff(this.position);
    }

    private onDrag(ev: MouseEvent | TouchEvent) {
        this.position = this.getCanvasMousePoint(ev, this._dragOffset);
    }

    private getCanvasMousePoint(ev: MouseEvent | TouchEvent, offset?: Point) {
        let point;
        if ('changedTouches' in ev) {
            point = new TouchPoint(ev.changedTouches[0]);
        } else {
            point = new MousePoint(ev);
        }

        let x = point.X - this._canvas.offsetLeft;
        let y = point.Y - this._canvas.offsetTop;
        if (offset) {
            x -= offset.X;
            y -= offset.Y;
        }
        return new Point(x, y);
    }

    public removeAllListeners() {
        this._dragHelper?.removeAllListeners();
    }

    // #endregion

    /**
     * Draws and returns marker element.
     */
    private static drawMarker(): SVGGraphicsElement {
        const g = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'g'
        );

        const m = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path'
        );

        m.setAttribute('class', 'marker');
        m.setAttribute('d', 'M 8,0 C 3.581722,0 0,3.5253169 0,7.8740157 0,13.188976 7,19.192913 7.35,19.448819 L 8,20 8.65,19.448819 C 9,19.192913 16,13.188976 16,7.8740157 16,3.5253169 12.418278,0 8,0 Z');

        g.appendChild(m);

        return g;
    }
}