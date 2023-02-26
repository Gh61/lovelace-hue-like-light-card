import { applyThemesOnElement, Themes } from 'custom-card-helpers';
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

    public static setDialogThemeStyles(dialog: HueDialog, hueBgColorVariable: string, detectThemeBg: boolean) {
        if (detectThemeBg) {
            // Detect theme color if needed
            ThemeHelper.detectThemeCardBackground(dialog, true, 1); // offset: 1 for dialog
        }

        // To help change themes on the fly
        dialog.style.setProperty(
            '--mdc-theme-surface',
            `var(${hueBgColorVariable}, ${Consts.ThemeCardBackgroundVar})`
        );
    }

    /** 
     * Will try to apply theme on given element. 
     * @returns If the theme was applied (only when the theme changes).
     */
    public static applyTheme(element: HTMLElement, themes: Themes, theme: string): boolean {
        if (element.dataset.themeLocal == theme)
            return false;

        applyThemesOnElement(element, themes, theme);
        if (theme != Consts.ThemeDefault) {
            element.dataset.themeLocal = theme;
        } else {
            delete element.dataset.themeLocal;
        }

        return true;
    }

    /**
     * Will detect card background from theme on this element.
     */
    public static detectThemeCardBackground(element: HTMLElement, force = false, offset = 0) {
        if (element.dataset.hueBgDetected && !force)
            return;

        // if element has applied custom theme - check theme locally
        const detectLocally = !!element.dataset.themeLocal;

        let possibleBg;
        for (possibleBg of Consts.ThemeCardPossibleBackgrounds) {
            if (offset > 0) {
                offset--;
                continue;
            }

            // for local theme - check properties on elements style attribute
            if (detectLocally) {

                // iterate all number indexes from zero, till variable found or undefined is returned
                let exists = false;
                let index = 0;
                while (element.style[index]) {
                    const s = element.style[index];
                    if (s == possibleBg) {
                        exists = true;
                        break;
                    }

                    index++;
                }

                // if variable found - set as theme background
                if (exists) {
                    element.style.setProperty(
                        Consts.ThemeCardBackground,
                        `var(${possibleBg})`
                    );
                    break;
                }
            } else {
                element.style.setProperty(
                    Consts.ThemeCardBackground,
                    `var(${possibleBg})`
                );

                const cptStyle = getComputedStyle(element);
                const actBg = cptStyle.getPropertyValue(Consts.ThemeCardBackground);

                if (actBg)
                    break;
            }
        }

        element.dataset.hueBgDetected = possibleBg || 'none';
        element.dataset.hueBgDetectedLocally = detectLocally.toString();
    }
}