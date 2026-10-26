import { LiveUpdateSession } from '../src/core/live-update-session';
import { Consts } from '../src/types/consts';
import { noop } from '../src/types/functions';

/** Apply mock returning a promise that is resolved/rejected by the test (one per call). */
function createApply() {
    const calls: { resolve: () => void, reject: () => void }[] = [];
    const apply = jest.fn<Promise<void>, [number]>(() => new Promise<void>((resolve, reject) => calls.push({ resolve, reject })));
    return { apply, calls };
}

/** Delay of the first value of a movement with the default minimal interval. */
const FirstDelay = Consts.LiveUpdateMinInterval / 2;

describe('LiveUpdateSession', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should apply the first update after half of the minimal interval', () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay - 1);
        expect(apply).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(apply.mock.calls).toEqual([[10]]);
    });

    it('should apply only the latest value after the delay of the first update', () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply } = createApply();

        session.update(10, apply);
        session.update(20, apply);
        session.update(30, apply);
        jest.advanceTimersByTime(FirstDelay);

        expect(apply.mock.calls).toEqual([[30]]);
    });

    it('should delay the first update by half of a custom minimal interval', () => {
        const session = new LiveUpdateSession<number>(true, noop, () => 1000);
        const { apply } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(499);
        expect(apply).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(apply.mock.calls).toEqual([[10]]);
    });

    it('should delay the first update of a resumed movement', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        session.update(20, apply);
        jest.advanceTimersByTime(FirstDelay - 1);
        expect(apply.mock.calls).toEqual([[10]]);

        jest.advanceTimersByTime(1);
        expect(apply.mock.calls).toEqual([[10], [20]]);
    });

    it('should wait for the confirmation and then apply only the latest value', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.update(20, apply);
        session.update(30, apply);
        await jest.advanceTimersByTimeAsync(1000);

        expect(apply).toHaveBeenCalledTimes(1);

        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(0);

        expect(apply.mock.calls).toEqual([[10], [30]]);
    });

    it('should keep the minimal interval after a fast confirmation', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(50);
        session.update(20, apply);

        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval - 51);
        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1);
        expect(apply.mock.calls).toEqual([[10], [20]]);
    });

    it('should respect a custom minimal interval and re-read it before every apply', async () => {
        let interval = 1000;
        const session = new LiveUpdateSession<number>(true, noop, () => interval);
        const { apply, calls } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(500);
        calls[0].resolve();
        session.update(20, apply);
        await jest.advanceTimersByTimeAsync(999);
        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1);
        expect(apply.mock.calls).toEqual([[10], [20]]);

        interval = 300;
        calls[1].resolve();
        session.update(30, apply);
        await jest.advanceTimersByTimeAsync(300);
        expect(apply.mock.calls).toEqual([[10], [20], [30]]);
    });

    it('should continue after a failed apply', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.update(20, apply);
        calls[0].reject();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[10], [20]]);
    });

    it('should continue after an apply that throws', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation(noop);
        const session = new LiveUpdateSession<number>(true);
        const apply = jest.fn((value: number) => {
            if (value === 10)
                throw new Error('test');
        });

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.update(20, apply);
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[10], [20]]);
        expect(consoleError).toHaveBeenCalledTimes(1);
        consoleError.mockRestore();
    });

    it('should continue after the confirm timeout when HA never answers', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.update(20, apply);
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateConfirmTimeout - 1);
        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1);
        expect(apply.mock.calls).toEqual([[10], [20]]);
    });

    it('should apply the commit after the update in flight', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.update(20, apply);
        session.commit(50, apply);

        expect(apply).toHaveBeenCalledTimes(1);

        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[10], [50]]);
    });

    it('should apply the commit after the minimal interval when the previous apply was confirmed fast', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(50);
        session.commit(50, apply);

        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval - 50);
        expect(apply.mock.calls).toEqual([[10], [50]]);
    });

    it('should keep the minimal interval when the commit replaces an update waiting for it', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(50);
        session.update(20, apply);
        session.commit(30, apply);

        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval - 51);
        expect(apply.mock.calls).toEqual([[10]]);

        await jest.advanceTimersByTimeAsync(1);
        expect(apply.mock.calls).toEqual([[10], [30]]);
    });

    it('should apply the commit immediately when nothing is in flight', () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply } = createApply();

        session.commit(50, apply);

        expect(apply.mock.calls).toEqual([[50]]);
    });

    it('should pin every updated value', () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply } = createApply();

        session.update(10, apply);
        session.update(20, apply);

        expect(session.isPinned).toBe(true);
        expect(session.pinnedValue).toBe(20);
    });

    it('should keep the committed value pinned for the hold time after the confirmation and then notify', async () => {
        const onRelease = jest.fn();
        const session = new LiveUpdateSession<number>(true, onRelease);
        const { apply, calls } = createApply();

        session.commit(50, apply);
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime + 1000);
        expect(session.pinnedValue).toBe(50); // not confirmed yet

        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime - 1);
        expect(session.pinnedValue).toBe(50);
        expect(onRelease).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1);
        expect(session.pinnedValue).toBeNull();
        expect(session.isPinned).toBe(false);
        expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it('should release the pin when the drag never finishes', async () => {
        const onRelease = jest.fn();
        const session = new LiveUpdateSession<number>(true, onRelease);

        session.update(10, jest.fn());
        await jest.advanceTimersByTimeAsync(FirstDelay + Consts.LiveUpdateHoldTime);

        expect(session.isPinned).toBe(false);
        expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it('should restart the hold time when a new value is pinned', async () => {
        const onRelease = jest.fn();
        const session = new LiveUpdateSession<number>(true, onRelease);

        session.commit(50, jest.fn());
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime - 1);
        session.update(60, jest.fn());
        await jest.advanceTimersByTimeAsync(1);

        expect(session.pinnedValue).toBe(60);
        expect(onRelease).not.toHaveBeenCalled();
    });

    it('should pin a zero value', () => {
        const session = new LiveUpdateSession<number>(true);

        session.update(0, jest.fn());

        expect(session.isPinned).toBe(true);
        expect(session.pinnedValue).toBe(0);
    });

    it('should do nothing on update when disabled', async () => {
        const session = new LiveUpdateSession<number>(false);
        const apply = jest.fn();

        session.update(10, apply);
        await jest.advanceTimersByTimeAsync(1000);

        expect(session.isEnabled).toBe(false);
        expect(apply).not.toHaveBeenCalled();
        expect(session.isPinned).toBe(false);
    });

    it('should only apply the value on commit when disabled', async () => {
        const onRelease = jest.fn();
        const session = new LiveUpdateSession<number>(false, onRelease);
        const apply = jest.fn();

        session.commit(50, apply);

        expect(apply).toHaveBeenCalledWith(50);
        expect(session.isPinned).toBe(false);

        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime);
        expect(onRelease).not.toHaveBeenCalled();
    });

    it('should cancel everything on stop and notify the release once', async () => {
        const onRelease = jest.fn();
        const session = new LiveUpdateSession<number>(true, onRelease);
        const { apply, calls } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.update(20, apply);
        session.stop();
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime);

        expect(apply).toHaveBeenCalledTimes(1);
        expect(session.isPinned).toBe(false);
        expect(session.lastSentValue).toBeNull();
        expect(onRelease).toHaveBeenCalledTimes(1);
    });

    it('should not notify on stop when nothing is pinned', () => {
        const onRelease = jest.fn();
        const session = new LiveUpdateSession<number>(true, onRelease);

        session.stop();

        expect(onRelease).not.toHaveBeenCalled();
    });

    it('should remember the last sent value until the release', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        expect(session.lastSentValue).toBeNull();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.update(20, apply);
        expect(session.lastSentValue).toBe(10); // 20 waits for the confirmation

        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);
        expect(session.lastSentValue).toBe(20);

        calls[1].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime);
        expect(session.lastSentValue).toBeNull();
    });

    it('should not remember an apply that sent nothing', () => {
        const session = new LiveUpdateSession<number>(true);

        session.update(0, () => undefined);
        jest.advanceTimersByTime(FirstDelay);

        expect(session.lastSentValue).toBeNull();
    });

    /** Final apply like the real ones - skips the value already sent by live update. */
    function createCommitApply(session: LiveUpdateSession<number>, apply: (v: number) => Promise<void>) {
        return (v: number) => v !== session.lastSentValue ? apply(v) : undefined;
    }

    it('should apply the commit right away instead of the delayed first update (single click)', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply } = createApply();

        session.update(50, apply);
        session.commit(50, createCommitApply(session, apply));
        expect(apply.mock.calls).toEqual([[50]]);

        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);
        expect(apply.mock.calls).toEqual([[50]]);
    });

    it('should skip the final value already sent by live update', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(50, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.commit(50, createCommitApply(session, apply));
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[50]]);
    });

    it('should send the final value that replaced a pending update', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.update(20, apply);
        session.commit(30, createCommitApply(session, apply));
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[10], [30]]);
    });

    it('should send the final 0 when 0 was not sent while sliding', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply } = createApply();

        session.update(0, () => undefined); // 0 is not sent while sliding
        session.commit(0, createCommitApply(session, apply));
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[0]]);
    });

    it('should always send the committed value when disabled', () => {
        const session = new LiveUpdateSession<number>(false);
        const { apply } = createApply();

        session.commit(50, createCommitApply(session, apply));
        session.commit(50, createCommitApply(session, apply));

        expect(apply.mock.calls).toEqual([[50], [50]]);
        expect(session.lastSentValue).toBeNull();
    });

    it('should delay the first update again after stop', () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.stop();
        session.update(20, apply);
        expect(apply.mock.calls).toEqual([[10]]);

        jest.advanceTimersByTime(FirstDelay);
        expect(apply.mock.calls).toEqual([[10], [20]]);
    });

    it('should ignore the confirmation of an apply sent before stop', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.stop();
        session.update(20, apply);
        jest.advanceTimersByTime(FirstDelay);
        session.update(30, apply);
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[10], [20]]); // 30 still waits for the confirmation of 20

        calls[1].resolve();
        await jest.advanceTimersByTimeAsync(0);
        expect(apply.mock.calls).toEqual([[10], [20], [30]]);
    });
});
