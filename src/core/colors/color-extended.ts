import { Color } from './color';

export class ColorExtended extends Color {
    private _isThemeColor:boolean;

    private static readonly themeColor = 'theme-color';

    public constructor(colorName: string) {
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

        return new Color(this.getRed(), this.getGreen(), this.getBlue(), this.getOpacity());
    }

    public isThemeColor(): boolean {
        return this._isThemeColor;
    }

    public override getLuminance(): number {
        if (this._isThemeColor)
            throw new Error('Cannot getLuminance on ' + ColorExtended.themeColor);

        return super.getLuminance();
    }

    public override getForeground<T>(light: T, dark: T, offset: number): T {
        if (this._isThemeColor)
            throw new Error('Cannot getForeground on ' + ColorExtended.themeColor);

        return super.getForeground(light, dark, offset);
    }

    public override toString(): string {
        if (this._isThemeColor)
            return 'var(--' + ColorExtended.themeColor + ')';

        return super.toString();
    }
}