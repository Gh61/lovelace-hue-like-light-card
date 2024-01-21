import { Consts } from '../types/consts';
import { Action2 } from '../types/functions';
import { INotifyGeneric } from '../types/types-interface';

export abstract class NotifyBase<TThis> implements INotifyGeneric<TThis> {
    private _propertyChangedCallbacks: Record<string, {
        invoke: Action2<(keyof TThis)[], TThis>,
        includeHass: boolean
    }>;

    protected constructor() {
        this._propertyChangedCallbacks = {};
    }

    protected raisePropertyChanged(...propertyNames: (keyof TThis)[]): void {
        const onlyHass = propertyNames.length == 1 && propertyNames[0] == 'hass';
        this.log(`${this.constructor.name} changed [${propertyNames.join(', ')}] (onlyHass:${onlyHass})`);

        for (const callbackId in this._propertyChangedCallbacks) {
            const handler = this._propertyChangedCallbacks[callbackId];

            if (handler.includeHass || !onlyHass) {
                this.log(`${this.constructor.name} changed [${propertyNames.join(', ')}] for ${callbackId}`);
                handler.invoke(propertyNames, <TThis><unknown>this);
            }
        }
    }

    /**
     * Will register callback on property change events. 
     * @param id Id for this specific callback. If this id already exists, it's callback will be overwriten.
     * @param callback Action that will be called when any supported property if changed (takes propertyName as parameter).
     * @param includeHass Specifies, whether change only in 'hass' property should be included (set to false to ignore).
     */
    public registerOnPropertyChanged(id: string, callback: Action2<(keyof TThis)[], TThis>, includeHass = false) {
        this._propertyChangedCallbacks[id] = {
            invoke: callback,
            includeHass: includeHass
        };
        this.log(`Registered change of ${this.constructor.name} by control: '${id}' (includeHass:${includeHass})`);
    }

    /**
     * Will unregister callback from property change events.
     * @param id Id for specific callback
     */
    public unregisterOnPropertyChanged(id: string) {
        delete this._propertyChangedCallbacks[id];
        this.log(`Unregistered change of ${this.constructor.name} for control: '${id}'`);
    }

    private log(message: string) {
        if (Consts.Dev) {
            console.log('[HueNotify] ' + message);
        }
    }
}