export class Consts {
    public static readonly Dev = true;
    public static readonly CardElementName = Consts.Dev ? 'hue-like-light-card-test' : 'hue-like-light-card';

    public static readonly LuminanceBreakingPoint = 192; // hue breaking point is pretty high
    public static readonly LightColor = '#fff';
    public static readonly DarkColor = 'rgba(0,0,0,0.7)';
    public static readonly DarkOffColor = 'rgba(0,0,0,0.5)';
    public static readonly WarmColor = '#ffda95';
    public static readonly ColdColor = '#f5f5ff';
    public static readonly DefaultColor = 'warm';
    public static readonly OffColor = '#666';
    public static readonly GradientOffset = 10; // percent
    public static readonly DefaultOneIcon = 'mdi:lightbulb';
    public static readonly DefaultTwoIcon = 'mdi:lightbulb-multiple';
    public static readonly DefaultMoreIcon = 'mdi:lightbulb-group';
    public static readonly TimeCacheInterval = 1500; // ms
}