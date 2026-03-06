export class LimitedTimeout {
    private count = 0

    public constructor(private readonly maxCount: number) { }

    public setTimeout(callback: () => void, delayMs: number): void {
        if (this.count >= this.maxCount) {
            console.warn(`[Hue.LimitedTimeout]: Maximum timeout limit ${this.maxCount} reached, another timeout is ignored.`);
            return
        }

        this.count += 1
        globalThis.setTimeout(callback, delayMs)
    }

    public reset(): void {
        this.count = 0
    }
}