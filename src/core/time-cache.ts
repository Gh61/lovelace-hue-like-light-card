export class TimeCache
{
    private readonly _cacheInterval:number;
    private _factories = {};
    private _lastValues = {};

    /**
     * Will create time cache with specified interval in miliseconds.
     * When calling getValue or setValue, the value will be cached for given interval.
     */
    constructor(cacheInterval) {
        this._cacheInterval = cacheInterval;
    }

    /**
     * Will register property with name and factory function factory.
     */
    registerProperty(name: string, factory: Function)
    {
        this._factories[name] = factory;
        delete this._lastValues[name];
    }

    setValue(name: string, value)
    {
        this.ensureExists(name);

        this._lastValues[name] = this.createCacheItem(value);
    }

    getValue(name: string)
    {
        this.ensureExists(name);

        const now = new Date().getTime();
        var cachedItem = this._lastValues[name];
        if (cachedItem && (now - cachedItem.time) < this._cacheInterval)
        {
            return cachedItem.value;
        }
        const value = this._factories[name]();
        this.setValue(name, value);
        return value;
    }

    private ensureExists(name:string){
        if(!this._factories[name])
            throw Error(`Property with name ${name} is not registered in TimeCache.`)
    }

    private createCacheItem(value:any) {
        return {
            value: value,
            time: new Date().getTime()
        }
    }
}