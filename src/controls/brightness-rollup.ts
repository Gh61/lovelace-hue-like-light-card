import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Consts } from '../types/consts';

/** Simple type for coordinates of MouseClick. */
class MouseClickPoint {
    public constructor(mouseEvent: MouseEvent) {
        this.X = mouseEvent.clientX;
        this.Y = mouseEvent.clientY;
    }

    public readonly X: number;
    public readonly Y: number;

    public getYDiff(startPoint:MouseClickPoint) {
        return this.Y - startPoint.Y;
    }

    public toString() {
        return `[${this.X},${this.Y}]`;
    }
}

@customElement(HueBrightnessRollup.ElementName)
export class HueBrightnessRollup extends LitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = Consts.CardElementName + '-hue-brightness-rollup';

    private _wrapper: HTMLElement;

    // #region Mouse events

    private _clickPosition: MouseClickPoint | null = null;
    private get _isMouseDown() {
        return this._clickPosition != null;
    }
    private _hasMouseMoved = false;

    private onWrapperMouseDown(ev: MouseEvent) {
        this._clickPosition = new MouseClickPoint(ev);
        this._hasMouseMoved = false;
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
    }

    private _onDocumentMouseMoveDelegate = (ev: MouseEvent) => this.onDocumentMouseMove(ev);
    private onDocumentMouseMove(ev: MouseEvent) {
        if (this._isMouseDown) {
            const currentPos = new MouseClickPoint(ev);
            const yDiff = currentPos.getYDiff(<MouseClickPoint>this._clickPosition);
            console.log(`Y diff: ${yDiff}`);

            // when moved by minimal of 5 pxs
            if (!this._isOpened && Math.abs(yDiff) > 5) {
                this.toggleWrapper(true, true);
                this._hasMouseMoved = true;
            }
        }
    }

    private _isOpened = false;
    private toggleWrapper(open: boolean, fast: boolean) {
        this._isOpened = open;
        this._wrapper.classList.toggle('fast', fast);
        this._wrapper.classList.toggle('open', this._isOpened);
    }

    // #endregion

    public static override styles = css`
    #wrapper{
        position: relative;
        transition: all 0.25s linear;
        
        width: 100px;
        height: 60px;
        margin-top: 120px;
        
        border: 2px solid red;
      }
      #wrapper.fast{
        transition: all 0.15s linear;
      }
      #wrapper.open{
        height: 180px;
        margin-top: 0;
      }
      #value{
        position:absolute;
        bottom: 0;
        width: 100%;
        box-sizing: border-box;
        
        height: 30%;
        
        border: 1px solid green;
      }
    `;

    protected override render() {
        return html`
        <div id='wrapper'>
            <div id='value'>
            </div>
        </div>`;
    }

    protected override firstUpdated() {
        this._wrapper = <HTMLElement>this.renderRoot.querySelector('#wrapper');
        this._wrapper.addEventListener('mousedown', (ev) => this.onWrapperMouseDown(ev));

        // register document events
        document.addEventListener('mouseup', this._onDocumentMouseUpDelegate);
        document.addEventListener('mousemove', this._onDocumentMouseMoveDelegate);
    }

    public override disconnectedCallback() {
        // remove document events
        document.removeEventListener('mouseup', this._onDocumentMouseUpDelegate);
        document.removeEventListener('mousemove', this._onDocumentMouseMoveDelegate);
    }
}