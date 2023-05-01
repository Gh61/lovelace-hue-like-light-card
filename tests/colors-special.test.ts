import { Color } from '../src/core/colors/color';
import { ColorExtended } from '../src/core/colors/color-extended';
import { ColorResolver } from '../src/core/colors/color-resolvers';
import { Consts } from '../src/types/consts';

describe('Color Special', () => {
    it('should be theme-color', () => {
        const s = 'theme-color';
        const color = new ColorExtended(s);

        expect(color.isThemeColor()).toBe(true);
    });

    it('should be normal color', () => {
        const s = '#abc';
        const color = new ColorExtended(s);

        expect(color.getRed()).toBe(170);
        expect(color.getGreen()).toBe(187);
        expect(color.getBlue()).toBe(204);
        expect(color.getOpacity()).toBe(1);
    });

    it('should resolve as warm', () => {
        const s = 'warm';
        const color = ColorResolver.getColor(s);
        const warmColor = new Color(Consts.WarmColor);

        expect(color.toString()).toBe(warmColor.toString());
    });

    it('should resolve as cold', () => {
        const s = 'cold';
        const color = ColorResolver.getColor(s);
        const coldColor = new Color(Consts.ColdColor);

        expect(color.toString()).toBe(coldColor.toString());
    });

    it('should resolve normally', () => {
        const s = 'rgb(1,2,3)';
        const color = ColorResolver.getColor(s);

        expect(color.getRed()).toBe(1);
        expect(color.getGreen()).toBe(2);
        expect(color.getBlue()).toBe(3);
        expect(color.getOpacity()).toBe(1);
    });
});