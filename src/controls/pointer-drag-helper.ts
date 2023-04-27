/**
 * Callback of mouse or touch event.
 */
export type DragEventCallback = (ev: MouseEvent | TouchEvent, isTouch: boolean) => void;

/**
 * Object helping with registering and unregistering mouse/touch drag events.
 */
export class PointerDragHelper {
    private readonly _element: HTMLElement | SVGGraphicsElement;
    private readonly _onDragStart: EventListener;
    private readonly _onDragMove;
    private readonly _onDragEnd;
    private _currentMode: Mode = null;

    public constructor(element: HTMLElement | SVGGraphicsElement, onDragStart: DragEventCallback, onDragMove: DragEventCallback, onDragEnd?: DragEventCallback) {
        this._element = element;
        this._onDragStart = this.createDragStartDelegate(onDragStart);
        this._onDragMove = this.createDragMoveDelegate(onDragMove);
        this._onDragEnd = this.createDragEndDelegate(onDragEnd);

        this.registerInitEvents();
    }

    private registerInitEvents() {
        this._element.addEventListener('mousedown', this._onDragStart);
        this._element.addEventListener('touchstart', this._onDragStart);
    }

    private createDragStartDelegate(callback: DragEventCallback) {
        return (ev: Event) => {

            // already in some mode
            if (this._currentMode) {
                return;
            }

            const isTouch = PointerDragHelper.isTouchEvent(ev);
            callback(<MouseEvent | TouchEvent>ev, isTouch);

            this._currentMode = isTouch ? 'touch' : 'mouse';
            if (isTouch) {
                document.addEventListener('touchmove', this._onDragMove);
                document.addEventListener('touchend', this._onDragEnd);
                ev.preventDefault();
            } else {
                document.addEventListener('mousemove', this._onDragMove);
                document.addEventListener('mouseup', this._onDragEnd);
            }
        };
    }

    private createDragMoveDelegate(callback: DragEventCallback) {
        return (ev: MouseEvent | TouchEvent) => {
            callback(ev, PointerDragHelper.isTouchEvent(ev));
        };
    }

    private createDragEndDelegate(callback?: DragEventCallback) {
        return (ev: MouseEvent | TouchEvent) => {
            // drag end is not needed
            if (callback) {
                callback(ev, PointerDragHelper.isTouchEvent(ev));
            }

            this.removeDocumentListeners();
            this._currentMode = null;
        };
    }

    /**
     * Removes document listeners.
     */
    public removeDocumentListeners() {
        document.removeEventListener('touchmove', this._onDragMove);
        document.removeEventListener('touchend', this._onDragEnd);
        document.removeEventListener('mousemove', this._onDragMove);
        document.removeEventListener('mouseup', this._onDragEnd);
    }

    /**
     * Removes document and element listeners.
     * (Whole functionality will be turned off.)
     */
    public removeAllListeners() {
        this.removeDocumentListeners();

        this._element.removeEventListener('mousedown', this._onDragStart);
        this._element.removeEventListener('touchstart', this._onDragStart);
    }

    private static isTouchEvent(ev: Event) {
        return 'touches' in ev;
    }
}

type Mode = 'mouse' | 'touch' | null;