import { Background } from '../src/core/colors/background';
import { Color } from '../src/core/colors/color';

describe('Background', () => {
    it('should return the first color of the gradient', () => {
        const background = new Background([new Color('#ff0000'), new Color('#0000ff')]);

        expect(background.getFirstColor().toString()).toBe(background.toString().match(/rgb\([^)]*\)/)![0]);
    });
});
