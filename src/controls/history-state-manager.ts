import { Consts } from '../types/consts';
import { Action } from '../types/functions';

interface HueWindowHistoryState {
    isHue?: boolean, // indicate, that theese states is are for us
    hueId: string, // identificator
}

const logMessage = (message: string) => {
    if (Consts.Dev) {
        console.log('[HueHistory] ' + message);
    }
};

export class HueHistoryStep {
    private static lastGeneratedId = 0;

    private readonly _id: string;
    private readonly _type: string | null;
    private readonly _onEnter: Action;
    private readonly _onExit: Action;
    private _isEntered: boolean;

    /**
     * Creates step new step in history.
     * @param onEnter Callback that will be called when this state is entered ()
     */
    public constructor(onEnter: Action, onExit: Action, type: string | null = null) {
        this._type = type;
        this._id = (type ?? 's') + '-' + (++HueHistoryStep.lastGeneratedId);
        this._onEnter = onEnter;
        this._onExit = onExit;
    }

    public get id() {
        return this._id;
    }

    public get type() {
        return this._type;
    }

    /** Gets or sets 1-based position in window.history. */
    public position: number | undefined;

    public get isEntered() {
        return this._isEntered;
    }

    public enter() {
        if (!this._isEntered) {
            logMessage('Entering ' + this._id);
            this._onEnter();
            this._isEntered = true;
        }
    }

    public exit() {
        if (this._isEntered) {
            logMessage('Exiting ' + this._id);
            this._onExit();
            this._isEntered = false;
        }
    }

    public getHistoryState(): HueWindowHistoryState {
        return {
            isHue: true,
            hueId: this.id
        };
    }
}

interface HistoryStackMoveResult {
    toExit: HueHistoryStep[],
    toEnter: HueHistoryStep[],
    found: boolean,
}

class HistoryStack {
    private readonly _stack: Array<HueHistoryStep>;
    /** index in _stack */
    private _pointer = -1;

    public constructor() {
        this._stack = [];
    }

    private logState(message: string) {
        logMessage(message);
        logMessage('Stack: ' + this._stack.length);
        if (this._pointer < 0) {
            logMessage('[x]');
        }
        for (let i = 0; i < this._stack.length; i++) {
            const m = (i == this._pointer ? '[x] ' : '[ ] ') + this._stack[i].id;
            logMessage(m);
        }
    }

    /** Will set the pointer before first state */
    public resetBeforeStart(): HistoryStackMoveResult {
        // get all items needed to exit
        const toExit = [];
        for (let i = this._pointer; i >= 0; i--) {
            toExit.push(this._stack[this._pointer]);
        }

        this._pointer = -1;

        return {
            toExit,
            toEnter: [],
            found: true
        };
    }

    /** Will add item after the current position */
    public push(item: HueHistoryStep) {
        // remove all items after the pointer
        while (this._stack.length > (this._pointer + 1)) {
            this._stack.pop();
            // not calling exit, they should be exited
        }

        // push new items
        this._stack.push(item);
        this._pointer = this._stack.length - 1;

        this.logState('Pushed ' + item.id);
    }

    /** Will check if types are compatible, if so, will replace current item with the given one. */
    public replaceIfPossible(item: HueHistoryStep) {
        // check if replace is possible
        if (item.type && this._pointer >= 0) {
            const oldItem = this._stack[this._pointer];
            if (oldItem.type == item.type) {
                this._stack[this._pointer] = item;
                this.logState('Replaced ' + oldItem.id + ' with ' + item.id);
                return {
                    replaced: true,
                    oldItem
                };
            }
        }

        logMessage('Replace not possible for ' + item.id);
        return {
            replaced: false,
            oldItem: undefined
        };
    }

    /** Will try to find given id */
    public moveTo(id: string): HistoryStackMoveResult {
        let found = false;
        const toExit = [];
        const toEnter: HueHistoryStep[] = [];

        // first try to find in history
        for (let i = this._pointer; i >= 0; i--) {
            const item = this._stack[i];
            if (item.id == id) {
                // we found the item - set pointer and break cycle
                this._pointer = i;
                found = true;
                break;
            } else {
                // not found, but is on the path - should be exited
                toExit.push(item);
            }
        }
        if (!found) {
            // clear items
            toExit.length = 0;
        } else {
            this.logState('Moved to ' + id);
            return {
                found,
                toExit,
                toEnter
            };
        }

        // try to find in future
        for (let i = this._pointer + 1; i < this._stack.length; i++) {
            const item = this._stack[i];
            if (item.id == id) {
                // we found the item - set pointer and break cycle
                this._pointer = i;
                found = true;
            }
            // enter everything we go through
            toEnter.push(item);
            if (found) {
                break;
            }
        }
        if (!found) {
            // clear items
            toEnter.length = 0;
            logMessage('NOT moved to ' + id);
        } else {
            this.logState('Moved to ' + id);
        }

        return {
            found,
            toExit,
            toEnter
        };
    }

    /**
     * Returns number of steps back in history, to reach the given ID.
     */
    public stepsBackBefore(id: string): number | null {
        for (let i = this._pointer; i >= 0; i--) {
            const item = this._stack[i];
            if (item.id == id) {
                const result = this._pointer - i + 1; // +1 => we want to go one step before this item;
                this.logState(result + ' steps back needed to go before ' + id);
                return result;
            }
        }
        return null;
    }

    public isEmpty() {
        return this._stack.length == 0;
    }
}

/**
 * Manager, that takes care of opening dialogs/views and getting through history and back.
 */
export class HueHistoryStateManager {

    //#region Singleton

    private static _instance: HueHistoryStateManager;
    public static get instance(): HueHistoryStateManager {
        return this._instance || (this._instance = new this());
    }

    //#endregion

    private readonly _states: HistoryStack;

    private constructor() {
        this._states = new HistoryStack();

        window.addEventListener('popstate', (ev: PopStateEvent) => this.resolvePopstate(ev));
    }

    private resolvePopstate(ev: PopStateEvent) {
        const state = <HueWindowHistoryState | undefined>ev.state;
        let moveResult: HistoryStackMoveResult;
        if (state?.isHue == true) {
            // ensure that the current history state is the same as in event (another listener might have changed this)
            window.history.replaceState(state, '');

            // move to the 
            moveResult = this._states.moveTo(state.hueId);
        } else {
            // we must be before out stack, so get back
            moveResult = this._states.resetBeforeStart();
        }

        // execute the moveResult
        if (moveResult.found) {
            moveResult.toExit.forEach(i => i.exit());
            moveResult.toEnter.forEach(i => i.enter());
        }
    }

    public addStep(newStep: HueHistoryStep) {
        // first step - setup baseStep
        if (this._states.isEmpty()) {
            const noop = () => { };
            const baseItem = new HueHistoryStep(noop, noop, 'startStep');
            this._states.push(baseItem);

            // set current step to start
            window.history.replaceState(baseItem.getHistoryState(), '');
        }

        const historyState = newStep.getHistoryState();

        // try to replace
        const replaceResult = this._states.replaceIfPossible(newStep);
        if (replaceResult.replaced) { // state replaced

            // do replace in history
            window.history.replaceState(historyState, '');

            // save oldItem's position into newItem
            newStep.position = replaceResult.oldItem?.position;
        } else { // replace not possible, classic push

            // push it to stack
            this._states.push(newStep);

            // add it to the history
            window.history.pushState(historyState, '');

            // save position
            newStep.position = window.history.length; // new state has been pushed, our state is latest
        }

        // call enter function
        newStep.enter();
    }

    /** Will go to the state in history, before given step. */
    public goBefore(exitedStep: HueHistoryStep) {
        const backSteps = this._states.stepsBackBefore(exitedStep.id);
        if (backSteps) {
            window.history.go(-backSteps);
        }
    }
}

/* Scenario:
 1. openDialog
    - replaceState to firstState
    - pushState - dialog
 2. openDetail
    - pushState - detail
 3. back
    - popState - find prev. state (openDialog)
 4. forward
    - popState - find next state (openDetail)
 5. back
    - popState - find prev. state (openDialog)
 6. back
    - popState - find prev. state (firstState)
 7. forward
    - popState - find next state (openDialog)
 8. forward
    - popState - find next state (openDetail)

 */