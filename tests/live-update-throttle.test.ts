import { LiveUpdateThrottle } from '../src/core/live-update-throttle';
import { Consts } from '../src/types/consts';

describe('LiveUpdateThrottle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should apply the first update immediately', () => {
        const throttle = new LiveUpdateThrottle<number>(300);
        const apply = jest.fn();

        throttle.update(10, apply);

        expect(apply).toHaveBeenCalledTimes(1);
        expect(apply).toHaveBeenCalledWith(10);
    });

    it('should apply only the latest value at the end of the interval', () => {
        const throttle = new LiveUpdateThrottle<number>(300);
        const apply = jest.fn();

        throttle.update(10, apply);
        jest.advanceTimersByTime(100);
        throttle.update(20, apply);
        throttle.update(30, apply);

        expect(apply).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(200);

        expect(apply).toHaveBeenCalledTimes(2);
        expect(apply).toHaveBeenLastCalledWith(30);
    });

    it('should apply again immediately after the interval passed', () => {
        const throttle = new LiveUpdateThrottle<number>(300);
        const apply = jest.fn();

        throttle.update(10, apply);
        jest.advanceTimersByTime(400);
        throttle.update(20, apply);

        expect(apply).toHaveBeenCalledTimes(2);
        expect(apply).toHaveBeenLastCalledWith(20);
    });

    it('should pin every updated value', () => {
        const throttle = new LiveUpdateThrottle<number>(300);
        const apply = jest.fn();

        throttle.update(10, apply);
        throttle.update(20, apply);

        expect(throttle.isPinned).toBe(true);
        expect(throttle.pinnedValue).toBe(20);
    });

    it('should cancel pending update and apply the value on commit', () => {
        const throttle = new LiveUpdateThrottle<number>(300);
        const apply = jest.fn();

        throttle.update(10, apply);
        throttle.update(20, apply);
        throttle.commit(50, apply);
        jest.advanceTimersByTime(300);

        expect(apply.mock.calls).toEqual([[10], [50]]);
    });

    it('should keep the committed value pinned for the hold time and then notify', () => {
        const onRelease = jest.fn();
        const throttle = new LiveUpdateThrottle<number>(300, onRelease);

        throttle.commit(50, jest.fn());

        jest.advanceTimersByTime(Consts.LiveUpdateHoldTime - 1);
        expect(throttle.pinnedValue).toBe(50);
        expect(onRelease).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(throttle.pinnedValue).toBeNull();
        expect(throttle.isPinned).toBe(false);
        expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it('should release the pin when the drag never finishes', () => {
        const onRelease = jest.fn();
        const throttle = new LiveUpdateThrottle<number>(300, onRelease);

        throttle.update(10, jest.fn());
        jest.advanceTimersByTime(Consts.LiveUpdateHoldTime);

        expect(throttle.isPinned).toBe(false);
        expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it('should apply the next update immediately after commit', () => {
        const throttle = new LiveUpdateThrottle<number>(300);
        const apply = jest.fn();

        throttle.update(10, apply);
        throttle.commit(50, apply);
        throttle.update(60, apply);

        expect(apply.mock.calls).toEqual([[10], [50], [60]]);
    });

    it('should restart the hold time when a new value is pinned', () => {
        const onRelease = jest.fn();
        const throttle = new LiveUpdateThrottle<number>(300, onRelease);

        throttle.commit(50, jest.fn());
        jest.advanceTimersByTime(Consts.LiveUpdateHoldTime - 1);
        throttle.update(60, jest.fn());
        jest.advanceTimersByTime(1);

        expect(throttle.pinnedValue).toBe(60);
        expect(onRelease).not.toHaveBeenCalled();
    });

    it('should pin a zero value', () => {
        const throttle = new LiveUpdateThrottle<number>(300);

        throttle.update(0, jest.fn());

        expect(throttle.isPinned).toBe(true);
        expect(throttle.pinnedValue).toBe(0);
    });

    it('should do nothing on update when disabled', () => {
        const throttle = new LiveUpdateThrottle<number>(0);
        const apply = jest.fn();

        throttle.update(10, apply);
        jest.advanceTimersByTime(1000);

        expect(throttle.isEnabled).toBe(false);
        expect(apply).not.toHaveBeenCalled();
        expect(throttle.isPinned).toBe(false);
    });

    it('should only apply the value on commit when disabled', () => {
        const onRelease = jest.fn();
        const throttle = new LiveUpdateThrottle<number>(0, onRelease);
        const apply = jest.fn();

        throttle.commit(50, apply);

        expect(apply).toHaveBeenCalledWith(50);
        expect(throttle.isPinned).toBe(false);

        jest.advanceTimersByTime(Consts.LiveUpdateHoldTime);
        expect(onRelease).not.toHaveBeenCalled();
    });

    it('should cancel everything on stop without notification', () => {
        const onRelease = jest.fn();
        const throttle = new LiveUpdateThrottle<number>(300, onRelease);
        const apply = jest.fn();

        throttle.update(10, apply);
        throttle.update(20, apply);
        throttle.stop();
        jest.advanceTimersByTime(Consts.LiveUpdateHoldTime);

        expect(apply).toHaveBeenCalledTimes(1);
        expect(throttle.isPinned).toBe(false);
        expect(onRelease).not.toHaveBeenCalled();
    });

    it('should apply immediately after stop', () => {
        const throttle = new LiveUpdateThrottle<number>(300);
        const apply = jest.fn();

        throttle.update(10, apply);
        throttle.stop();
        throttle.update(20, apply);

        expect(apply.mock.calls).toEqual([[10], [20]]);
    });
});
