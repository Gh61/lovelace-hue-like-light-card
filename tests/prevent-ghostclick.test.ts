import { PreventGhostClick } from '../src/types/prevent-ghostclick';

describe('PreventGhostClick', () => {
    it('should remove the touch listeners on destroy', () => {
        const el = new EventTarget();
        const addSpy = jest.spyOn(el, 'addEventListener');
        const removeSpy = jest.spyOn(el, 'removeEventListener');

        const gc = new PreventGhostClick(el);
        gc.destroy();

        expect(addSpy.mock.calls.length).toBeLessThanOrEqual(2);
        expect(removeSpy).toHaveBeenCalledTimes(2);
        expect(removeSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), true);
        expect(removeSpy).toHaveBeenCalledWith('touchend', expect.any(Function), true);

        // every added listener is removed with the same arguments
        for (const call of addSpy.mock.calls) {
            expect(removeSpy).toHaveBeenCalledWith(...call);
        }
    });

    it('should not add any listener on destroy', () => {
        const el = new EventTarget();
        const gc = new PreventGhostClick(el);
        const addSpy = jest.spyOn(el, 'addEventListener');

        gc.destroy();

        expect(addSpy).not.toHaveBeenCalled();
    });
});
