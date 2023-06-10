export type ColorMode = 'rgb' | 'hsv';

export class Color {
    private readonly _originalMode: ColorMode;
    private _red: number;
    private _green: number;
    private _blue: number;
    private _hsv: number[] | null;
    private _opacity = 1;

    public static readonly LuminanceBreakingPoint = 192; // hue breaking point is pretty high

    public constructor(colorOrRedOrHue: string | number, opacityOrGreenOrSaturation?: number, blueOrValue?: number, opacity = 1, mode: ColorMode = 'rgb') {
        if (typeof colorOrRedOrHue == 'string') {
            this.parse(colorOrRedOrHue);
            this.setOpacity(opacityOrGreenOrSaturation ?? this._opacity);
        } else if (mode == 'rgb') {
            this.setRgb(
                colorOrRedOrHue,
                opacityOrGreenOrSaturation ?? 0,
                blueOrValue ?? 0
            );
            this.setOpacity(opacity);
        } else if (mode == 'hsv') {
            this.setHsv(
                colorOrRedOrHue,
                opacityOrGreenOrSaturation ?? 0,
                blueOrValue ?? 0
            );
        }
        this._originalMode = mode;
    }

    /** Will validate and set new values to R, G, B */
    protected setRgb(r: number, g: number, b: number) {
        if (r < 0 || r > 255)
            throw new Error('Red value must be in range [0, 255].');
        if (g < 0 || g > 255)
            throw new Error('Green value must be in range [0, 255].');
        if (b < 0 || b > 255)
            throw new Error('Blue value must be in range [0, 255].');

        this._red = r;
        this._green = g;
        this._blue = b;
    }

    protected setHsv(h: number, s: number, v: number) {
        if (h < 0 || h > 360)
            throw new Error('Hue value must be in range [0, 360].');
        if (s < 0 || s > 1)
            throw new Error('Saturation value must be in range [0, 1].');
        if (v < 0 || v > 1)
            throw new Error('HSV Value must be in range [0, 1].');

        this._hsv = [h, s, v];

        // set also rgb
        const [r, g, b] = Color.hsv2rgb(h, s, v);
        this.setRgb(r, g, b);
    }

    /** Will validate and set new value to opacity. */
    protected setOpacity(value: number) {
        if (value < 0)
            throw new Error('Minimal value for opacity is 0.');
        if (value > 1)
            throw new Error('Maximal value for opacity is 1.');

        // Round to 2 decimal places
        this._opacity = Math.round(value * 100) / 100;
    }

    /**
     * @returns red color component of this color (value in range 0 - 255).
     */
    public getRed(): number {
        return this._red;
    }

    /**
     * @returns green color component of this color (value in range 0 - 255).
     */
    public getGreen(): number {
        return this._green;
    }

    /**
     * @returns blue color component of this color (value in range 0 - 255).
     */
    public getBlue(): number {
        return this._blue;
    }

    //#region HSV

    private ensureHSV(): number[] {
        if (!this._hsv) {
            this._hsv = Color.rgb2hsv(this.getRed(), this.getGreen(), this.getBlue());
        }
        return this._hsv;
    }

    /**
     * @returns Hue color component of this color (value in range 0 - 360),
     */
    public getHue(): number {
        return this.ensureHSV()[0];
    }

    /**
     * @returns Saturation color component of this color (value in range 0 - 1),
     */
    public getSaturation(): number {
        return this.ensureHSV()[1];
    }

    /**
     * @returns Value (from HSV) color component of this color (value in range 0 - 1),
     */
    public getValue(): number {
        return this.ensureHSV()[2];
    }

    //#endregion

    /**
     * @returns opacity of this color (value in range 0 - 1).
     */
    public getOpacity(): number {
        return this._opacity;
    }

    /**
     * @returns relative luminance (0-255).
     */
    public getLuminance(): number {
        return this._red * 0.299 + this._green * 0.587 + this._blue * 0.114;
    }

    /**
     * Returns foreground for this color, either @param light (potentially white) or @param dark (potentially black).
     * @param offset: offset added to luminance: higher value => sooner dark foreground (can be negative)
     */
    public getForeground<T>(light: T, dark: T, offset: number): T {
        const luminance = this.getLuminance();
        return (luminance + offset) < Color.LuminanceBreakingPoint ? light : dark;
    }

    /**
    * Parses the given color string. Only supports color name, rgb(a) and hex format.
    */
    private parse(colorId: string, allowNames = true): void {
        if (colorId.startsWith('#')) {
            colorId = colorId.substring(1);

            const isHex3 = colorId.length == 3;
            const isHex4 = colorId.length == 4;
            const isHex6 = colorId.length == 6;
            const isHex8 = colorId.length == 8;

            if (!isHex3 && !isHex6 && !isHex4 && !isHex8) {
                throw new Error('Hex color format should have 3/6 letters or 4/8 letters for transparency.');
            }

            // parse all chars to integers
            const colorValues = [];
            for (let i = 0; i < colorId.length; i++) {
                const value = parseInt(colorId[i], 16);
                if (isNaN(value))
                    throw new Error(`Hex color format contains non hex characters - '${colorId[i]}'.`);

                colorValues.push(value);
            }

            if (isHex3 || isHex4) {
                this.setRgb(
                    colorValues[0] * 16 + colorValues[0],
                    colorValues[1] * 16 + colorValues[1],
                    colorValues[2] * 16 + colorValues[2]
                );
                if (isHex4)
                    this.setOpacity((colorValues[3] * 16 + colorValues[3]) / 255);

            } else if (isHex6 || isHex8) {
                this.setRgb(
                    colorValues[0] * 16 + colorValues[1],
                    colorValues[2] * 16 + colorValues[3],
                    colorValues[4] * 16 + colorValues[5]
                );
                if (isHex8)
                    this.setOpacity((colorValues[6] * 16 + colorValues[7]) / 255);
            }

        } else if (colorId.startsWith('rgb')) {
            const parts = colorId.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,?\s*(\d*(?:\.\d+\s*)?)\)$/);
            if (!parts) {
                throw new Error('Unrecognized color format rgb[a](...): ' + colorId);
            } else {
                // [ str, r, g, b, a|undefined ]
                this.setRgb(
                    parseInt(parts[1]),
                    parseInt(parts[2]),
                    parseInt(parts[3])
                );
                if (parts[4]?.length > 0) {
                    this.setOpacity(parseFloat(parts[4]));
                }
            }
        } else {
            if (allowNames) {
                // small hack: https://stackoverflow.com/a/47355187/1341409
                const ctx = document.createElement('canvas').getContext('2d');
                if (ctx != null) {
                    ctx.fillStyle = colorId;
                    this.parse(ctx.fillStyle, false); // standardized color format (hex)
                    return;
                }
            }

            throw new Error('Unrecognized color format: ' + colorId);
        }
    }

    public toString(): string {
        if (this._opacity < 1) {
            return `rgba(${this._red},${this._green},${this._blue},${this._opacity})`;
        }

        return `rgb(${this._red},${this._green},${this._blue})`;
    }

    // #region Utils

    /**
     * @param hue in range [0, 360]
     * @param saturation in range [0,1]
     * @param value in range [0,1]
     * @returns [r,g,b] each in range [0,255]
     * See: https://en.wikipedia.org/wiki/HSL_and_HSV#From_HSV
     */
    public static hsv2rgb(hue: number, saturation: number, value: number) {
        const chroma = value * saturation;
        const hue1 = hue / 60;
        const x = chroma * (1 - Math.abs((hue1 % 2) - 1));
        let r1 = 0, g1 = 0, b1 = 0;
        if (hue1 >= 0 && hue1 <= 1) {
            ([r1, g1, b1] = [chroma, x, 0]);
        } else if (hue1 >= 1 && hue1 <= 2) {
            ([r1, g1, b1] = [x, chroma, 0]);
        } else if (hue1 >= 2 && hue1 <= 3) {
            ([r1, g1, b1] = [0, chroma, x]);
        } else if (hue1 >= 3 && hue1 <= 4) {
            ([r1, g1, b1] = [0, x, chroma]);
        } else if (hue1 >= 4 && hue1 <= 5) {
            ([r1, g1, b1] = [x, 0, chroma]);
        } else if (hue1 >= 5 && hue1 <= 6) {
            ([r1, g1, b1] = [chroma, 0, x]);
        }

        const m = value - chroma;
        const [r, g, b] = [r1 + m, g1 + m, b1 + m];

        // Change r,g,b values from [0,1] to [0,255]
        return [Math.round(255 * r), Math.round(255 * g), Math.round(255 * b)];
    }

    /**
     * @param r in range [0,255]
     * @param g in range [0,255]
     * @param b in range [0,255]
     * @returns [hue, saturation, value] where hue is in range [0,360], saturation and value are in range [0,1]
     * See: https://en.wikipedia.org/wiki/HSL_and_HSV#HSV_to_RGB
     */
    public static rgb2hsv(r: number, g: number, b: number) {
        const rabs = r / 255;
        const gabs = g / 255;
        const babs = b / 255;
        const v = Math.max(rabs, gabs, babs);
        const diff = v - Math.min(rabs, gabs, babs);
        const diffc = (c: number) => (v - c) / 6 / diff + 1 / 2;
        const percentRoundFn = (num: number) => Math.round(num * 100) / 100;

        let h = 0, s;
        if (diff == 0) {
            h = s = 0;
        } else {
            s = diff / v;
            const rr = diffc(rabs);
            const gg = diffc(gabs);
            const bb = diffc(babs);

            if (rabs === v) {
                h = bb - gg;
            } else if (gabs === v) {
                h = (1 / 3) + rr - bb;
            } else if (babs === v) {
                h = (2 / 3) + gg - rr;
            }
            if (h < 0) {
                h += 1;
            } else if (h > 1) {
                h -= 1;
            }
        }
        return [
            Math.round(h * 360),
            percentRoundFn(s),
            percentRoundFn(v)
        ];
    }

    // #endregion
}