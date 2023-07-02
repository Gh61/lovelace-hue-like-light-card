import { ViewUtils } from './view-utils';

export class IconHelper {
    private static readonly DefaultOneIcon = 'mdi:lightbulb';
    private static readonly DefaultTwoIcon = 'mdi:lightbulb-multiple';
    private static readonly DefaultMoreIcon = 'mdi:lightbulb-group';
    private static readonly HueOneIcon = 'hue:bulb-classic';
    private static readonly HueTwoIcon = 'hue:bulb-group-classic';
    private static readonly HueThreeIcon = 'hue:bulb-group-classic-3';
    private static readonly HueMoreIcon = 'hue:bulb-group-classic-4';

    /** @returns automatic icon that should be used for given count of lights. */
    public static getIcon(lightCount: number) {
        const hasHueIcons = ViewUtils.hasHueIcons();
        let lightIcon: string;

        if (lightCount <= 1) {
            lightIcon = hasHueIcons ? this.HueOneIcon : this.DefaultOneIcon;
        } else if (lightCount <= 2) {
            lightIcon = hasHueIcons ? this.HueTwoIcon : this.DefaultTwoIcon;
        } else if (lightCount <= 3) {
            lightIcon = hasHueIcons ? this.HueThreeIcon : this.DefaultMoreIcon;
        } else {
            lightIcon = hasHueIcons ? this.HueMoreIcon : this.DefaultMoreIcon;
        }

        return lightIcon;
    }
}