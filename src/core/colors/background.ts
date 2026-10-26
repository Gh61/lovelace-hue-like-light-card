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
        // sort the colors based on hue (starting from around 195 - light blue)
        // the Official app is olso showing only 5 colors, so every color gets wide enough stripe in card
        // I think it's like cheating, so we don't do this (at least not now)
        const getSortValue = (c: Color) => {
            let result = c.getHue() - 195; // this hue value should be first
            if (result < 0) {
                result += 360;
            }
            return result;
        };
        this._colors.sort((a, b) => getSortValue(a) - getSortValue(b));
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

    /** Whether the background is a gradient of more colors (CSS can't transition it). */
    public get isGradient(): boolean {
        return this._colors.length > 1;
    }

    /** Number of the colors of the background. */
    public get colorCount(): number {
        return this._colors.length;
    }

    /**
     * @returns Background between this one and the other one, each color mixed with the color on the same position
     * (the order of the colors is kept, so the gradient doesn't reorder while it changes).
     * @param ratio 0 = this background, 1 = the other one.
     * @throws When the backgrounds have a different number of colors.
     */
    public mix(other: Background, ratio: number): Background {
        // eslint-disable-next-line no-underscore-dangle
        const otherColors = other._colors;
        if (otherColors.length !== this._colors.length)
            throw new Error(`Cannot mix backgrounds with ${this._colors.length} and ${otherColors.length} colors.`);

        const mixValue = (from: number, to: number) => from + (to - from) * ratio;
        const mixed = this._colors.map((from, i) => {
            const to = otherColors[i];
            return new Color(
                Math.round(mixValue(from.getRed(), to.getRed())),
                Math.round(mixValue(from.getGreen(), to.getGreen())),
                Math.round(mixValue(from.getBlue(), to.getBlue())),
                mixValue(from.getOpacity(), to.getOpacity())
            );
        });

        // the constructor would sort the mixed colors
        const result = new Background([this._colors[0]]);
        // eslint-disable-next-line no-underscore-dangle
        result._colors = mixed;
        return result;
    }

    public toString(): string {
        if (this._colors.length === 1)
            return this._colors[0].toString();

        const step = 100.0 / (this._colors.length - 1);

        const offset = Consts.GradientOffset;
        let colors = `${this._colors[0]} 0%, ${this._colors[0]} ${offset}%`; // first 10% must be the first light
        let currentStep = 0;
        for (let i = 1; i < this._colors.length; i++) {
            currentStep += step;

            // last 10% must be the last light
            if (i + 1 === this._colors.length) {
                colors += `, ${this._colors[i]} ${100 - offset}%`;
            }
            colors += `, ${this._colors[i]} ${Math.round(currentStep)}%`;
        }

        return `linear-gradient(100deg, ${colors})`;
    }
}