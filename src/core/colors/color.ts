export class Color {
    protected _red: number;
    protected _green: number;
    protected _blue: number;
    protected _opacity = 1;

    public static readonly LuminanceBreakingPoint = 192; // hue breaking point is pretty high

    public constructor(colorOrRed: string | number, opacityOrGreen?: number, blue?: number, opacity = 1) {
        if (typeof colorOrRed == 'string') {
            this.parse(colorOrRed);
            this.setOpacity(opacityOrGreen ?? this._opacity);
        } else {
            this._red = colorOrRed;
            this._green = opacityOrGreen ?? 0;
            this._blue = blue ?? 0;
            this._opacity = opacity;
        }
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
                this._red = colorValues[0] * 16 + colorValues[0];
                this._green = colorValues[1] * 16 + colorValues[1];
                this._blue = colorValues[2] * 16 + colorValues[2];
                if (isHex4)
                    this.setOpacity((colorValues[3] * 16 + colorValues[3]) / 255);

            } else if (isHex6 || isHex8) {
                this._red = colorValues[0] * 16 + colorValues[1];
                this._green = colorValues[2] * 16 + colorValues[3];
                this._blue = colorValues[4] * 16 + colorValues[5];
                if (isHex8)
                    this.setOpacity((colorValues[6] * 16 + colorValues[7]) / 255);
            }

        } else if (colorId.startsWith('rgb')) {
            const parts = colorId.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,?\s*(\d*(?:\.\d+\s*)?)\)$/);
            if (!parts) {
                throw new Error('Unrecognized color format rgb[a](...): ' + colorId);
            } else {
                // [ str, r, g, b, a|undefined ]
                this._red = parseInt(parts[1]);
                this._green = parseInt(parts[2]);
                this._blue = parseInt(parts[3]);
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
}