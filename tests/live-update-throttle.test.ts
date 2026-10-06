import { LiveUpdateThrottle } from '../src/core/live-update-throttle';
import { Consts } from '../src/types/consts';
import { noop } from '../src/types/functions';

/** Apply mock returning a promise that is resolved/rejected by the test (one per call). */
function createApply() {
    const calls: { resolve: () => void, reject: () => void }[] = [];
    const apply = jest.fn<Promise<void>, [number]>(() => new Promise<void>((resolve, reject) => calls.push({ resolve, reject })));
    return { apply, calls };
}

describe('LiveUpdateThrottle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should apply the first update immediately', () => {
        const throttle = new LiveUpdateThrottle<number>(true);
        const { apply } = createApply();

        throttle.update(10, apply);

        expect(apply).toHaveBeenCalledTimes(1);
        expect(apply).toHaveBeenCalledWith(10);
    });

    it('should wait for the confirmation and then apply only the latest value', async () => {
        const throttle = new LiveUpdateThrottle<number>(true);
        const { apply, calls } = createApply();

        throttle.update(10, apply);
        throttle.update(20, apply);
        throttle.update(30, apply);
        await jest.advanceTimersByTimeAsync(1000);

        expect(apply).toHaveBeenCalledTimes(1);

        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(0);

        expect(apply.mock.calls).toEqual([[10], [30]]);
    });

    it('should keep the minimal interval after a fast confirmation', async () => {
        const throttle = new LiveUpdateThrottle<number>(true);
        const { apply, calls } = createApply();

        throttle.update(10, apply);
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(50);
        throttle.update(20, apply);

        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval - 51);
        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1);
        expect(apply.mock.calls).toEqual([[10], [20]]);
    });

    it('should continue after a failed apply', async () => {
        const throttle = new LiveUpdateThrottle<number>(true);
        const { apply, calls } = createApply();

        throttle.update(10, apply);
        throttle.update(20, apply);
        calls[0].reject();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[10], [20]]);
    });

    it('should continue after an apply that throws', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(noop);
        const throttle = new LiveUpdateThrottle<number>(true);
        const apply = jest.fn((value: number) => {
            if (value === 10)
                throw new Error('test');
        });

        throttle.update(10, apply);
        throttle.update(20, apply);
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[10], [20]]);
        expect(consoleError).toHaveBeenCalledTimes(1);
        consoleError.mockRestore();
    });

    it('should continue after the confirm timeout when HA never answers', async () => {
        const throttle = new LiveUpdateThrottle<number>(true);
        const { apply } = createApply();

        throttle.update(10, apply);
        throttle.update(20, apply);
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateConfirmTimeout - 1);
        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1);
        expect(apply.mock.calls).toEqual([[10], [20]]);
    });

    it('should apply the commit after the update in flight', async () => {
        const throttle = new LiveUpdateThrottle<number>(true);
        const { apply, calls } = createApply();

        throttle.update(10, apply);
        throttle.update(20, apply);
        throttle.commit(50, apply);

        expect(apply).toHaveBeenCalledTimes(1);

        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[10], [50]]);
    });

    it('should apply the commit after the minimal interval when the previous apply was confirmed fast', async () => {
        const throttle = new LiveUpdateThrottle<number>(true);
        const { apply, calls } = createApply();

        throttle.update(10, apply);
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(50);
        throttle.commit(50, apply);

        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval - 50);
        expect(apply.mock.calls).toEqual([[10], [50]]);
    });

    it('should apply the commit immediately when nothing is in flight', () => {
        const throttle = new LiveUpdateThrottle<number>(true);
        const { apply } = createApply();

        throttle.commit(50, apply);

        expect(apply.mock.calls).toEqual([[50]]);
    });

    it('should pin every updated value', () => {
        const throttle = new LiveUpdateThrottle<number>(true);
        const { apply } = createApply();

        throttle.update(10, apply);
        throttle.update(20, apply);

        expect(throttle.isPinned).toBe(true);
        expect(throttle.pinnedValue).toBe(20);
    });

    it('should keep the committed value pinned for the hold time after the confirmation and then notify', async () => {
        const onRelease = jest.fn();
        const throttle = new LiveUpdateThrottle<number>(true, onRelease);
        const { apply, calls } = createApply();

        throttle.commit(50, apply);
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime + 1000);
        expect(throttle.pinnedValue).toBe(50); // not confirmed yet

        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime - 1);
        expect(throttle.pinnedValue).toBe(50);
        expect(onRelease).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1);
        expect(throttle.pinnedValue).toBeNull();
        expect(throttle.isPinned).toBe(false);
        expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it('should release the pin when the drag never finishes', async () => {
        const onRelease = jest.fn();
        const throttle = new LiveUpdateThrottle<number>(true, onRelease);

        throttle.update(10, jest.fn());
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime);

        expect(throttle.isPinned).toBe(false);
        expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it('should restart the hold time when a new value is pinned', async () => {
        const onRelease = jest.fn();
        const throttle = new LiveUpdateThrottle<number>(true, onRelease);

        throttle.commit(50, jest.fn());
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime - 1);
        throttle.update(60, jest.fn());
        await jest.advanceTimersByTimeAsync(1);

        expect(throttle.pinnedValue).toBe(60);
        expect(onRelease).not.toHaveBeenCalled();
    });

    it('should pin a zero value', () => {
        const throttle = new LiveUpdateThrottle<number>(true);

        throttle.update(0, jest.fn());

        expect(throttle.isPinned).toBe(true);
        expect(throttle.pinnedValue).toBe(0);
    });

    it('should do nothing on update when disabled', async () => {
        const throttle = new LiveUpdateThrottle<number>(false);
        const apply = jest.fn();

        throttle.update(10, apply);
        await jest.advanceTimersByTimeAsync(1000);

        expect(throttle.isEnabled).toBe(false);
        expect(apply).not.toHaveBeenCalled();
        expect(throttle.isPinned).toBe(false);
    });

    it('should only apply the value on commit when disabled', async () => {
        const onRelease = jest.fn();
        const throttle = new LiveUpdateThrottle<number>(false, onRelease);
        const apply = jest.fn();

        throttle.commit(50, apply);

        expect(apply).toHaveBeenCalledWith(50);
        expect(throttle.isPinned).toBe(false);

        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime);
        expect(onRelease).not.toHaveBeenCalled();
    });

    it('should cancel everything on stop without notification', async () => {
        const onRelease = jest.fn();
        const throttle = new LiveUpdateThrottle<number>(true, onRelease);
        const { apply, calls } = createApply();

        throttle.update(10, apply);
        throttle.update(20, apply);
        throttle.stop();
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime);

        expect(apply).toHaveBeenCalledTimes(1);
        expect(throttle.isPinned).toBe(false);
        expect(onRelease).not.toHaveBeenCalled();
    });

    it('should apply immediately after stop', () => {
        const throttle = new LiveUpdateThrottle<number>(true);
        const { apply } = createApply();

        throttle.update(10, apply);
        throttle.stop();
        throttle.update(20, apply);

        expect(apply.mock.calls).toEqual([[10], [20]]);
    });

    it('should ignore the confirmation of an apply sent before stop', async () => {
        const throttle = new LiveUpdateThrottle<number>(true);
        const { apply, calls } = createApply();

        throttle.update(10, apply);
        throttle.stop();
        throttle.update(20, apply);
        throttle.update(30, apply);
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[10], [20]]); // 30 still waits for the confirmation of 20

        calls[1].resolve();
        await jest.advanceTimersByTimeAsync(0);
        expect(apply.mock.calls).toEqual([[10], [20], [30]]);
    });
});
