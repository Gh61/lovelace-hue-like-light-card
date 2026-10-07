import { HueDialog } from '../src/controls/dialog';
import { ILightContainer } from '../src/types/types-interface';
import './mockup-ha-elements';

/**
 * `closeDialog` is the only logic of the Hue dialog that is not covered by the browser test's rendering:
 * HA calls it with the history entry the user navigated to (or without one when it asks to close).
 */
describe('HueDialog.closeDialog', () => {
    const createDialog = (open: boolean, detailOpen: boolean) => {
        const dialog = new HueDialog();
        const unregister = jest.fn();
         
        dialog['_open'] = open;
         
        dialog['_ctrl'] = { unregisterOnPropertyChanged: unregister } as never;
        if (detailOpen) {
             
            dialog['_selectedLights'].push({} as ILightContainer);
        }
        return { dialog, unregister };
    };
    const isDetailOpen = (dialog: HueDialog) => dialog['_selectedLights'].length > 0;

    let back: jest.SpyInstance;
    beforeEach(() => {
        back = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);
        window.history.replaceState(null, '');
    });
    afterEach(() => back.mockRestore());

    it('should hide only the light detail when navigated back to the root level', () => {
        const { dialog } = createDialog(true, true);
        window.history.replaceState({ dialogData: { lightDetail: true } }, '');

        expect(dialog.closeDialog({ dialogData: {} })).toBe(false);

        expect(isDetailOpen(dialog)).toBe(false);
        expect(dialog['_open']).toBe(true);
        expect(back).not.toHaveBeenCalled();
    });

    it('should hide only the light detail when HA asks to close at the root entry (stacked dialog marker)', () => {
        const { dialog } = createDialog(true, true);
        window.history.replaceState({ dialogData: {}, opensDialog: true }, '');

        expect(dialog.closeDialog()).toBe(false);

        expect(isDetailOpen(dialog)).toBe(false);
        expect(dialog['_open']).toBe(true);
        expect(back).not.toHaveBeenCalled();
    });

    it('should stay open when navigated back from a stacked dialog', () => {
        const { dialog } = createDialog(true, false);

        expect(dialog.closeDialog({ dialogData: {} })).toBe(false);

        expect(dialog['_open']).toBe(true);
        expect(back).not.toHaveBeenCalled();
    });

    it('should hide and unwind the history when closed with inner entries', () => {
        const { dialog, unregister } = createDialog(true, true);
        window.history.replaceState({ dialogData: { lightDetail: true } }, '');

        expect(dialog.closeDialog()).toBe(false);

        expect(dialog['_open']).toBe(false);
        expect(back).toHaveBeenCalledTimes(1);
        expect(unregister).not.toHaveBeenCalled();
    });

    it('should keep unwinding while closing is in progress', () => {
        const { dialog } = createDialog(false, false);

        expect(dialog.closeDialog({ dialogData: {} })).toBe(false);

        expect(back).toHaveBeenCalledTimes(1);
    });

    it('should close for good at the HA dialog entry', () => {
        const { dialog, unregister } = createDialog(true, false);
        const closed: CustomEvent[] = [];
        dialog.addEventListener('dialog-closed', (ev) => closed.push(ev as CustomEvent), { once: true });

        expect(dialog.closeDialog()).toBe(true);

        expect(dialog['_open']).toBe(false);
        expect(unregister).toHaveBeenCalledTimes(1);
        expect(closed).toHaveLength(1);
        expect(closed[0].detail.dialog).toBe(HueDialog.ElementName);
        expect(back).not.toHaveBeenCalled();
    });
});
