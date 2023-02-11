import { HueDialog } from '../controls/dialog';
import { Consts } from './consts';

/**
 * Contains methods with styles, that allow changing theme of single element.
 */
export class ThemeHelper {
    public static getSwitchThemeStyle() {
        const styles = {
            '--switch-checked-button-color': 'var(--primary-color)',
            '--switch-checked-track-color': 'var(--dark-primary-color)'
        };
        return styles;
    }

    public static setDialogThemeStyles(dialog: HueDialog, hueBgColorVariable: string) {
        // To help change themes on the fly
        dialog.style.setProperty(
            '--mdc-theme-surface',
            `var(${hueBgColorVariable}, ${Consts.ThemeCardBackgroundVar})`
        );
    }
}