import { LiveUpdateSession } from '../src/core/live-update-session';
import { Consts } from '../src/types/consts';
import { noop } from '../src/types/functions';

/** Apply mock returning a promise that is resolved/rejected by the test (one per call). */
function createApply() {
    const calls: { resolve: () => void, reject: () => void }[] = [];
    const apply = jest.fn<Promise<void>, [number]>(() => new Promise<void>((resolve, reject) => calls.push({ resolve, reject })));
    return { apply, calls };
}

describe('LiveUpdateSession', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should apply the first update immediately', () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply } = createApply();

        session.update(10, apply);

        expect(apply).toHaveBeenCalledTimes(1);
        expect(apply).toHaveBeenCalledWith(10);
    });

    it('should wait for the confirmation and then apply only the latest value', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
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
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(50);
        session.update(20, apply);

        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval - 51);
        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(1);
        expect(apply.mock.calls).toEqual([[10], [20]]);
    });

    it('should continue after a failed apply', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
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
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(50);
        session.commit(50, apply);

        expect(apply).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval - 50);
        expect(apply.mock.calls).toEqual([[10], [50]]);
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
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateHoldTime);

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

        expect(session.lastSentValue).toBeNull();
    });

    /** Final apply like the real ones - skips the value already sent by live update. */
    function createCommitApply(session: LiveUpdateSession<number>, apply: (v: number) => Promise<void>) {
        return (v: number) => v !== session.lastSentValue ? apply(v) : undefined;
    }

    it('should skip the final value already sent by live update (single click)', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(50, apply);
        session.commit(50, createCommitApply(session, apply));
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[50]]);
    });

    it('should send the final value that replaced a pending update', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
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

    it('should apply immediately after stop', () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply } = createApply();

        session.update(10, apply);
        session.stop();
        session.update(20, apply);

        expect(apply.mock.calls).toEqual([[10], [20]]);
    });

    it('should ignore the confirmation of an apply sent before stop', async () => {
        const session = new LiveUpdateSession<number>(true);
        const { apply, calls } = createApply();

        session.update(10, apply);
        session.stop();
        session.update(20, apply);
        session.update(30, apply);
        calls[0].resolve();
        await jest.advanceTimersByTimeAsync(Consts.LiveUpdateMinInterval);

        expect(apply.mock.calls).toEqual([[10], [20]]); // 30 still waits for the confirmation of 20

        calls[1].resolve();
        await jest.advanceTimersByTimeAsync(0);
        expect(apply.mock.calls).toEqual([[10], [20], [30]]);
    });
});
