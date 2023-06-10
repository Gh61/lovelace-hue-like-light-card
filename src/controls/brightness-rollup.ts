import { html, css, LitElement, PropertyValues, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Consts } from '../types/consts';
import { nameof } from '../types/extensions';
import { ViewUtils } from '../core/view-utils';
import { MousePoint, Point, TouchPoint } from '../types/point';
import { PointerDragHelper } from './pointer-drag-helper';

export interface IRollupValueChangeEventDetail {
    oldValue: number;
    newValue: number;
}

export interface IRollupOpenCloseEventDetail {
    isOpen: boolean;
}

@customElement(HueBrightnessRollup.ElementName)
export class HueBrightnessRollup extends LitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = 'hue-brightness-rollup' + Consts.ElementPostfix;

    private readonly _deadZone = 5;
    private readonly _wheelChange = 3;
    private readonly _wheelDebounceInterval = 800;// ms
    private readonly _wheelCloseInterval = 800;// ms
    private _wrapperElement: HTMLElement;
    private _valueElement: HTMLElement;
    private _dragHelper: PointerDragHelper;
    private _value = 100;
    private _immediateValue = this._value;

    public constructor() {
        super();
    }

    @property()
    public width = 100;

    @property()
    public height = 60;

    @property()
    public heightOpened = 200;

    @property()
    public get value(): number {
        return this._value;
    }
    public set value(newValue: number) {
        this.setValue(newValue, false); // external value set, no event fired
    }

    /**
     * Will set @param newValue as actual value to @property value.
     * @param dispatchEvent When set, will dispatch 'change' event.
     */
    private setValue(newValue: number, dispatchEvent: boolean) {
        newValue = HueBrightnessRollup.cleanValue(newValue);

        if (newValue != this._value) {
            const oldValue = this._value;
            this._value = newValue;
            // notify change
            this.requestUpdate(nameof(this, 'value'), oldValue);

            // fire change event
            if (dispatchEvent) {
                const event = new CustomEvent<IRollupValueChangeEventDetail>('change', {
                    detail: { oldValue, newValue }
                });
                this.dispatchEvent(event);
            }

            // change Immediate value
            this.immediateValue = newValue;
        }
    }

    @property()
    public get immediateValue(): number {
        return this._immediateValue;
    }
    private set immediateValue(newValue: number) {
        newValue = HueBrightnessRollup.cleanValue(newValue);

        // if changed - change immediateValue
        if (newValue != this.immediateValue) {
            const oldValue = this.immediateValue;
            this._immediateValue = newValue;
            // notify changed property
            this.requestUpdate(nameof(this, 'immediateValue'), oldValue);

            // fire event
            const event = new CustomEvent<IRollupValueChangeEventDetail>('immediate-value-change', {
                detail: { oldValue, newValue }
            });
            this.dispatchEvent(event);
        }
    }

    /** Will clean value (set it to whole numbers and ensure range <1,100>) */
    private static cleanValue(newValue: number): number {
        newValue = Math.round(newValue);
        if (newValue < 1)
            newValue = 1;
        else if (newValue > 100)
            newValue = 100;

        return newValue;
    }

    /** Changes @property immediateValue by @param addition. Set @param useValueAsBase to true to add to @property value instead of @property immediateValue. */
    private changeImmediateValue(addition: number, useValueAsBase: boolean) {
        // add addition to startValue;
        const newValue = (useValueAsBase ? this.value : this.immediateValue) + addition;
        this.immediateValue = newValue;
    }

    /** Will set actual @property immediateValue to @property value. */
    private applyImmediateValue() {
        this.setValue(this.immediateValue, true); // Set value and dispatch change event
    }

    // #region Mouse events

    private _isOpened = false;
    private toggleBar(open: boolean, fast: boolean) {
        this._isOpened = open;
        this._wrapperElement.classList.toggle('fast', fast);
        this._wrapperElement.classList.toggle('open', this._isOpened);

        // remove document events when bar is closed (could be closed by timer)
        if (!open) {
            this.removeDocumentListeners();
        }

        // fire open or close event
        const eventType = this._isOpened ? 'open' : 'close';
        const event = new CustomEvent<IRollupOpenCloseEventDetail>(eventType, {
            detail: { isOpen: this._isOpened }
        });
        this.dispatchEvent(event);
    }

    private _clickPosition: Point | null = null;
    private get _isMouseDown() {
        return this._clickPosition != null;
    }
    private _hasMouseMoved = false;

    private onBarMouseDown(ev: MouseEvent | TouchEvent, isTouch: boolean) {
        if (isTouch) {
            this._clickPosition = new TouchPoint((<TouchEvent>ev).changedTouches[0]);
        } else {
            this._clickPosition = new MousePoint((<MouseEvent>ev));
        }

        // register wheel document events
        if (!isTouch) {
            document.addEventListener('wheel', this._onDocumentWheelDelegate);
        }
    }

    private removeDocumentListeners() {
        // remove document events
        if (this._dragHelper) {
            this._dragHelper.removeDocumentListeners();
        }
        document.removeEventListener('wheel', this._onDocumentWheelDelegate);
    }

    private _onDocumentMouseUpDelegate = () => this.onDocumentMouseUp();
    private onDocumentMouseUp() {
        if (this._isMouseDown) {
            if (!this._hasMouseMoved) {
                this.toggleBar(!this._isOpened, false);
            } else {
                this.toggleBar(false, true);
            }
        }
        this._clickPosition = null;

        // reset mouse move
        if (this._hasMouseMoved) {
            this._hasMouseMoved = false;
            // when is closed - apply immediate value
            if (!this._isOpened) {
                this.applyImmediateValue();
            }
        }
    }

    private _onDocumentMouseMoveDelegate = (ev: MouseEvent | TouchEvent, isTouch:boolean) => this.onDocumentMouseMove(ev, isTouch);
    private onDocumentMouseMove(ev: MouseEvent | TouchEvent, isTouch:boolean) {
        if (this._isMouseDown) {
            let currentPos: Point;
            if (isTouch) {
                currentPos = new TouchPoint((<TouchEvent>ev).changedTouches[0]);
            } else {
                currentPos = new MousePoint(<MouseEvent>ev);
            }

            let yDiff = currentPos.getYDiff(<Point>this._clickPosition);

            // when moved by minimal of 5 pxs
            if (!this._hasMouseMoved && Math.abs(yDiff) > this._deadZone) {
                if (!this._isOpened) {
                    this.toggleBar(true, true);
                }
                this._hasMouseMoved = true;
                // set new clickPoint after starting to move
                this._clickPosition = currentPos;
                // compute new diff
                yDiff = currentPos.getYDiff(<Point>this._clickPosition);
            }
            if (this._hasMouseMoved && this._isOpened) {
                // stop potential wheel close or set (and apply its value right now)
                this.clearWheelTimeouts(true);
                // get current change
                const percentChange = (-(yDiff / this.heightOpened)) * 100;
                this.changeImmediateValue(percentChange, true);
            }
        }
    }

    private _onDocumentWheelDelegate = (ev: WheelEvent) => this.onDocumentWheel(ev);
    private onDocumentWheel(ev: WheelEvent) {
        if (this._isOpened) {
            const yDiff = ev.deltaY > 0 ? -this._wheelChange : this._wheelChange;
            this.changeImmediateValue(yDiff, false);

            // Clear previouse debounce timeouts
            this.clearWheelTimeouts();

            // Debounce the submit of wheel change
            this._wheelSubmitTimeoutId = setTimeout(() => {
                this.applyImmediateValue();
            }, this._wheelDebounceInterval);

            // Debounce of closing the control
            this._wheelCloseTimeoutId = setTimeout(() => {
                this.toggleBar(false, false);
            }, this._wheelCloseInterval);
        }
    }
    private clearWheelTimeouts(applyPlannedValue = false) {
        if (this._wheelSubmitTimeoutId) {
            clearTimeout(this._wheelSubmitTimeoutId);
            this._wheelSubmitTimeoutId = null;

            // apply value if planned
            if (applyPlannedValue) {
                this.applyImmediateValue();
            }
        }
        if (this._wheelCloseTimeoutId) {
            clearTimeout(this._wheelCloseTimeoutId);
            this._wheelCloseTimeoutId = null;
        }
    }
    private _wheelSubmitTimeoutId: NodeJS.Timeout | null;
    private _wheelCloseTimeoutId: NodeJS.Timeout | null;

    // #endregion

    public static override styles = css`
    :host {
        user-select: none;
        -webkit-user-select: none;
    }

    #wrapper{
        color: white;
    }
    #bar{
        position: relative;
        transition: all 0.25s linear;

        width: var(--rollup-width);
        height: var(--rollup-height);

        cursor: pointer;
    }
    #bar, #desc span{
        transition: all 0.25s linear;
    }
    .fast #bar,
    .fast #desc span{
        transition: all 0.15s linear;
    }
    .open #bar{
        height: var(--rollup-height-opened);
        /*
        margin-top: calc(var(--rollup-height) - var(--rollup-height-opened));
        */
    }
    #desc{
        text-align: center;
        margin: 4px;
    }
    #value{
        position:absolute;
        bottom: 0;
        width: 100%;
        box-sizing: border-box;
    }
    #icon{
        text-align: center;
        position: absolute;
        bottom: calc((var(--rollup-height) - 24px) / 2);
        width: 100%;
    }

    /* Hue styling: */
    #bar{
        box-shadow: ${unsafeCSS(Consts.HueShadow)};
        background: ${unsafeCSS(Consts.TileOffColor)};
        border-radius: calc(var(--rollup-height) / 2);
        overflow: hidden;
    }
    #value{
        background: linear-gradient(180deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.1) 100%);
    }
    #desc span{
        border-radius: 10px;
        padding: 0 4px;
    }
    .open #desc span{
        box-shadow: ${unsafeCSS(Consts.HueShadow)};
        background: ${unsafeCSS(Consts.TileOffColor)};
    }
    `;

    protected override updated(changedProps: PropertyValues<HueBrightnessRollup>, isFirst = false) {
        super.updated(changedProps);

        if (changedProps.has('width')) {
            this.style.setProperty(
                '--rollup-width',
                this.width + 'px'
            );
        }
        if (changedProps.has('height')) {
            this.style.setProperty(
                '--rollup-height',
                this.height + 'px'
            );
        }
        if (changedProps.has('heightOpened')) {
            this.style.setProperty(
                '--rollup-height-opened',
                this.heightOpened + 'px'
            );
        }

        if (changedProps.has('immediateValue') || isFirst) {
            this._valueElement.style.height = this.immediateValue + '%';
        }
    }

    protected override render() {
        const icon = ViewUtils.hasHueIcons() ? 'hue:scene-bright' : 'mdi:brightness-7';

        return html`
        <div id='wrapper'>
            <div id='desc'>
                <span>${this.immediateValue} %</span>
            </div>
            <div id='bar'>
                <div id='value'></div>
                <div id='icon'>
                    <ha-icon icon="${icon}"></ha-icon>
                </div>
            </div>
        </div>`;
    }

    protected override firstUpdated(changedProps: PropertyValues<HueBrightnessRollup>) {
        this._wrapperElement = <HTMLElement>this.renderRoot.querySelector('#wrapper');

        const barElement = <HTMLElement>this._wrapperElement.querySelector('#bar');
        this._dragHelper = new PointerDragHelper(
            barElement,
            (ev, t) => this.onBarMouseDown(ev, t),
            this._onDocumentMouseMoveDelegate,
            this._onDocumentMouseUpDelegate
        );

        // get value element
        this._valueElement = <HTMLElement>barElement.querySelector('#value');

        // manually call update with isFirst flag
        this.updated(changedProps, true);
    }

    public override disconnectedCallback() {
        super.disconnectedCallback();

        // remove document events
        this.removeDocumentListeners();
        this._dragHelper?.removeAllListeners();
    }
}