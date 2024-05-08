import { Color } from '../core/colors/color';
import { KnownIconSize } from './types-config';

export class Consts {
    public static readonly Version = 'v1.6.1';
    public static readonly Dev = true;
    public static readonly ElementPostfix = Consts.Dev ? '-test' : '';
    public static readonly CardElementName = 'hue-like-light-card' + Consts.ElementPostfix;
    public static readonly ApiProviderName = Consts.Dev ? 'hue_card_test' : 'hue_card';

    public static readonly CardName = 'Hue-Like Light Card' + (Consts.Dev ? ' [TEST]' : '');
    public static readonly CardDescription = 'Hue-like way to control your lights' + (Consts.Dev ? ' [TEST]' : '');

    public static readonly HueBorderRadius = 10;
    public static readonly HueShadow = '0px 2px 3px rgba(0,0,0,0.4)';
    public static readonly LightColor = new Color('#fff');
    public static readonly LightOffColor = new Color('#fff', 0.85);
    public static readonly DarkColor = new Color(0, 0, 0, 0.7);
    public static readonly DarkOffColor = new Color(0, 0, 0, 0.5);
    public static readonly WarmColor = '#ffda95';
    public static readonly ColdColor = '#f5f5ff';
    public static readonly DefaultColor = 'warm';
    public static readonly OffColor = '#666';
    public static readonly TileOffColor = 'rgba(102, 102, 102, 0.6)';
    public static readonly DialogBgColor = '#171717';
    public static readonly DialogFgLightColor = new Color('#aaa');
    public static readonly DialogOffColor = '#363636';
    public static readonly GradientOffset = 7; // percent
    public static readonly TransitionDefault = 'all 0.3s ease-out 0s';

    // Theme colors
    public static readonly ThemeDefault = 'default';
    public static readonly ThemeCardBackground = '--hue-detected-card-bg';
    public static readonly ThemeCardBackgroundVar = `var(${Consts.ThemeCardBackground})`;
    public static readonly ThemeCardPossibleBackgrounds = [
        '--ha-card-background',
        '--card-background-color',
        '--paper-card-background-color',
        '--primary-background-color'
    ];
    public static readonly ThemeDialogHeadingColorVar = 'var(--mdc-dialog-heading-ink-color)';
    public static readonly ThemeSecondaryTextColorVar = 'var(--secondary-text-color)';

    // Icon size
    public static readonly IconSize:Record<KnownIconSize, number> = {
        'big': 2.0,
        'original': 1.41666667,
        'small': 1.0
    };
}