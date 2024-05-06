import { LitElement, PropertyValues, css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Consts } from '../types/consts';
import { Color } from '../core/colors/color';
import { MousePoint, Point, TouchPoint } from '../types/point';
import { HueColorTempPickerMarker } from './color-temp-picker.marker';
import { removeFrom } from '../types/extensions';

export interface IHueColorTempPickerEventDetail {
    marker: HueColorTempPickerMarker;
    mode: HueColorTempPickerMode;
    newColor: Color;
    newTemp: number | null;
}

export type HueColorTempPickerMode = 'color' | 'temp';

/** Uses LocalStorage to save and get already rendered wheels. */
class HueColorWheelCache {
    // version 2 - revised function to distribute kelvin values across the temp wheel
    private static readonly version = 2;

    public static saveWheel(mode: HueColorTempPickerMode, radius: number, tempMin: number, tempMax: number, canvas: HTMLCanvasElement) {
        const key = HueColorWheelCache.createKey(mode, radius, tempMin, tempMax);
        const dataUrl = canvas.toDataURL(); // we're using dataUrl, because in raw format, the image exceeds localStorage size limit
        try {
            localStorage.setItem(key, dataUrl);
        }
        catch (e) {
            console.error(e);
        }
    }

    public static tryGetWheel(mode: HueColorTempPickerMode, radius: number, tempMin: number, tempMax: number) {
        const key = HueColorWheelCache.createKey(mode, radius, tempMin, tempMax);
        try {
            const dataUrl = localStorage.getItem(key) || null;
            if (dataUrl) {
                return {
                    success: true,
                    dataUrl
                };
            }
        }
        catch (e) {
            console.error(e);
        }

        return {
            success: false,
            dataUrl: null
        };
    }

    private static createKey(mode: HueColorTempPickerMode, radius: number, tempMin: number, tempMax: number) {
        let modeString = mode;
        if (mode == 'temp') {
            modeString += `(${tempMin}-${tempMax})`;
        }

        return `HueColorWheelCache_${modeString}${radius}x${radius}v${HueColorWheelCache.version}`;
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
        }
        else {
            this._ro = new ResizeObserver(() => this.onResize());
        }
    }

    @property()
    public mode: HueColorTempPickerMode = 'color';

    /**
     * Will change min and max temp in kelvins.
     * Forcing the picker to re-render the temp wheel.
     */
    public setTempRange(minKelvin: number, maxKelvin: number): void {
        let changed = false;
        if (minKelvin != this._tempMin) {
            this._tempMin = minKelvin;
            changed = true;
        }
        if (maxKelvin != this._tempMax) {
            this._tempMax = maxKelvin;
            changed = true;
        }

        if (changed && this._isRendered && this.mode == 'temp') {
            this.drawWheel();
        }
    }

    private onResize(): void {
        this._markers.forEach(m => m.refresh());
    }

    // #region Rendering

    private _tempMin = 2000; // default hue min
    private _tempMax = 6535; // default hue max
    private _isRendered = false;
    private _canvas: HTMLDivElement;
    private _backgroundLayer: HTMLCanvasElement;
    private _interactionLayer: SVGElement;
    private _markers = new Array<HueColorTempPickerMarker>();
    private _activeMarker: HueColorTempPickerMarker;

    protected override firstUpdated(changedProps: PropertyValues) {
        super.firstUpdated(changedProps);

        this.setupLayers();
        this.drawWheel();

        this._isRendered = true;
    }

    protected override updated(changedProperties: PropertyValues<HueColorTempPicker>): void {
        if (changedProperties.has('mode') && changedProperties.get('mode')) {
            this.drawWheel();
            this.dispatchEvent(new Event('mode-change'));
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

    public get activeMarker() {
        return this._activeMarker;
    }

    /**
     * Will return all single active markers in array.
     * If multi marker is active, it will return all his submarkers.
     */
    public getActiveMarkers() {
        if (this._activeMarker instanceof HueColorTempPickerMultiMarker) {
            return this._activeMarker.markers;
        }

        return [this._activeMarker];
    }

    /**
     * Will add new marker to rendering.
     * @returns Reference to the marker (so you can set icon, color, temp, etc. and also get events when something changes)
     */
    public addMarker(name?: string, activate = true): HueColorTempPickerMarker {
        const m = new HueColorTempPickerMarker(this, name);
        this._markers.push(m);
        if (activate) {
            this.activateMarker(m, false);
        }
        this.requestUpdate('_markers');
        return m;
    }

    //TODO:
    // - add tryMergeMarkers method (with marker parameter, for not checking everything with everything)
    // - add unmergeMarker method

    /**
     * Will remove all markers from this color picker.
     */
    public clearMarkers() {
        this._markers.length = 0;
        this.requestUpdate('_markers');
    }

    /**
     * Will activate given marker and deactivate all the other markers.
     * @param marker Reference to the marker, that should be activated.
     */
    public activateMarker(marker: HueColorTempPickerMarker, doBoing = true) {
        if (this._activeMarker == marker)
            return;

        this._activeMarker = marker;

        const index = this._markers.indexOf(this._activeMarker);

        // marker was not found, try to find it inside of multi markers
        if (index < 0) {
            this._markers.forEach((mm, mmIndex) => {
                if (!(mm instanceof HueColorTempPickerMultiMarker))
                    return true; // continue

                const innerIndex = mm.markers.indexOf(marker);
                if (innerIndex < 0)
                    return true; // continue

                // remove marker from multi marker
                mm.markers.splice(innerIndex, 1);

                // if inner marker is only one (or zero), get it out
                if (mm.markers.length == 1) {
                    // replace multi marker with the remaining one
                    this._markers[mmIndex] = mm.markers[0];
                }
                else if (mm.markers.length == 0) {
                    // remove empty multi marker (should not happen, but anyway)
                    this._markers.splice(mmIndex, 1);
                }

                // add found marker at the end
                this._markers.push(marker);

                return false;// break
            });
        }
        else {
            // the active marker must be rendered last - to be on top
            if ((index + 1) < this._markers.length) {
                this._markers.push(this._markers.splice(index, 1)[0]);
            }
        }

        this.requestUpdate('_markers');
        if (doBoing) {
            marker.boing();
        }

        this.dispatchEvent(new Event('activemarkers-change'));
    }

    /**
     * Will return potential merge target close to the position of given marker.
     * Also the target must be in the same mode (when different mode, it's ignored).
     * Will return null, if nothing is in merging range.
     */
    public searchMergeTarget(marker: HueColorTempPickerMarker) {
        const range = this.getRadius() * 0.1;

        const target = this._markers.find(m => {
            // ignore self
            if (m == marker)
                return false;

            // ignore another mode
            if (m.mode != marker.mode)
                return false;

            const distance = m.position.getDistance(marker.position);
            return distance <= range;
        });

        return target;
    }

    /**
     * Will create merged marker (containing all markers passed to this function) at the position of first.
     * @param target Reference to the marker, from which the position and other initial values are taken
     * @param markers Rest of the markers
     */
    public mergeMarkers(target: HueColorTempPickerMarker, ...markers: HueColorTempPickerMarker[]) {
        const mm = new HueColorTempPickerMultiMarker(this, target, ...markers);

        // we need to remove all inner markers from collection
        removeFrom(this._markers, target);
        removeFrom(this._markers, ...markers);

        // add new merged marker
        this._markers.push(mm);

        // make it active
        this.activateMarker(mm);
        this.requestUpdate('_markers');

        return mm;
    }

    /**
     * Draws temp or color wheel depending on the selected mode.
     */
    private drawWheel() {
        const ctx = this._backgroundLayer.getContext('2d');
        if (ctx == null)
            throw Error('Cannot create convas context!');

        const radius = HueColorTempPicker.renderWidthHeight / 2;

        const cacheItem = HueColorWheelCache.tryGetWheel(this.mode, radius, this._tempMin, this._tempMax);
        if (cacheItem.success) {
            // we have dataUrl, we need to parse them through Image element, then render them to canvas
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0);
            };
            img.src = cacheItem.dataUrl!;

        }
        else {
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

            HueColorWheelCache.saveWheel(this.mode, radius, this._tempMin, this._tempMax, this._backgroundLayer);
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
        }
        else {
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
        }
        else if (this.mode == 'temp') {
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
        const kelvin = Math.round(HueColorTempPicker.utils.hueCurveScale(n, this._tempMin, this._tempMax));

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
        if (kelvin < this._tempMin)
            kelvin = this._tempMin;
        else if (kelvin > this._tempMax)
            kelvin = this._tempMax;

        const rowLength = 2 * radius;
        const n = HueColorTempPicker.utils.inverseHueCurveScale(kelvin, this._tempMin, this._tempMax);
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
         * Returns value in range from @param min to @param max based on hand crafted curve, as similar tu og Hue, as possible.
         * @param t normalized value 0 - 1
         * @param min Minimal returned value
         * @param max Maximal returned value
         */
        hueCurveScale: function (t: number, min: number, max: number): number {
            let addon = 0;
            const coef = (max / min) / 65;
            if (t <= 0.1) {
                addon = this.linearScale(t * 10, 0, coef);
            }
            else if (t <= 0.97) {
                addon = coef - this.linearScale((t - 0.1) / 0.9, 0, 2 * coef);
            }
            else {
                addon = -coef + this.linearScale((t - 0.97) / 0.03, 0, coef);
            }

            return (Math.pow(max / min, Math.pow(t, 1.55)) + addon) * min;
        },
        /**
         * Returns reverse value to fcion hueCurveScale - normalized value 0 - 1 with position of y on scale from @param min to @param max.
         * @param y Value in range from @param min to @param max based on hand crafted curve, as similar tu og Hue, as possible.
         * @param min Minimal given value
         * @param max Maximal given value
         */
        inverseHueCurveScale: function (targetValue: number, min: number, max: number): number {
            const epsilon = 0.0001; // Tolerance for convergence
            let low = 0;
            let high = 1;
            let t = 0.5; // Initial guess for t

            // we are using binary search - this function is not used so often, the performance should be enough
            while (high - low > epsilon) {
                const midValue = this.hueCurveScale(t, min, max);

                if (midValue < targetValue) {
                    low = t;
                }
                else {
                    high = t;
                }

                t = (low + high) / 2;
            }

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
                }
                else {
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
    ${HueColorTempPickerMarker.styles}
    `;

    protected override render() {
        return html`
        <div id="canvas">
            <svg id="interactionLayer">
                <defs>
                    <filter id="dot-shadow">
                        <feDropShadow dx="0" dy="0.5" stdDeviation="1" flood-opacity="1"></feDropShadow>
                    </filter>
                    <filter id="active-shadow">
                        <!-- Shadow offset -->
                        <feOffset dx="0" dy="-10" />

                        <!-- Shadow blur -->
                        <feGaussianBlur stdDeviation="7" result="offset-blur"/>

                        <!-- Invert drop shadow to make an inset shadow -->
                        <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse"/>
                        
                        <!-- Cut color inside shadow -->
                        <feFlood flood-color="#0005" flood-opacity=".95" result="color"/>
                        <feComposite operator="in" in="color" in2="inverse" result="shadow"/>

                        <!-- Placing shadow over element -->
                        <feComposite operator="over" in="shadow" in2="SourceGraphic"/>

                        <!-- Classic drop shadow -->
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

class HueColorTempPickerMultiMarker extends HueColorTempPickerMarker {
    private static mm_counter = 1;

    public readonly markers = new Array<HueColorTempPickerMarker>();

    public constructor(parent: HueColorTempPicker, target: HueColorTempPickerMarker, ...markers: HueColorTempPickerMarker[]) {
        super(parent, 'mm' + HueColorTempPickerMultiMarker.mm_counter++);

        if (target == null || markers.length < 1)
            throw new Error('At least two markers needs to be passed to create HueColorTempPickerMultiMarker');

        HueColorTempPickerMultiMarker.applyState(target, this);

        // check if tha passed markers are already merged
        if (target instanceof HueColorTempPickerMultiMarker) {
            target.markers.forEach(m => this.markers.push(m));
        }
        else {
            this.markers.push(target);
        }

        markers.forEach(m => {
            if (m instanceof HueColorTempPickerMultiMarker) {
                m.markers.forEach(mm => {
                    this.markers.push(mm);
                    // also synchronize states
                    HueColorTempPickerMultiMarker.applyState(target, mm);
                });
            }
            else {
                this.markers.push(m);
                // also synchronize states
                HueColorTempPickerMultiMarker.applyState(target, m);
            }
        });

        this.renderIcon();
    }

    public override get position() {
        return super.position;
    }
    public override set position(pos: Point) {
        super.position = pos;
        this.markers?.forEach(m => HueColorTempPickerMultiMarker.applyState(this, m));
    }

    public override dispatchChangeEvent(immediate: boolean) {
        // fire only non immediate events (immediate are fired in applyState)
        if (!immediate) {
            this.markers?.forEach(m => m.dispatchChangeEvent(immediate));
        }
    }

    private static applyState(from: HueColorTempPickerMarker, to: HueColorTempPickerMarker) {
        if (to.mode != from.mode) {
            to.mode = from.mode;
        }
        // this also fires dispatch
        to.position = from.position;
    }

    // #region Number icon

    private renderIcon() {
        this._iconElement.innerHTML = this.icon;
    }

    public override get icon(): string {
        return this.markers?.length.toString() ?? '';
    }
    public override set icon(_: string) {
        // noop
    }

    public override render(): SVGGraphicsElement {
        const result = super.render();

        this.renderIcon();

        return result;
    }

    protected override drawMarkerIcon(): SVGElement {
        const i = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'text'
        );
        i.setAttribute('class', 'icon text');
        i.setAttribute('x', '24');
        i.setAttribute('y', '24');
        i.setAttribute('text-anchor', 'middle');
        i.setAttribute('dominant-baseline', 'middle');

        i.innerHTML = this.icon;

        return i;
    }

    // #endregion
}