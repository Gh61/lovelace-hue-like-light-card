import { Action } from '../types/functions';

class QueueItem {
    constructor(action:Action, waitBeforeMs:number) {
        this._waitAfter = waitBeforeMs;
        this._action = action;
    }

    private _action : Action;
    public get action() : Action {
        return this._action;
    }

    private _waitAfter : number;
    public get waitAfter() : number {
        return this._waitAfter;
    }
}

export class HueEffectQueue {
    private readonly _queue = new Array<QueueItem>();
    private _currentEffectId: NodeJS.Timeout | null = null;

    public get currentEffectId() {
        return this._currentEffectId;
    }

    public addEffect(waitBeforeMs:number, action:Action) {
        const item = new QueueItem(action, waitBeforeMs);
        this._queue.push(item);
    }

    public start() {
        let i = 0;
        const callback = () => { this.planEffect(++i, callback); };
        this.planEffect(i, callback);
    }

    public stop() {
        if (this._currentEffectId) {
            clearTimeout(this._currentEffectId);
            this._currentEffectId = null;
        }
    }

    public stopAndClear() {
        this.stop();
        this._queue.length = 0;
    }

    private planEffect(index:number, callback:Action | null = null) {
        if (index >= this._queue.length) {
            this._currentEffectId = null;
            return;
        }

        const item = this._queue[index];
        this._currentEffectId = setTimeout(() => {
            item.action();
            if (callback) {
                callback();
            }
        }, item.waitAfter);
    }
}