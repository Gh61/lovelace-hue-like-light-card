import { ValueFactory } from '../types/types-interface';

export class TimeCacheValue {
    /**
     * Will create value returned from propertyFactory, that can avoid being cached.
     */
    public constructor(value: unknown, dontCache = false) {
        this.value = value;
        this.dontCache = dontCache;
    }

    public value: unknown;
    public dontCache: boolean;
}

export class TimeCache<TKey extends string> {
    private readonly _cacheInterval: number;
    private _factories:Record<string, ValueFactory> = {};
    private _lastValues:Record<string, TimeCacheItem> = {};

    /**
     * Will create time cache with specified interval in miliseconds.
     * When calling getValue or setValue, the value will be cached for given interval.
     */
    public constructor(cacheInterval: number) {
        this._cacheInterval = cacheInterval;
    }

    /**
     * Will register property with name and factory function factory.
     */
    public registerProperty(name: TKey, factory: ValueFactory) {
        this._factories[name] = factory;
        delete this._lastValues[name];
    }

    /**
     * Sets current value for some property.
     */
    public setValue(name: TKey, value: unknown) {
        this.ensureExists(name);

        this._lastValues[name] = this.createCacheItem(value);
    }

    /**
     * Gets cached or current value of property
     */
    public getValue(name: TKey): unknown {
        this.ensureExists(name);

        const now = new Date().getTime();
        const cachedItem = this._lastValues[name];
        if (cachedItem && (now - cachedItem.time) < this._cacheInterval) {
            return cachedItem.value;
        }
        let value = this._factories[name]();
        let dontCache = false;
        if (value instanceof TimeCacheValue) {
            const cacheValue = <TimeCacheValue>value;
            value = cacheValue.value;
            dontCache = cacheValue.dontCache;
        }

        if (!dontCache) {
            this.setValue(name, value);
        }

        return value;
    }

    private ensureExists(name: TKey) {
        if (!this._factories[name])
            throw Error(`Property with name ${name} is not registered in TimeCache.`);
    }

    private createCacheItem(value: unknown):TimeCacheItem {
        return {
            value: value,
            time: new Date().getTime()
        };
    }
}

interface TimeCacheItem {
    value:unknown;
    time:number
}