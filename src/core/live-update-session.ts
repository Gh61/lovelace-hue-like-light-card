import { Consts } from '../types/consts';
import { Action, Func, Func1, noop } from '../types/functions';

/** Applies the value (e.g. calls the HA service) - a returned promise is awaited before the next value is applied. */
export type LiveUpdateApply<T> = Func1<T, Promise<unknown> | void>;

/**
 * Live updates of a value while the user is dragging a control (slider, color marker, ...) - one instance per control.
 * Sends the values to Home Assistant one at a time and pins the shown value, so the control doesn't jump back to the lagging state from Home Assistant.
 *
 * - At most one apply is in flight - the next value is applied only after Home Assistant confirmed the previous one
 *   (or it failed, or `Consts.LiveUpdateConfirmTimeout` passed) and at least `Consts.LiveUpdateMinInterval` after it was sent.
 *   Values in between are skipped - the latest value wins.
 * - `update` (during drag): pins the value and queues it.
 * - `commit` (drag finished): queues the final value the same way (never overtaken by an older value) and keeps it pinned.
 * - The pin is released after `Consts.LiveUpdateHoldTime` from the last pinned value or the last confirmation, whichever is later,
 *   or by `stop` - `onRelease` is called in both cases.
 * - When disabled, `update` does nothing and `commit` only applies the value.
 */
export class LiveUpdateSession<T> {
    private readonly _enabled: boolean;
    private readonly _onRelease: Action;
    private _pinnedValue: T | null = null;
    private _lastSentValue: T | null = null;
    private _pending: { value: T, apply: LiveUpdateApply<T> } | null = null;
    private _inFlight = false;
    private _lastApplyTime = 0;
    private _session = 0;
    private _applyTimeout: ReturnType<typeof setTimeout> | null = null;
    private _releaseTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * @param enabled Whether live updates are enabled.
     * @param onRelease Called when the pinned value is released (the control should show the real state again).
     */
    public constructor(enabled: boolean, onRelease: Action = noop) {
        this._enabled = enabled;
        this._onRelease = onRelease;
    }

    /** Whether live updates are enabled. */
    public get isEnabled(): boolean {
        return this._enabled;
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
     * Value of the last live apply that sent something (returned a promise - sent, not necessarily confirmed) while the value is pinned - null after release, `stop` or when disabled.
     * The final apply can compare with it to skip a value that was already sent.
     */
    public get lastSentValue(): T | null {
        return this._lastSentValue;
    }

    /**
     * Intermediate value during drag - pins it and applies it as soon as possible.
     * @param apply Applies the value (e.g. calls the HA service).
     */
    public update(value: T, apply: LiveUpdateApply<T>): void {
        if (!this._enabled)
            return;

        this.pin(value);
        this._pending = { value, apply };
        this.tryApplyPending();
    }

    /**
     * Final value after drag - pins it and applies it after the update in flight (if any).
     * @param apply Applies the value (e.g. calls the HA service).
     */
    public commit(value: T, apply: LiveUpdateApply<T>): void {
        if (!this._enabled) {
            apply(value);
            return;
        }

        // pin before apply - apply can trigger render, which should already use the pinned value
        this.pin(value);
        this._pending = { value, apply };
        this.tryApplyPending();
    }

    /** Cancels the pending update and releases the pinned value (notifies `onRelease` only when a value was pinned). */
    public stop(): void {
        const wasPinned = this.isPinned;

        this.clearApplyTimeout();
        this.clearReleaseTimeout();
        this._session++; // confirmation of the apply in flight is ignored
        this._pending = null;
        this._pinnedValue = null;
        this._lastSentValue = null;
        this._inFlight = false;
        this._lastApplyTime = 0;

        if (wasPinned) {
            this._onRelease();
        }
    }

    private tryApplyPending() {
        if (!this._pending || this._inFlight || this._applyTimeout)
            return;

        const wait = this._lastApplyTime + Consts.LiveUpdateMinInterval - Date.now();
        if (wait > 0) {
            this._applyTimeout = setTimeout(() => {
                this._applyTimeout = null;
                this.tryApplyPending();
            }, wait);
            return;
        }

        const pending = this._pending;
        this._pending = null;
        this._lastApplyTime = Date.now();
        this._inFlight = true;

        const session = this._session;
        this.waitForConfirmation(() => {
            const result = pending.apply(pending.value);
            // apply without promise sent nothing (e.g. 0 is not sent while sliding)
            if (result) {
                this._lastSentValue = pending.value;
            }
            return result;
        }).then(() => {
            if (session !== this._session)
                return;

            this._inFlight = false;
            if (this._pinnedValue != null) {
                this.restartReleaseTimeout();
            }
            this.tryApplyPending();
        });
    }

    /** @returns Promise resolved when the apply is confirmed, failed or the confirm timeout passed - never rejected. */
    private waitForConfirmation(apply: Func<Promise<unknown> | void>): Promise<void> {
        return new Promise<void>(resolve => {
            const timeout = setTimeout(resolve, Consts.LiveUpdateConfirmTimeout);
            const done = () => {
                clearTimeout(timeout);
                resolve();
            };

            try {
                // failure is treated as done - HA shows the error itself
                Promise.resolve(apply()).then(done, done);
            }
            catch (e) {
                console.error('[LiveUpdateSession] Apply failed', e);
                done();
            }
        });
    }

    private pin(value: T) {
        this._pinnedValue = value;
        this.restartReleaseTimeout();
    }

    /** The pin is released after hold time - also when the drag never finishes (lost pointer). */
    private restartReleaseTimeout() {
        this.clearReleaseTimeout();
        this._releaseTimeout = setTimeout(() => {
            this._releaseTimeout = null;

            // the confirmation will restart the hold time
            if (this._inFlight || this._pending)
                return;

            this._pinnedValue = null;
            this._lastSentValue = null;
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
