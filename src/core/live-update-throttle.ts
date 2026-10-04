import { Consts } from '../types/consts';
import { Action, Action1, noop } from '../types/functions';

/**
 * Throttles live updates of a value while the user is dragging a control (slider, color marker, ...)
 * and pins the shown value, so the control doesn't jump back to the lagging state from Home Assistant.
 *
 * - `update` (during drag): pins the value and applies it at most once per interval - the latest value is applied at the end of the interval.
 * - `commit` (drag finished): applies the final value right away and keeps it pinned for a short hold time.
 * - With interval 0 the live updates are off: `update` does nothing and `commit` only applies the value.
 */
export class LiveUpdateThrottle<T> {
    private readonly _interval: number;
    private readonly _onRelease: Action;
    private _pinnedValue: T | null = null;
    private _pending: { value: T, apply: Action1<T> } | null = null;
    private _lastApplyTime = 0;
    private _applyTimeout: ReturnType<typeof setTimeout> | null = null;
    private _releaseTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * @param interval Minimal time between two applied updates in ms; 0 turns live updates off.
     * @param onRelease Called when the pinned value is released (the control should show the real state again).
     */
    public constructor(interval: number, onRelease: Action = noop) {
        this._interval = interval;
        this._onRelease = onRelease;
    }

    /** Whether live updates are enabled (interval > 0). */
    public get isEnabled(): boolean {
        return this._interval > 0;
    }

    /** Value the control should show instead of the real state, or null when nothing is pinned. */
    public get pinnedValue(): T | null {
        return this._pinnedValue;
    }

    /** Whether a value is pinned (drag in progress or hold time after the drag). */
    public get isPinned(): boolean {
        return this._pinnedValue != null;
    }

    /**
     * Intermediate value during drag - pins it and applies it throttled.
     * @param apply Applies the value (e.g. calls the HA service).
     */
    public update(value: T, apply: Action1<T>): void {
        if (!this.isEnabled)
            return;

        this.pin(value);
        this._pending = { value, apply };

        if (this._applyTimeout)
            return; // the latest value will be applied at the end of the interval

        const wait = this._lastApplyTime + this._interval - Date.now();
        if (wait <= 0) {
            this.applyPending();
        }
        else {
            this._applyTimeout = setTimeout(() => {
                this._applyTimeout = null;
                this.applyPending();
            }, wait);
        }
    }

    /**
     * Final value after drag - cancels the pending update, applies the value and keeps it pinned for the hold time.
     * @param apply Applies the value (e.g. calls the HA service).
     */
    public commit(value: T, apply: Action1<T>): void {
        this.clearApplyTimeout();
        this._pending = null;
        this._lastApplyTime = 0;

        // pin before apply - apply can trigger render, which should already use the pinned value
        if (this.isEnabled) {
            this.pin(value);
        }

        apply(value);
    }

    /** Cancels the pending update and releases the pinned value without notification. */
    public stop(): void {
        this.clearApplyTimeout();
        this.clearReleaseTimeout();
        this._pending = null;
        this._pinnedValue = null;
        this._lastApplyTime = 0;
    }

    private applyPending() {
        if (!this._pending)
            return;

        const pending = this._pending;
        this._pending = null;
        this._lastApplyTime = Date.now();
        pending.apply(pending.value);
    }

    /** Pins the value; the pin is released after hold time from the last pin - also when the drag never finishes (lost pointer). */
    private pin(value: T) {
        this._pinnedValue = value;

        this.clearReleaseTimeout();
        this._releaseTimeout = setTimeout(() => {
            this._releaseTimeout = null;
            this._pinnedValue = null;
            this._onRelease();
        }, Consts.LiveUpdateHoldTime);
    }

    private clearApplyTimeout() {
        if (this._applyTimeout) {
            clearTimeout(this._applyTimeout);
            this._applyTimeout = null;
        }
    }

    private clearReleaseTimeout() {
        if (this._releaseTimeout) {
            clearTimeout(this._releaseTimeout);
            this._releaseTimeout = null;
        }
    }
}
