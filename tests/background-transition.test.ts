import { BackgroundTransition } from '../src/core/background-transition';
import { Background } from '../src/core/colors/background';
import { Color } from '../src/core/colors/color';
import { ViewUtils } from '../src/core/view-utils';
import { Consts } from '../src/types/consts';
import { ILightContainer } from '../src/types/types-interface';

const Variable = '--hue-background';
const red = new Background([new Color('#f00')]);
const blue = new Background([new Color('#00f')]);
const redBlue = new Background([new Color('#f00'), new Color('#00f')]);
const greenBlue = new Background([new Color('#0f0'), new Color('#00f')]);
const threeColors = new Background([new Color('#f00'), new Color('#0f0'), new Color('#00f')]);

/** Animation frames run by the test (`frame(ms)` moves the time and runs the waiting callbacks). */
class Frames {
    private _now = 0;
    private _callbacks = new Map<number, FrameRequestCallback>();
    private _nextId = 1;

    public constructor() {
        jest.spyOn(performance, 'now').mockImplementation(() => this._now);
        window.requestAnimationFrame = (callback) => {
            const id = this._nextId++;
            this._callbacks.set(id, callback);
            return id;
        };
        window.cancelAnimationFrame = (id) => {
            this._callbacks.delete(id);
        };
    }

    public frame(ms: number): void {
        this._now += ms;
        const callbacks = [...this._callbacks.values()];
        this._callbacks.clear();
        callbacks.forEach(c => c(this._now));
    }
}

function setup() {
    const host = document.createElement('div');
    const element = document.createElement('div');
    const animation = { playState: 'running' };
    const animate = jest.fn(() => animation);
    element.animate = animate as unknown as typeof element.animate;
    const transition = new BackgroundTransition(host, Variable);
    // the element overrides the host variable during the color transition
    const shown = () => element.style.getPropertyValue(Variable) || host.style.getPropertyValue(Variable);
    return { host, element, animate, animation, transition, shown };
}

afterEach(() => jest.restoreAllMocks());

describe('Background', () => {
    it('should be a gradient only with more colors', () => {
        expect(red.isGradient).toBe(false);
        expect(redBlue.isGradient).toBe(true);
        expect(threeColors.colorCount).toBe(3);
    });

    it('should mix the colors on the same positions', () => {
        expect(redBlue.mix(greenBlue, 0).toString()).toBe(redBlue.toString());
        expect(redBlue.mix(greenBlue, 1).toString()).toBe(greenBlue.toString());
        expect(redBlue.mix(greenBlue, 0.5).toString()).toContain('rgb(128,128,0)');
    });

    it('should not mix backgrounds with a different number of colors', () => {
        expect(() => redBlue.mix(threeColors, 0.5)).toThrow('Cannot mix backgrounds with 2 and 3 colors.');
    });
});

describe('BackgroundTransition', () => {
    it('should apply the first background at once', () => {
        const { element, animate, transition, shown } = setup();

        transition.update(element, redBlue, redBlue.toString());

        expect(shown()).toBe(redBlue.toString());
        expect(animate).not.toHaveBeenCalled();
    });

    it('should move the gradient colors frame by frame to the new ones', () => {
        const frames = new Frames();
        const { element, animate, transition, shown } = setup();
        transition.update(element, redBlue, redBlue.toString());

        transition.update(element, greenBlue, greenBlue.toString());
        expect(shown()).toBe(redBlue.toString()); // not yet

        frames.frame(Consts.TransitionDuration / 2);
        expect(shown()).not.toBe(redBlue.toString());
        expect(shown()).not.toBe(greenBlue.toString());

        frames.frame(Consts.TransitionDuration);
        expect(shown()).toBe(greenBlue.toString());
        expect(animate).not.toHaveBeenCalled();
    });

    it('should change the variable of the host only once per update, the frames only on the element', () => {
        const frames = new Frames();
        const { host, element, transition } = setup();
        transition.update(element, redBlue, redBlue.toString());

        transition.update(element, greenBlue, greenBlue.toString());
        expect(host.style.getPropertyValue(Variable)).toBe(greenBlue.toString());
        frames.frame(Consts.TransitionDuration / 2);
        expect(host.style.getPropertyValue(Variable)).toBe(greenBlue.toString());
        expect(element.style.getPropertyValue(Variable)).not.toBe('');

        frames.frame(Consts.TransitionDuration);
        expect(element.style.getPropertyValue(Variable)).toBe('');
    });

    it('should not mix out of the range when the frame time is older than the start', () => {
        const frames = new Frames();
        const { element, transition, shown } = setup();
        transition.update(element, redBlue, redBlue.toString());
        transition.update(element, greenBlue, greenBlue.toString());

        expect(() => frames.frame(-10)).not.toThrow();
        expect(shown()).toBe(redBlue.toString());
    });

    it('should continue from the colors shown right now when a new gradient comes during the change', () => {
        const frames = new Frames();
        const { element, transition, shown } = setup();
        transition.update(element, redBlue, redBlue.toString());
        transition.update(element, greenBlue, greenBlue.toString());
        frames.frame(Consts.TransitionDuration / 2);
        const middle = shown();

        transition.update(element, redBlue, redBlue.toString());
        frames.frame(1);

        // no jump back to the start or the end of the previous change
        expect(shown()).not.toBe(greenBlue.toString());
        expect(shown()).not.toBe(redBlue.toString());
        expect(middle).not.toBe(redBlue.toString());

        frames.frame(Consts.TransitionDuration);
        expect(shown()).toBe(redBlue.toString());
    });

    it('should fade out the previous background when the gradient changes its shape', () => {
        const { host, element, animate, animation, transition, shown } = setup();
        transition.update(element, red, red.toString());

        transition.update(element, redBlue, redBlue.toString());
        expect(shown()).toBe(redBlue.toString());
        expect(animate).toHaveBeenCalledTimes(1);
        expect((animate.mock.calls[0] as unknown[])[1]).toMatchObject({ duration: Consts.TransitionDuration, pseudoElement: '::before' });
        expect(host.style.getPropertyValue('--hue-previous-background')).toBe(red.toString());

        // a running fade is not restarted (the previous background would flash)
        transition.update(element, threeColors, threeColors.toString());
        expect(animate).toHaveBeenCalledTimes(1);

        animation.playState = 'finished';
        transition.update(element, null, Consts.ThemeCardBackgroundVar);
        expect(animate).toHaveBeenCalledTimes(2);
        expect(shown()).toBe(Consts.ThemeCardBackgroundVar);
    });

    it('should leave plain colors to the CSS transition', () => {
        const { element, animate, transition, shown } = setup();
        transition.update(element, red, red.toString());

        transition.update(element, blue, blue.toString());

        expect(shown()).toBe(blue.toString());
        expect(animate).not.toHaveBeenCalled();
    });

    it('should apply at once after reset or without the element', () => {
        new Frames();
        const { element, animate, transition, shown } = setup();
        transition.update(element, red, red.toString());
        transition.reset();
        transition.update(element, redBlue, redBlue.toString());
        transition.update(null, greenBlue, greenBlue.toString());

        expect(shown()).toBe(greenBlue.toString());
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
