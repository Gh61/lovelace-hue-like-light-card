import { Consts } from '../../types/consts';
import { Color } from './color';
import { ColorExtended } from './color-extended';

export class Background {
    private _colors: Color[];

    public constructor(backgroundsOrColors: (Background | Color)[]) {
        if (!(backgroundsOrColors?.length > 0))
            throw new Error('At least one background or color is needed for new Background(...).');

        this._colors = backgroundsOrColors.flatMap(b => {
            if (b instanceof ColorExtended) {
                throw new Error('ColorExtended cannot be used in Background. Resolve it first.');
            } if (b instanceof Color) {
                return [b];
            }
            else if (b instanceof Background) {
                // eslint-disable-next-line no-underscore-dangle
                return b._colors;
            }
            else {
                throw new Error('Only array of Colors or Backgrounds is supported for new Background(...).');
            }
        });
        // sort the colors from the brightest
        this._colors.sort((a, b) => a.getLuminance() - b.getLuminance());
    }

    /**
     * Gets foreground for this background, either @param light (potentially white) or @param dark (potentially black).
     * @param offset: offset added to luminance (can move breaking point in either direction)
     */
    public getForeground<T>(light: T, dark: T, offset: number): T {
        if (this._colors.length < 3) {
            return this._colors[0].getForeground(light, dark, offset);
        }

        // wee need to choose color based on the brightness of the first half
        let forLight = 0;
        for (let i = 0; i < this._colors.length / 2; i++) {
            if (this._colors[i].getForeground(true, false, offset))
                forLight++;
        }

        // of more than half (of half of the colors) is for light, then return light
        return forLight > this._colors.length / 4 ? light : dark;
    }

    public toString(): string {
        if (this._colors.length == 1)
            return this._colors[0].toString();

        const step = 100.0 / (this._colors.length - 1);

        const offset = Consts.GradientOffset;
        let colors = `${this._colors[0]} 0%, ${this._colors[0]} ${offset}%`; // first 10% must be the first light
        let currentStep = 0;
        for (let i = 1; i < this._colors.length; i++) {
            currentStep += step;

            // last 10% must be the last light
            if (i + 1 == this._colors.length) {
                colors += `, ${this._colors[i]} ${100 - offset}%`;
            }
            colors += `, ${this._colors[i]} ${Math.round(currentStep)}%`;
        }

        return `linear-gradient(90deg, ${colors})`;
    }
}