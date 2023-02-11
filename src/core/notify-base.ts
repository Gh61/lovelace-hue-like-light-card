import { Action1 } from '../types/functions';

export abstract class NotifyBase<TThis> {
    private _propertyChangedCallbacks:Record<string, Action1<keyof TThis>>;

    public constructor() {
        this._propertyChangedCallbacks = {};
    }

    protected raisePropertyChanged(propertyName:keyof TThis) : void {
        for (const callbackId in this._propertyChangedCallbacks) {
            this._propertyChangedCallbacks[callbackId](propertyName);
        }
    }

    /**
     * Will register callback on property change events. 
     * @param id Id for this specific callback. If this id already exists, it's callback will be overwriten.
     * @param callback Action that will be called when any supported property if changed (takes propertyName as parameter).
     */
    public registerOnPropertyChanged(id:string, callback:Action1<keyof TThis>) {
        this._propertyChangedCallbacks[id] = callback;
    }

    /**
     * Will unregister callback from property change events.
     * @param id Id for specific callback
     */
    public unregisterOnPropertyChanged(id:string) {
        delete this._propertyChangedCallbacks[id];
    }
}