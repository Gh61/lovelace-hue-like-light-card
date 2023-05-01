import { LitElement, PropertyValues, css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Consts } from '../types/consts';
import { Color } from '../core/colors/color';
import { MousePoint, Point, TouchPoint } from '../types/point';
import { PointerDragHelper } from './pointer-drag-helper';
import { HaIcon } from '../types/types-hass';

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

    protected override updated(_changedProperties: PropertyValues<HueColorTempPicker>): void {
        if (_changedProperties.has('mode') && _changedProperties.get('mode')) {
            this.drawWheel();
        }
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
        const m = new ColorMarker(this, this._canvas);
        this._markers.push(m);
        this.requestUpdate('_markers');
    }

    /**
     * Draws temp or color wheel depending on the selected mode.
     */
    private drawWheel() {
        const ctx = this._backgroundLayer.getContext('2d');
        if (ctx == null)
            throw Error('Cannot create convas context!');

        const radius = Math.min(this.width, this.height) / 2;

        const image = ctx.createImageData(2 * radius, 2 * radius);
        const data = image.data;

        for (let x = -radius; x < radius; x++) {
            for (let y = -radius; y < radius; y++) {

                const colorAndValue = this.getColorAndValue(x, y, radius);
                if (!colorAndValue)
                    continue;

                const [red, green, blue] = colorAndValue.color;
                const alpha = 255;

                data[colorAndValue.index] = red;
                data[colorAndValue.index + 1] = green;
                data[colorAndValue.index + 2] = blue;
                data[colorAndValue.index + 3] = alpha;
            }
        }

        ctx.putImageData(image, 0, 0);
    }

    /**
     * Gets color and value of coordinate point depending on selected mode.
     * @param x coordinate X [-radius, radius]
     * @param y coordinate Y [-radius, radius]
     * @param radius Radius of circle
     */
    public getColorAndValue(x: number, y: number, radius: number) {
        if (this.mode == 'color') {
            return this.getColorAndHS(x, y, radius);
        } else if (this.mode == 'temp') {
            return this.getTempAndKelvin(x, y, radius);
        }

        return null;
    }

    private getColorAndHS(x: number, y: number, radius: number) {
        const [r, phi] = HueColorTempPicker.utils.xy2polar(x, y);

        if (r - HueColorTempPicker.overRender > radius) {
            // skip all (x,y) coordinates that are outside of the circle
            return null;
        }

        let deg = HueColorTempPicker.utils.rad2deg(phi);

        // rotate to Hue position
        deg -= 70;
        if (deg < 0)
            deg += 360;

        // Figure out the starting index of this pixel in the image data array.
        const index = HueColorTempPicker.computeIndex(x, y, radius)[0];

        const hue = deg;
        const exp = 1.9;
        let saturation = Math.pow(r, exp) / Math.pow(radius, exp);
        // = (r * r) / (radius * radius);
        // saturation = r/radius;

        let value = 0.95;
        [saturation, value] = HueColorTempPicker.utils.fixSaturationAndValue(saturation, value, r, radius, deg, 60, true);
        [saturation, value] = HueColorTempPicker.utils.fixSaturationAndValue(saturation, value, r, radius, deg, 180, true);
        [saturation, value] = HueColorTempPicker.utils.fixSaturationAndValue(saturation, value, r, radius, deg, 240, false);
        [saturation, value] = HueColorTempPicker.utils.fixSaturationAndValue(saturation, value, r, radius, deg, 300, true);

        const color = Color.hsv2rgb(hue, saturation, value);

        return {
            index: index,
            color: color,
            hs: [hue, saturation]
        };
    }

    private getTempAndKelvin(x: number, y: number, radius: number) {
        const [r] = HueColorTempPicker.utils.xy2polar(x, y);

        if (r - HueColorTempPicker.overRender > radius) {
            // skip all (x,y) coordinates that are outside of the circle
            return null;
        }

        // Figure out the starting index of this pixel in the image data array.
        const [index, , adjustedY, rowLength] = HueColorTempPicker.computeIndex(x, y, radius);

        const n = adjustedY / rowLength;
        const kelvin = HueColorTempPicker.utils.logarithmicalScale(n, this.tempMin, this.tempMax);

        const color = HueColorTempPicker.utils.hueTempToRgb(kelvin);

        return {
            index: index,
            color: color,
            kelvin: kelvin
        };
    }

    private static computeIndex(x: number, y: number, radius: number) {
        const rowLength = 2 * radius;
        const adjustedX = x + radius; // convert x from [-50, 50] to [0, 100] (the coordinates of the image data array)
        const adjustedY = y + radius; // convert y from [-50, 50] to [0, 100] (the coordinates of the image data array)
        const pixelWidth = 4; // each pixel requires 4 slots in the data array
        const index = (adjustedX + (adjustedY * rowLength)) * pixelWidth;

        return [index, adjustedX, adjustedY, rowLength];
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
        cursor: pointer;
    }
    .icon {
        transform: scale(1.5) translate(4px, 4px);
        fill: white;
    }
    `;

    protected override render() {
        return html`
        <div id='canvas'>
            <svg id="interactionLayer">
                <defs>
                    <filter id="new-shadow">
                        <feDropShadow dx="0" dy="1.0" stdDeviation="2.0" flood-opacity="1"></feDropShadow>
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
    private readonly _parent: HueColorTempPicker;
    private readonly _canvas: HTMLElement;
    private readonly _markerG: SVGGraphicsElement;
    private readonly _iconPath: SVGPathElement;

    private _color: Color = new Color('black');
    private _position: Point;
    private _mode: HueColorTempPickerMode = 'color';
    private _icon: string = ColorMarker.DefaultIconName;

    private static readonly DefaultIconName = 'default';
    private static readonly DefaultIcon = 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z';

    public constructor(parent: HueColorTempPicker, canvas: HTMLElement) {
        this._parent = parent;
        this._canvas = canvas;
        this._markerG = ColorMarker.drawMarker();
        this.position = new Point(canvas.clientWidth / 3, 2 * canvas.clientHeight / 3);
        this.makeDraggable();
    }

    public get position() {
        return this._position;
    }
    private set position(pos: Point) {
        const radius = this._canvas.clientWidth / 2;
        this._position = ColorMarker.limitCoordinates(pos, radius);

        // refresh position of marker
        this.renderPosition();

        // Get color and value from parent
        const colorAndValue = this._parent.getColorAndValue(
            this._position.X - radius,
            this._position.Y - radius,
            radius);

        if (colorAndValue) {
            const [red, green, blue] = colorAndValue.color;
            this._color = new Color(red, green, blue);
            this.renderColor();

            this._mode = this._parent.mode;
            this.renderMode();
        }
    }

    public get icon() {
        return this._icon;
    }
    public set icon(ico: string) {
        this._icon = ico;
        this.getIcon(ico).then(path => {
            if (!path) {
                this._icon = ColorMarker.DefaultIconName;
                path = ColorMarker.DefaultIcon;
            }

            // Apply icon
            this._iconPath.setAttribute('d', path);
        });
    }

    private async getIcon(name: string) {
        if (!name)
            return null;

        const iconType = customElements.get('ha-icon');
        if (!iconType)
            return null;

        const haIcon = new iconType() as HaIcon;
        haIcon.icon = name;
        /* eslint-disable no-underscore-dangle */
        await haIcon._loadIcon();
        return haIcon._path;
        /* eslint-enable no-underscore-dangle */
    }

    /**
     * @returns offset of marker tip (point where color is taken).
     */
    private getMarkerOffset() {
        const rect = this._markerG.getBBox();

        // init fallback
        if (rect.width == 0) {
            rect.width = 48;
            rect.height = 60;
        }

        const x = rect.width / 2;
        const y = rect.height;
        return new Point(x, y);
    }

    // #region Rendering

    private renderColor() {
        this._markerG.style.color = this._color.toString();
    }

    private renderMode() {
        this._markerG.style.opacity = this._mode == this._parent.mode ? '1.0' : '0.6';
    }

    private renderPosition() {
        const offset = this.getMarkerOffset();
        const x = this.position.X - offset.X;
        const y = this.position.Y - offset.Y;
        this._markerG.style.transform = `translate(${x}px,${y}px)`;
    }

    /**
     * Will render current state to the returned graphics object.
     */
    public render() {
        // render property dependencies
        this.renderColor();
        this.renderPosition();
        this.renderMode();

        // return marker object
        return this._markerG;
    }

    // #endregion

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
        m.setAttribute('d', 'M 24,0 C 10.745166,0 0,10.575951 0,23.622046 0,39.566928 21,57.578739 22.05,58.346457 L 24,60 25.95,58.346457 C 27,57.578739 48,39.566928 48,23.622046 48,10.575951 37.254834,0 24,0 Z');
        // 48x60 px

        const i = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path'
        );
        i.setAttribute('class', 'icon');
        i.setAttribute('d', this.DefaultIcon);

        g.appendChild(m);
        g.appendChild(i);

        return g;
    }

    /**
     * Will check if the given point (coordinates from top left corner) is inside given radius.
     * @returns Given point or updated from inside the radius.
     */
    private static limitCoordinates(pointFromTopLeft: Point, radius: number): Point {
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
}