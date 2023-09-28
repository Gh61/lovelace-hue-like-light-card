import { LitElement, PropertyValues, css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Consts } from '../types/consts';
import { Color } from '../core/colors/color';
import { MousePoint, Point, TouchPoint } from '../types/point';
import { PointerDragHelper } from './pointer-drag-helper';
import { HaIcon } from '../types/types-hass';

export interface IHueColorTempPickerEventDetail {
    marker: HueColorTempPickerMarker;
    mode: HueColorTempPickerMode;
    newColor: Color;
    newTemp: number | null;
}

export type HueColorTempPickerMode = 'color' | 'temp';

/** Uses LocalStorage to save and get already rendered wheels. */
class HueColorWheelCache {
    private static readonly version = 1;

    public static saveWheel(mode: HueColorTempPickerMode, radius: number, canvas: HTMLCanvasElement) {
        const key = this.createKey(mode, radius);
        const dataUrl = canvas.toDataURL(); // we're using dataUrl, because in raw format, the image exceeds localStorage size limit
        try {
            localStorage.setItem(key, dataUrl);
        } catch (e) {
            console.error(e);
        }
    }

    public static tryGetWheel(mode: HueColorTempPickerMode, radius: number) {
        const key = this.createKey(mode, radius);
        try {
            const dataUrl = localStorage.getItem(key) || null;
            if (dataUrl) {
                return {
                    success: true,
                    dataUrl
                };
            }
        } catch (e) {
            console.error(e);
        }

        return {
            success: false,
            dataUrl: null
        };
    }

    private static createKey(mode: HueColorTempPickerMode, radius: number) {
        return `HueColorWheelCache_${mode}${radius}x${radius}v${this.version}`;
    }
}

/**
 * Color and Temp picker.
 */
@customElement(HueColorTempPicker.ElementName)
export class HueColorTempPicker extends LitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-color-temp-picker' + Consts.ElementPostfix;

    private static readonly overRender = 2;
    private static readonly maxWidth = 400;
    private static readonly renderWidthHeight = 600;

    private readonly _ro: ResizeObserver | null;

    public constructor() {
        super();

        // if browser (or test engine) not support ResizeObserver
        if (typeof ResizeObserver == 'undefined') {
            this._ro = null;
        } else {
            this._ro = new ResizeObserver(() => this.onResize());
        }
    }

    @property()
    public mode: HueColorTempPickerMode = 'color';

    @property()
    public tempMin = 2000;

    @property()
    public tempMax = 6500;

    private onResize(): void {
        this._markers.forEach(m => m.refresh());
    }

    // #region Rendering

    private _canvas: HTMLDivElement;
    private _backgroundLayer: HTMLCanvasElement;
    private _interactionLayer: SVGElement;
    private _markers = new Array<HueColorTempPickerMarker>();

    protected override firstUpdated(changedProps: PropertyValues) {
        super.firstUpdated(changedProps);

        this.setupLayers();
        this.drawWheel();
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
        this._backgroundLayer.width = HueColorTempPicker.renderWidthHeight;
        this._backgroundLayer.height = HueColorTempPicker.renderWidthHeight;
    }

    /**
     * Will add new marker to rendering.
     * @returns Reference to the marker (so you can set icon, color, temp, etc. and also get events when something changes)
     */
    public addMarker(): HueColorTempPickerMarker {
        const m = new HueColorTempPickerMarker(this);
        this._markers.push(m);
        this.requestUpdate('_markers');
        return m;
    }

    /**
     * Draws temp or color wheel depending on the selected mode.
     */
    private drawWheel() {
        const ctx = this._backgroundLayer.getContext('2d');
        if (ctx == null)
            throw Error('Cannot create convas context!');

        const radius = HueColorTempPicker.renderWidthHeight / 2;

        let image: ImageData;
        const cacheItem = HueColorWheelCache.tryGetWheel(this.mode, radius);
        if (cacheItem.success) {
            // we have dataUrl, we need to parse them through Image element, then render them to canvas
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = cacheItem.dataUrl!;

        } else {
            image = ctx.createImageData(2 * radius, 2 * radius);
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

            HueColorWheelCache.saveWheel(this.mode, radius, this._backgroundLayer);
        }
    }

    //#region Marker methods

    /**
     * @returns current rendered or expected radius.
     */
    public getRadius(): number {
        let width = this._canvas?.clientWidth;
        if (!width) { // not visible
            width = Math.min(HueColorTempPicker.maxWidth, HueColorTempPicker.renderWidthHeight);
        }

        return width / 2;
    }

    /**
     * @retuns the point on the canvas wich has been touched or clicked.
     * @param offset Use this offset if you want to adjust the result.
     */
    public getCanvasMousePoint(ev: MouseEvent | TouchEvent, offset?: Point) {
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

    //#endregion

    /**
     * Gets color and value of coordinate point depending on selected mode.
     * @param x coordinate X [-radius, radius]
     * @param y coordinate Y [-radius, radius]
     * @param radius Radius of color wheel
     */
    public getColorAndValue(x: number, y: number, radius: number) {
        if (this.mode == 'color') {
            return this.getColorAndHSV(x, y, radius);
        } else if (this.mode == 'temp') {
            return this.getTempAndKelvin(x, y, radius);
        }

        return null;
    }

    private getColorAndHSV(x: number, y: number, radius: number) {
        const [r, phi] = HueColorTempPicker.utils.xy2polar(x, y);

        if (r - HueColorTempPicker.overRender > radius) {
            // skip all (x,y) coordinates that are outside of the circle
            return null;
        }

        // Figure out the starting index of this pixel in the image data array.
        const index = HueColorTempPicker.computeIndex(x, y, radius)[0];

        const deg = HueColorTempPicker.utils.rad2deg(phi);
        const hue = HueColorTempPicker.utils.getHue(deg);
        const saturation = HueColorTempPicker.utils.getSaturation(r, radius);

        const value = HueColorTempPicker.utils.getHSvalue(hue, r, radius);
        const color = Color.hsv2rgb(hue, saturation, value);

        return {
            index: index,
            color: color,
            hsv: [hue, saturation, value]
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
        const kelvin = Math.round(HueColorTempPicker.utils.exponentialScale(n, this.tempMin, this.tempMax));

        const color = Color.hueTempToRgb(kelvin);

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

    /**
     * Gets coordinates (from center) of given kelvin temperature on temp wheel.
     * @param kelvin Color temperature
     * @param radius Radius of color wheel
     * @param currentCoordinates Actual coordinates on wheel. (May be used for setting the marker close to it.)
     */
    public getCoordinatesAndTemp(kelvin: number, radius: number, currentCoordinates?: Point) {
        if (kelvin < this.tempMin)
            kelvin = this.tempMin;
        else if (kelvin > this.tempMax)
            kelvin = this.tempMax;

        const rowLength = 2 * radius;
        const n = HueColorTempPicker.utils.invertedExponentialScale(kelvin, this.tempMin, this.tempMax);
        const adjustedY = n * rowLength;
        let y = adjustedY - radius;

        // clean y
        y = Math.round(y);

        // easiest X is in the middle (full range)
        let x = 0;

        if (currentCoordinates) {
            // currentCoordinates is passed, try to find valid X closest to given coords
            // get min and max possible X for given Y
            const maxX = Math.ceil(Math.sqrt(radius * radius - y * y));
            const minX = -maxX;

            // limit x in range [minX, maxX]
            x = currentCoordinates.X;
            if (x < minX)
                x = minX;
            else if (x > maxX)
                x = maxX;
        }

        const color = Color.hueTempToRgb(kelvin);

        return {
            position: new Point(x, y),
            color: color
        };
    }

    /**
     * Gets coordinates (from center) of given HSV color on color wheel.
     * @param hue Hue value of color
     * @param saturation Saturation value of color
     * @param radius Radius of color wheel
     */
    public getCoordinatesAndColor(hue: number, saturation: number, radius: number) {

        const deg = HueColorTempPicker.utils.getDeg(hue);
        const phi = HueColorTempPicker.utils.deg2rad(deg);
        const r = HueColorTempPicker.utils.getR(saturation, radius);
        let [x, y] = HueColorTempPicker.utils.polar2xy(r, phi);

        // clean x and y values
        y = Math.round(y);
        x = Math.round(x);

        const value = HueColorTempPicker.utils.getHSvalue(hue, r, radius);
        const color = Color.hsv2rgb(hue, saturation, value);

        return {
            position: new Point(x, y),
            color: color
        };
    }

    private static utils = {
        /**
         * Returns value in range from @param min to @param max with exponential distribution.
         * Starting slower than linear, ending faster.
         * @param t normalized value 0 - 1
         * @param min Minimal returned value
         * @param max Maximal returned value
         */
        exponentialScale: function (t: number, min: number, max: number): number {
            return Math.pow(max / min, t) * min;
        },
        /**
         * Returns reverse value to fcion exponentialScale - normalized value 0 - 1 with position of y on scale from @param min to @param max.
         * @param y Value in range from @param min to @param max with exponential distribution
         * @param min Minimal given value
         * @param max Maximal given value
         */
        invertedExponentialScale: function (y: number, min: number, max: number): number {
            return Math.log(y / min) / Math.log(max / min);
        },

        /**
         * Returns value in range from @param min to @param max with logarithmical distribution.
         * Starting faster than linear, ending slower.
         * @param t normalized value 0 - 1
         * @param min Minimal returned value
         * @param max Maximal returned value
         * @param logStart <0.01 - 1> to start later on the log curve (the closer to 0 the steeper the curve).
         */
        logarithmicScale: function (t: number, min: number, max: number, logStart = 0.10): number {
            const range = 10000000; // precision
            const logMove = range * logStart;
            const logMoveValue = logMove > 1 ? Math.log(logMove - 1) : 0;
            const scaledT = t * range + logMove;
            const scalingFactor = (max - min) / (Math.log(range + logMove) - logMoveValue);
            return scalingFactor * (Math.log(scaledT) - logMoveValue) + min;
        },
        /**
         * Returns reverse value to fcion logarithmicScale - normalized value 0 - 1 with position of y on scale from @param min to @param max.
         * @param y Value in range from @param min to @param max with logarithmical distribution
         * @param min Minimal given value
         * @param max Maximal given value
         * @param logStart <0.01 - 1> to start later on the log curve (the closer to 0 the steeper the curve).
         */
        invertedLogarithmicScale: function (value:number, min:number, max:number, logStart = 0.10) {
            const range = 10000000; // Precision
            const logMove = range * logStart;
            const logMoveValue = logMove > 1 ? Math.log(logMove - 1) : 0;
          
            // Solve for scaledT by rearranging the original formula
            const scaledT = Math.exp((value - min) / ((max - min) / (Math.log(range + logMove) - logMoveValue)) + logMoveValue);
          
            // Solve for t by reversing the scaling
            const t = (scaledT - logMove) / range;
          
            return t;
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
        polar2xy: function (r: number, phi: number): [number, number] {
            const x = r * Math.cos(phi);
            const y = r * Math.sin(phi);
            return [x, y];
        },

        /**
         * @param rad in [-π, π] range
         * @returns degree in [0, 360] range
         */
        rad2deg: function (rad: number) {
            return ((rad + Math.PI) / (2 * Math.PI)) * 360;
        },
        deg2rad: function (deg: number): number {
            return (deg / 360) * 2 * Math.PI - Math.PI;
        },

        getHue: function (deg: number) {
            // rotate to Hue position
            deg -= 70;
            if (deg < 0)
                deg += 360;

            return deg;
        },
        getDeg: function (hue: number) {
            hue += 70;
            if (hue > 360)
                hue -= 360;

            return hue;
        },

        getSaturation: function (r: number, radius: number) {
            const exp = 1.9;
            const saturation = Math.pow(r, exp) / Math.pow(radius, exp);
            return saturation > 1 ? 1 : saturation;
        },
        getR: function (saturation: number, radius: number) {
            const exp = 1.9;
            const r = Math.pow(saturation * Math.pow(radius, exp), 1 / exp);
            return r;
        },

        getHSvalue: function (hue: number, r: number, radius: number) {
            let value = 0.95;
            value = HueColorTempPicker.utils.fixHSValue(value, r, radius, hue, 60, true);
            value = HueColorTempPicker.utils.fixHSValue(value, r, radius, hue, 180, true);
            value = HueColorTempPicker.utils.fixHSValue(value, r, radius, hue, 240, false);
            value = HueColorTempPicker.utils.fixHSValue(value, r, radius, hue, 300, true);
            return value > 1 ? 1 : value;
        },
        fixHSValue: function (value: number, r: number, radius: number, hue: number, fixPoint: number, lower: boolean, maxOffset = 5) {
            const precondition = lower
                ? r > (radius / 2)
                : r < (3 * radius / 4) && r > (radius / 4);

            if (precondition && hue >= (fixPoint - maxOffset) && hue <= (fixPoint + maxOffset)) {
                let offset = fixPoint - hue;
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

            return value;
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
        max-width: ${HueColorTempPicker.maxWidth}px;
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
    }
    .icon {
        transform: scale(1.2) translate(8px, 8px);
        transition: ${unsafeCSS(Consts.TransitionDefault)};
        fill: white;
    }
    .gm.boing {
        animation: boing 150ms ease-in-out;
    }
    .marker, .icon{
        cursor: pointer;
    }

    @keyframes boing {
        0% {
            scale:0.9;
        }
        50% {
            scale:1;
            translate: 0 -5px;
        }
        100% {
            scale:1;
        }
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

    public override connectedCallback(): void {
        super.connectedCallback();
        this._ro?.observe(this);
        this.onResize();

        this._markers.forEach(m => m.connectAllListeners());
    }

    public override disconnectedCallback() {
        super.disconnectedCallback();
        this._ro?.unobserve(this);

        // remove document events
        this._markers.forEach(m => m.removeAllListeners());
    }
}

export class HueColorTempPickerMarker {
    private readonly _parent: HueColorTempPicker;
    private readonly _markerG: SVGGraphicsElement;
    private readonly _iconPath: SVGPathElement;

    private _color: Color = new Color(0, 0, 0);
    private _temp = 0;
    private _position: Point;
    private _mode: HueColorTempPickerMode = 'color';
    private _icon: string = HueColorTempPickerMarker.defaultIconName;
    private _isOff = false;

    private static readonly defaultIconName = 'default';
    private static readonly defaultIcon = 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z';

    public constructor(parent: HueColorTempPicker) {
        this._parent = parent;
        [this._markerG, this._iconPath] = HueColorTempPickerMarker.drawMarker();
        this.position = new Point(this.getRadius() * 0.3, this.getRadius() * 0.6);
        this.makeDraggable();
    }

    private getRadius() {
        return this._parent.getRadius();
    }

    private dispatchChangeEvent(immediate: boolean) {
        const type = immediate ? 'immediate-value-change' : 'change';
        this._parent.dispatchEvent(new CustomEvent<IHueColorTempPickerEventDetail>(type, {
            detail: {
                marker: this,
                mode: this.mode,
                newColor: this._color,
                newTemp: this.mode == 'temp' ? this.temp : null
            }
        }));
    }

    public boing() {
        const normalClass = 'gm';
        const boingClass = 'gm boing';
        this._markerG.setAttribute('class', boingClass);
        setTimeout(() => {
            this._markerG.setAttribute('class', normalClass);
        }, 200); // animation takes 150ms, 
    }

    private get position() {
        return this._position;
    }
    private set position(pos: Point) {

        // if is position from mousemove - turn on
        if (this._dragHelper?.isMoving) {
            this._isOff = false;
        }

        const radius = this.getRadius();
        this._position = HueColorTempPickerMarker.limitCoordinates(pos, radius);

        // refresh position of marker
        this.renderPosition();

        // Get color and value from parent
        const centerPos = this.getPositionFromCenter(radius);
        const colorAndValue = this._parent.getColorAndValue(
            centerPos.X,
            centerPos.Y,
            radius);

        if (colorAndValue) {
            if ('hsv' in colorAndValue) {
                const [hue, saturation, value] = colorAndValue.hsv;
                this._color = new Color(hue, saturation, value, 1, 'hsv');
            } else {
                const [red, green, blue] = colorAndValue.color;
                this._color = new Color(red, green, blue);
            }
            this.renderColor();

            this.mode = this._parent.mode;

            // save temp, if given
            if ('kelvin' in colorAndValue) {
                this._temp = colorAndValue.kelvin;
            }

            this.dispatchChangeEvent(true);
        }
    }
    private setPositionFromCenter(posCenter: Point, radius: number) {
        const newPos = new Point(
            posCenter.X + radius,
            posCenter.Y + radius
        );
        this._position = HueColorTempPickerMarker.limitCoordinates(newPos, radius);
        this.renderPosition();
    }
    private getPositionFromCenter(radius: number | null = null) {
        radius = radius ?? this.getRadius();
        return new Point(
            this._position.X - radius,
            this._position.Y - radius
        );
    }

    public get mode() {
        return this._mode;
    }
    private set mode(mod: HueColorTempPickerMode) {
        this._mode = mod;
        this.renderMode();
    }

    /**
     * Will refresh position and then render all values.
     */
    public refresh() {
        if (this.mode == 'temp') {
            this.temp = this.temp;
        } else {
            this.color = this.color;
        }
    }

    /** Gets or sets whether light with this marker is currently off. */
    public get isOff() {
        return this._isOff;
    }
    public set isOff(value: boolean) {
        this._isOff = value;
        this.renderColor();
    }

    public get color() {
        return this._color;
    }
    public set color(col: Color | string) {
        if (typeof col == 'string') {
            col = new Color(col);
        }

        // set and render color
        this._color = col;
        this.renderColor();

        // change mode to color
        this.mode = 'color';

        // get position of marker:
        const radius = this.getRadius();
        const coordsAndColor = this._parent.getCoordinatesAndColor(col.getHue(), col.getSaturation(), radius);

        // set and render position
        this.setPositionFromCenter(coordsAndColor.position, radius);
    }

    public get temp() {
        return this._temp;
    }
    public set temp(tmp: number) {
        this._temp = tmp;

        const wasColorMode = this.mode == 'color';

        // change mode to temp
        this.mode = 'temp';

        // get position (and color) of marker
        const radius = this.getRadius();
        const centerPos = this.getPositionFromCenter(radius);
        const coordsAndColor = this._parent.getCoordinatesAndTemp(this._temp, radius, wasColorMode ? undefined : centerPos);

        // set and render position 
        this.setPositionFromCenter(coordsAndColor.position, radius);

        // and color
        const [r, g, b] = coordsAndColor.color;
        this._color = new Color(r, g, b);
    }

    public get icon() {
        return this._icon;
    }
    public set icon(ico: string) {
        this._icon = ico;
        this.getIcon(ico).then(path => {
            if (!path) {
                this._icon = HueColorTempPickerMarker.defaultIconName;
                path = HueColorTempPickerMarker.defaultIcon;
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

    // #region Rendering

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

    private renderColor() {
        if (this._isOff) {
            this._markerG.style.color = 'rgb(0,0,0)';
            this._iconPath.style.fill = Consts.LightColor.toString();
        } else {
            this._markerG.style.color = this._color.toString();

            // for temp view I want only one change of foreground in the middle of the wheel
            const luminanceOffset = this.mode == 'temp' ? -25 : 0;
            const foreground = this._color.getForeground(Consts.LightColor, Consts.DarkColor, luminanceOffset);
            this._iconPath.style.fill = foreground.toString();
        }
    }

    private renderMode() {
        this._markerG.style.opacity = this.mode == this._parent.mode ? '1.0' : '0.6';
    }

    private renderPosition() {
        const offset = this.getMarkerOffset();
        const x = this.position.X - offset.X;
        const y = this.position.Y - offset.Y;
        this._markerG.style.transform = `translate(${x}px,${y}px)`;
        this._markerG.style.transformOrigin = `${this.position.X}px ${this.position.Y}px`;
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
            (ev) => this.onDrag(ev),
            () => this.onDragEnd()
        );
    }

    private _dragOffset?: Point;
    private onDragStart(ev: MouseEvent | TouchEvent) {
        const mousePoint = this._parent.getCanvasMousePoint(ev);
        this._dragOffset = mousePoint.getDiff(this.position);
    }

    private onDrag(ev: MouseEvent | TouchEvent) {
        this.position = this._parent.getCanvasMousePoint(ev, this._dragOffset);
    }

    private onDragEnd() {
        this.dispatchChangeEvent(false);
    }

    public connectAllListeners() {
        this._dragHelper?.connectListeners();
    }

    public removeAllListeners() {
        this._dragHelper?.removeAllListeners();
    }

    // #endregion

    /**
     * Draws and returns marker element.
     */
    private static drawMarker(): [SVGGraphicsElement, SVGPathElement] {
        const g = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'g'
        );
        g.setAttribute('class', 'gm');

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
        i.setAttribute('d', this.defaultIcon);

        g.appendChild(m);
        g.appendChild(i);

        return [g, i];
    }

    /**
     * Will check if the given point (coordinates from top left corner) is inside given radius.
     * @returns Given point or updated from inside the radius.
     */
    private static limitCoordinates(pointFromTopLeft: Point, radius: number): Point {
        if (radius <= 0)
            return pointFromTopLeft;

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