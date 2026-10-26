import { BackgroundFade } from '../src/core/background-fade';
import { Background } from '../src/core/colors/background';
import { Color } from '../src/core/colors/color';
import { ViewUtils } from '../src/core/view-utils';
import { Consts } from '../src/types/consts';
import { ILightContainer } from '../src/types/types-interface';

const red = new Background([new Color('#f00')]);
const blue = new Background([new Color('#00f')]);
const gradient = new Background([new Color('#f00'), new Color('#00f')]);

function createElement() {
    const element = document.createElement('div');
    const animate = jest.fn();
    element.animate = animate;
    return { element, animate };
}

describe('Background.isGradient', () => {
    it('should be a gradient only with more colors', () => {
        expect(red.isGradient).toBe(false);
        expect(gradient.isGradient).toBe(true);
    });
});

describe('BackgroundFade', () => {
    it('should fade out the previous background when a gradient takes part in the change', () => {
        const host = document.createElement('div');
        const { element, animate } = createElement();
        const fade = new BackgroundFade(host);

        fade.update(element, red, red.toString());
        fade.update(element, gradient, gradient.toString());

        expect(animate).toHaveBeenCalledTimes(1);
        expect(animate.mock.calls[0][1]).toMatchObject({ duration: Consts.TransitionDuration, pseudoElement: '::before' });
        expect(host.style.getPropertyValue('--hue-previous-background')).toBe(red.toString());

        fade.update(element, red, red.toString());
        expect(animate).toHaveBeenCalledTimes(2);
        expect(host.style.getPropertyValue('--hue-previous-background')).toBe(gradient.toString());
    });

    it('should not fade plain colors, the same background or the first one', () => {
        const { element, animate } = createElement();
        const fade = new BackgroundFade(document.createElement('div'));

        fade.update(element, gradient, gradient.toString());
        fade.update(element, gradient, gradient.toString());
        fade.update(element, red, red.toString());
        animate.mockClear();
        fade.update(element, blue, blue.toString());
        fade.update(element, null, Consts.ThemeCardBackgroundVar);

        expect(animate).not.toHaveBeenCalled();
    });

    it('should not fade after reset or without the element', () => {
        const { element, animate } = createElement();
        const fade = new BackgroundFade(document.createElement('div'));

        fade.update(element, red, red.toString());
        fade.reset();
        fade.update(element, gradient, gradient.toString());
        fade.update(null, red, red.toString());

        expect(animate).not.toHaveBeenCalled();
    });
});

describe('ViewUtils.setControlColor', () => {
    it('should set the control color only while the lights are on', () => {
        const element = document.createElement('div');
        let on = true;
        const ctrl = { isOn: () => on } as ILightContainer;

        ViewUtils.setControlColor(element, ctrl);
        expect(element.style.getPropertyValue(Consts.ControlColorVar)).toBe(Consts.ControlOnColor);

        on = false;
        ViewUtils.setControlColor(element, ctrl);
        expect(element.style.getPropertyValue(Consts.ControlColorVar)).toBe('');
    });
});
