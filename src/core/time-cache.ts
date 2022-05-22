export class TimeCache {
    private readonly _cacheInterval: number;
    private _factories = {};
    private _lastValues = {};

    /**
     * Will create time cache with specified interval in miliseconds.
     * When calling getValue or setValue, the value will be cached for given interval.
     */
    constructor(cacheInterval: number) {
        this._cacheInterval = cacheInterval;
    }

    /**
     * Will register property with name and factory function factory.
     */
    registerProperty(name: string, factory: Function) {
        this._factories[name] = factory;
        delete this._lastValues[name];
    }

    /**
     * Sets current value for some property.
     */
    setValue(name: string, value: any) {
        this.ensureExists(name);

        this._lastValues[name] = this.createCacheItem(value);
    }

    /**
     * Gets cached or current value of property
     */
    getValue(name: string): any {
        this.ensureExists(name);

        const now = new Date().getTime();
        var cachedItem = this._lastValues[name];
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

    private ensureExists(name: string) {
        if (!this._factories[name])
            throw Error(`Property with name ${name} is not registered in TimeCache.`)
    }

    private createCacheItem(value: any) {
        return {
            value: value,
            time: new Date().getTime()
        }
    }
}

export class TimeCacheValue {
    /**
     * Will create value returned from propertyFactory, that can avoid being cached.
     */
    constructor(value: any, dontCache: boolean = false) {
        this.value = value;
        this.dontCache = dontCache;
    }

    public value: any;
    public dontCache: boolean;
}