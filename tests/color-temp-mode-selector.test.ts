import { HueColorTempModeSelector } from '../src/controls/color-temp-mode-selector';
import { HueColorTempPicker } from '../src/controls/color-temp-picker';

describe('HueColorTempModeSelector', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    const createSelector = async (picker: HueColorTempPicker) => {
        const selector = new HueColorTempModeSelector();
        // render nothing - the wheels template (cache directive) can't be rendered under the jest transform
        selector.showColor = false;
        selector.showTemp = false;
        selector.colorPicker = picker;
        document.body.appendChild(selector);
        await selector.updateComplete;
        return selector;
    };

    it('should follow the mode of the color picker', async () => {
        const picker = new HueColorTempPicker();
        const selector = await createSelector(picker);

        picker.mode = 'temp';
        picker.dispatchEvent(new Event('mode-change'));

        expect(selector.mode).toBe('temp');
    });

    it('should stop listening to the previous color picker', async () => {
        const oldPicker = new HueColorTempPicker();
        const selector = await createSelector(oldPicker);
        const removeSpy = jest.spyOn(oldPicker, 'removeEventListener');

        selector.colorPicker = new HueColorTempPicker();
        await selector.updateComplete;

        expect(removeSpy).toHaveBeenCalledWith('mode-change', expect.any(Function));

        oldPicker.mode = 'temp';
        oldPicker.dispatchEvent(new Event('mode-change'));
        expect(selector.mode).toBe('color');
    });

    it('should stop listening to the color picker when disconnected', async () => {
        const picker = new HueColorTempPicker();
        const selector = await createSelector(picker);

        selector.remove();

        picker.mode = 'temp';
        picker.dispatchEvent(new Event('mode-change'));
        expect(selector.mode).toBe('color');
    });
});
