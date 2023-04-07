import { html, css, LitElement, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Consts } from '../types/consts';
import { nameof } from '../types/extensions';

/** Simple type for coordinates of MouseClick. */
class MouseClickPoint {
    public constructor(mouseEvent: MouseEvent) {
        this.X = mouseEvent.clientX;
        this.Y = mouseEvent.clientY;
    }

    public readonly X: number;
    public readonly Y: number;

    public getYDiff(startPoint: MouseClickPoint) {
        return this.Y - startPoint.Y;
    }

    public toString() {
        return `[${this.X},${this.Y}]`;
    }
}

export interface IRollupValueChangeEventDetail {
    oldValue:number;
    newValue:number;
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
        newValue = HueBrightnessRollup.cleanValue(newValue);

        if (newValue != this._value) {
            const oldValue = this._value;
            this._value = newValue;
            // notify change
            this.requestUpdate(nameof(this, 'value'), oldValue);

            // fire change event
            const event = new CustomEvent<IRollupValueChangeEventDetail>('change', {
                detail: { oldValue, newValue }
            });
            this.dispatchEvent(event);

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
        this.value = this.immediateValue;
    }

    // #region Mouse events

    private _isOpened = false;
    private toggleWrapper(open: boolean, fast: boolean) {
        this._isOpened = open;
        this._wrapperElement.classList.toggle('fast', fast);
        this._wrapperElement.classList.toggle('open', this._isOpened);

        // fire open or close event
        const eventType = this._isOpened ? 'open' : 'close';
        const event = new CustomEvent<IRollupOpenCloseEventDetail>(eventType, {
            detail: { isOpen: this._isOpened }
        });
        this.dispatchEvent(event);
    }

    private _clickPosition: MouseClickPoint | null = null;
    private get _isMouseDown() {
        return this._clickPosition != null;
    }
    private _hasMouseMoved = false;

    private onWrapperMouseDown(ev: MouseEvent) {
        this._clickPosition = new MouseClickPoint(ev);
    }

    private _onDocumentMouseUpDelegate = () => this.onDocumentMouseUp();
    private onDocumentMouseUp() {
        if (this._isMouseDown) {
            if (!this._hasMouseMoved) {
                this.toggleWrapper(!this._isOpened, false);
            } else {
                this.toggleWrapper(false, true);
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

    private _onDocumentMouseMoveDelegate = (ev: MouseEvent) => this.onDocumentMouseMove(ev);
    private onDocumentMouseMove(ev: MouseEvent) {
        if (this._isMouseDown) {
            const currentPos = new MouseClickPoint(ev);
            let yDiff = currentPos.getYDiff(<MouseClickPoint>this._clickPosition);

            // when moved by minimal of 5 pxs
            if (!this._hasMouseMoved && Math.abs(yDiff) > this._deadZone) {
                if (!this._isOpened) {
                    this.toggleWrapper(true, true);
                }
                this._hasMouseMoved = true;
                // set new clickPoint after starting to move
                this._clickPosition = currentPos;
                // compute new diff
                yDiff = currentPos.getYDiff(<MouseClickPoint>this._clickPosition);
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
                this.toggleWrapper(false, false);
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
    #wrapper{
        position: relative;
        transition: all 0.25s linear;

        width: var(--rollup-width);
        height: var(--rollup-height);

        border: 2px solid red;

        user-select: none;
        cursor: pointer;
    }
    #wrapper.fast{
        transition: all 0.15s linear;
    }
    #wrapper.open{
        height: var(--rollup-height-opened);
        margin-top: calc(var(--rollup-height) - var(--rollup-height-opened));
    }
    #desc{
        position:absolute;
        top: -24px;
        width: 100%;
        text-align: center;
        user-select: none;
    }
    #value{
        position:absolute;
        bottom: 0;
        width: 100%;
        box-sizing: border-box;

        border: 1px solid green;
      }
    `;

    protected override updated(changedProps: PropertyValues<HueBrightnessRollup>) {
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

        if (changedProps.has('immediateValue')) {
            this._valueElement.style.height = this.immediateValue + '%';
        }
    }

    protected override render() {
        return html`
        <div id='wrapper'>
            <div id='desc'>${this.immediateValue} %</div>
            <div id='value'></div>
        </div>`;
    }

    protected override firstUpdated() {
        this._wrapperElement = <HTMLElement>this.renderRoot.querySelector('#wrapper');
        this._wrapperElement.addEventListener('mousedown', (ev) => this.onWrapperMouseDown(ev));

        // get value element
        this._valueElement = <HTMLElement>this._wrapperElement.querySelector('#value');

        // register document events
        document.addEventListener('mouseup', this._onDocumentMouseUpDelegate);
        document.addEventListener('mousemove', this._onDocumentMouseMoveDelegate);
        document.addEventListener('wheel', this._onDocumentWheelDelegate);
    }

    public override disconnectedCallback() {
        // remove document events
        document.removeEventListener('mouseup', this._onDocumentMouseUpDelegate);
        document.removeEventListener('mousemove', this._onDocumentMouseMoveDelegate);
        document.removeEventListener('wheel', this._onDocumentWheelDelegate);
    }
}