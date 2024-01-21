import { Consts } from '../types/consts';
import { Action2 } from '../types/functions';
import { INotifyGeneric } from '../types/types-interface';

export abstract class NotifyBase<TThis> implements INotifyGeneric<TThis> {
    private _propertyChangedCallbacks: Record<string, Action2<(keyof TThis)[], TThis>>;

    protected constructor() {
        this._propertyChangedCallbacks = {};
    }

    /*
     * !!!!!
     * TODO: filter hass PropertyChanged?
     */

    protected raisePropertyChanged(...propertyNames: (keyof TThis)[]): void {
        this.log(`Firing ${this.constructor.name}.PropertyChanged changed [${propertyNames.join(', ')}].`);
        for (const callbackId in this._propertyChangedCallbacks) {
            this.log(`Firing ${this.constructor.name}.PropertyChanged changed [${propertyNames.join(', ')}] for ${callbackId}.`);
            this._propertyChangedCallbacks[callbackId](propertyNames, <TThis><unknown>this);
        }
    }

    /**
     * Will register callback on property change events. 
     * @param id Id for this specific callback. If this id already exists, it's callback will be overwriten.
     * @param callback Action that will be called when any supported property if changed (takes propertyName as parameter).
     */
    public registerOnPropertyChanged(id: string, callback: Action2<(keyof TThis)[], TThis>) {
        this._propertyChangedCallbacks[id] = callback;
        this.log(`Registered ${this.constructor.name}.PropertyChanged by control ID: '${id}'`);
    }

    /**
     * Will unregister callback from property change events.
     * @param id Id for specific callback
     */
    public unregisterOnPropertyChanged(id: string) {
        delete this._propertyChangedCallbacks[id];
        this.log(`Unregistered ${this.constructor.name}.PropertyChanged by control ID: '${id}'`);
    }

    private log(message: string) {
        if (Consts.Dev) {
            console.log(message);
        }
    }
}