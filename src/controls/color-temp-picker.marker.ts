import { Consts } from '../types/consts';
import { Color } from '../core/colors/color';
import { Point } from '../types/point';
import { PointerDragHelper } from './pointer-drag-helper';
import { HaIcon } from '../types/types-hass';
import { HueColorTempPicker, HueColorTempPickerMode, IHueColorTempPickerEventDetail } from './color-temp-picker';
import { css, unsafeCSS } from 'lit';
import { doVibrate } from '../types/extensions';

export class HueColorTempPickerMarker {
    private readonly _parent: HueColorTempPicker;
    private readonly _markerG: SVGGraphicsElement;
    private readonly _markerPath: SVGPathElement;
    protected readonly _iconElement: SVGElement;

    public readonly name: string;
    private _color: Color = new Color(0, 0, 0);
    private _temp = 0;
    private _position: Point;
    private _mode: HueColorTempPickerMode = 'color';
    private _icon: string = HueColorTempPickerMarker.defaultIconName;
    private _isOff = false;
    private _isPreview = false;

    private static counter = 1;
    private static readonly defaultIconName = 'default';
    private static readonly defaultIcon = 'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z';
    /** SVG path of marker in it's full active form. (48x60 px) */
    private static readonly markerActivePath = 'M 24,0 C 10.745166,0 0,10.575951 0,23.622046 0,39.566928 21,57.578739 22.05,58.346457 L 24,60 25.95,58.346457 C 27,57.578739 48,39.566928 48,23.622046 48,10.575951 37.254834,0 24,0 Z';
    private static readonly markerActivePathSize = { width: 48, height: 60 };
    /** SVG path of marker in it's small non-active form. (12x12 px) */
    private static readonly markerNonActivePath = 'M6 0A6 6 0 006 12 6 6 0 006 0Z';
    private static readonly markerNonActivePathSize = { width: 12, height: 12 };
    private static readonly markerNonActiveOutlinePath = 'M8 0A8 8 0 008 16 8 8 0 008 0Z';

    public constructor(parent: HueColorTempPicker, name?: string) {
        this.name = name ?? ('m' + HueColorTempPickerMarker.counter++);
        this._parent = parent;
        [this._markerG, this._markerPath, this._iconElement] = this.drawMarker();
        this.position = new Point(this.getRadius(), this.getRadius());
        this.makeDraggable();
    }

    private getRadius() {
        return this._parent.getRadius();
    }

    public dispatchChangeEvent(immediate: boolean) {
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
        this._markerG.classList.add((this.isDrag || this.isPreview) ? 'big-boing' : 'boing');
        setTimeout(() => {
            this._markerG.classList.remove('big-boing', 'boing');
        }, 200); // animation takes 150ms, 
    }

    public get position() {
        return this._position;
    }
    public set position(pos: Point) {

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
            }
            else {
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

    public get isActive() {
        return this._parent.activeMarker === this;
    }
    public setActive(doBoing = true) {
        this._parent.activateMarker(this, doBoing);
    }

    public get isDrag() {
        return this._markerG.classList.contains('drag');
    }
    public set isDrag(value: boolean) {
        if (value) {
            this._markerG.classList.add('drag');
        }
        else {
            this._markerG.classList.remove('drag');
        }
    }

    public get isPreview() {
        return this._isPreview;
    }
    public set isPreview(value: boolean) {
        if (this._isPreview == value)
            return;

        if (value) {
            doVibrate(20);
        }

        this._isPreview = value;
        this.render();
        this.boing();
    }

    public get mode() {
        return this._mode;
    }
    public set mode(mod: HueColorTempPickerMode) {
        this._mode = mod;
        this.renderMode();
    }

    /**
     * Will refresh position and then render all values.
     */
    public refresh() {
        if (this.mode == 'temp') {
            this.temp = this.temp;
        }
        else {
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
            this._iconElement.setAttribute('d', path);
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

    public static styles = css`
        .marker-outline {
            fill: white;
            filter: url(#dot-shadow);
            transform: translate(-2px, -2px);
        }
        .marker {
            fill: currentColor;
        }
        .icon {
            transform: scale(1.2) translate(8px, 8px);
            transition: ${unsafeCSS(Consts.TransitionDefault)};
            fill: white;
            display: none;
        }
        .icon.text {
            transform: none;
            /*font-family: Roboto, Noto, sans-serif;*/
            font-size: 20px;
            font-weight: bold;
        }

        .gm.off-mode {
            opacity: 0.7;
        }
        .gm.off-mode .marker-outline {
            display: none;
        }
        .gm.off-mode .marker {
            filter: url(#dot-shadow);
        }

        .gm.active,
        .gm.preview {
            transition: scale 0.1s ease-in-out;
        }
        .gm.active  .marker-outline,
        .gm.preview .marker-outline {
            display: none;
        }
        .gm.active  .marker,
        .gm.preview .marker {
            filter: url(#active-shadow);
        }
        .gm.active  .icon,
        .gm.preview .icon {
            display: inline;
        }

        .gm.active.drag {
            scale:1.1;
        }
        .gm.preview {
            scale:1.25;
            opacity:0.7;
        }

        .gm.boing {
            animation: boing 150ms ease-in-out;
        }
        .gm.big-boing {
            animation: big-boing 150ms ease-in-out;
        }

        .marker-outline, .marker, .icon{
            cursor: pointer;
        }

        @keyframes boing {
            0% {
                scale:0.7;
            }
            50% {
                scale:1.05;
                translate: 0 -5px;
            }
            100% {
                /*scale:1;*/
            }
        }

        @keyframes big-boing {
            0% {
                scale:0.7;
            }
            50% {
                scale:1.15;
                translate: 0 -5px;
            }
            100% {
                /*scale:1;*/
            }
        }
    `;

    /**
     * @returns offset of marker tip (point where color is taken).
     */
    private getMarkerOffset() {
        let rect = <{ width: number, height: number }>this._markerPath.getBBox();

        // init fallback
        if (rect.width == 0) {
            if (this.isActive || this.isPreview) {
                rect = HueColorTempPickerMarker.markerActivePathSize;
            }
            else {
                rect = HueColorTempPickerMarker.markerNonActivePathSize;
            }
        }

        if (this.isActive || this.isPreview) {
            // we want the pointer (bottom middle) of active marker
            const x = rect.width / 2;
            const y = rect.height;
            return new Point(x, y);
        }
        else {
            // we want the middle point of non-active marker
            const x = rect.width / 2;
            const y = rect.height / 2;
            return new Point(x, y);
        }
    }

    private renderColor() {
        if (this._isOff) {
            this._markerG.style.color = 'rgb(0,0,0)';
            this._iconElement.style.fill = Consts.LightColor.toString();
        }
        else {
            this._markerG.style.color = this._color.toString();

            // for temp view I want only one change of foreground in the middle of the wheel
            const luminanceOffset = this.mode == 'temp' ? -25 : 0;
            const foreground = this._color.getForeground(Consts.LightColor, Consts.DarkColor, luminanceOffset);
            this._iconElement.style.fill = foreground.toString();
        }
    }

    private renderPreviewActive() {
        if (this.isActive || this.isPreview) {
            this._markerG.classList.add(this.isActive ? 'active' : 'preview');
            this._markerPath.setAttribute('d', HueColorTempPickerMarker.markerActivePath);
        }
        else {
            this._markerG.classList.remove('active', 'preview');
            this._markerPath.setAttribute('d', HueColorTempPickerMarker.markerNonActivePath);
        }
    }

    private renderMode() {
        if (this.mode == this._parent.mode) {
            this._markerG.classList.remove('off-mode');
        }
        else {
            this._markerG.classList.add('off-mode');
        }
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
        this.renderPreviewActive();
        this.renderPosition();
        this.renderMode();

        // return marker object
        return this._markerG;
    }

    // #endregion

    // #region Drag

    private _dragHelper: PointerDragHelper;
    private _mergeTarget?: HueColorTempPickerMarker;

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
        this.isDrag = true;
        this.setActive(!this.isActive);
    }

    private onDrag(ev: MouseEvent | TouchEvent) {
        this.position = this._parent.getCanvasMousePoint(ev, this._dragOffset);

        // merge target
        const newMergeTarget = this._parent.searchMergeTarget(this);
        if (this._mergeTarget && this._mergeTarget != newMergeTarget) {
            this._mergeTarget.isPreview = false;
        }
        if (newMergeTarget) {
            newMergeTarget.isPreview = true;
        }
        this._mergeTarget = newMergeTarget;
    }

    private onDragEnd() {
        this.isDrag = false;

        if (this._mergeTarget) {
            const target = this._mergeTarget;

            this._mergeTarget.isPreview = false;
            this._mergeTarget = undefined;

            this._parent.mergeMarkers(target, this);
        }

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
    private drawMarker(): [SVGGraphicsElement, SVGPathElement, SVGElement] {
        const g = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'g'
        );
        g.setAttribute('class', 'gm');

        const o = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path'
        );

        o.setAttribute('class', 'marker-outline');
        o.setAttribute('d', HueColorTempPickerMarker.markerNonActiveOutlinePath);

        const m = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path'
        );

        m.setAttribute('class', 'marker');
        m.setAttribute('d', HueColorTempPickerMarker.markerActivePath);

        const i = this.drawMarkerIcon();

        g.appendChild(o);
        g.appendChild(m);
        g.appendChild(i);

        return [g, m, i];
    }

    protected drawMarkerIcon(): SVGElement {
        const i = document.createElementNS(
            'http://www.w3.org/2000/svg',
            'path'
        );
        i.setAttribute('class', 'icon');
        i.setAttribute('d', HueColorTempPickerMarker.defaultIcon);

        return i;
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