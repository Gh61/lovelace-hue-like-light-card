import { Color } from './color';

export class ColorExtended extends Color {
    private _isThemeColor:boolean;

    private static readonly themeColor = 'theme-color';

    constructor(colorName: string) {
        if (colorName == ColorExtended.themeColor) {
            super(0, 0, 0);
            this._isThemeColor = true;
        } else {
            super(colorName);
            this._isThemeColor = false;
        }
    }

    public getBaseColor(): Color {
        if (this._isThemeColor)
            throw new Error('Cannot getBaseColor on ' + ColorExtended.themeColor);

        return new Color(this._red, this._green, this._blue);
    }

    public isThemeColor(): boolean {
        return this._isThemeColor;
    }

    public getLuminance(): number {
        if (this._isThemeColor)
            throw new Error('Cannot getLuminance on ' + ColorExtended.themeColor);

        return super.getLuminance();
    }

    public getForeground<T>(light: T, dark: T, offset: number): T {
        if (this._isThemeColor)
            throw new Error('Cannot getLuminance on ' + ColorExtended.themeColor);

        return super.getForeground(light, dark, offset);
    }

    public toString(): string {
        if (this._isThemeColor)
            return 'var(--' + ColorExtended.themeColor + ')';

        return super.toString();
    }
}