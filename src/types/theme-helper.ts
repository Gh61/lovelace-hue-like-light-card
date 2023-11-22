import { applyThemesOnElement, Themes } from 'custom-card-helpers';
import { HueDialog } from '../controls/dialog';
import { Consts } from './consts';

/**
 * Contains methods with styles, that allow changing theme of single element.
 */
export class ThemeHelper {
    // #region Switch styles

    private static switchCheckedButtonColorVar = '--detected-switch-checked-button-color';
    private static switchCheckedTrackColorVar = '--detected-switch-checked-track-color';
    private static possibleSwitchCheckedButtonColors = [
        '--switch-checked-button-color',
        '--primary-color'
    ];
    private static possibleSwitchCheckedTrackColors = [
        '--switch-checked-track-color',
        '--switch-checked-color',
        '--dark-primary-color'
    ];

    /**
     * @returns style variables for switches. Needs to be called with @method detectSwitchColors.
     */
    public static getSwitchThemeStyle() {
        const styles = {
            '--switch-checked-button-color': `var(${ThemeHelper.switchCheckedButtonColorVar})`,
            '--switch-checked-track-color': `var(${ThemeHelper.switchCheckedTrackColorVar})`
        };
        return styles;
    }

    /**
     * Will detect and set switch color variables (for use with @method getSwitchThemeStyle)
     */
    public static detectSwitchColors(element: HTMLElement, force = false) {
        ThemeHelper.detectThemeVariable(element, ThemeHelper.switchCheckedButtonColorVar, ThemeHelper.possibleSwitchCheckedButtonColors, 'switchBtnDetected', force);
        ThemeHelper.detectThemeVariable(element, ThemeHelper.switchCheckedTrackColorVar, ThemeHelper.possibleSwitchCheckedTrackColors, 'switchTrckDetected', force);
    }

    // #endregion

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
        }
        else {
            delete element.dataset.themeLocal;
        }

        // Detect switch colors
        ThemeHelper.detectSwitchColors(element, true);

        return true;
    }

    /**
     * Will detect card background from theme on this element.
     */
    public static detectThemeCardBackground(element: HTMLElement, force = false, offset = 0): void {

        ThemeHelper.detectThemeVariable(
            element,
            Consts.ThemeCardBackground,
            Consts.ThemeCardPossibleBackgrounds,
            'hueBgDetected',
            force,
            offset);
    }

    /**
     * Will detect and set variable to the first possible value.
     * @param element Main card element which has possible local theme variables set in style.
     * @param targetVariable Name of the variable the will be set after the detection.
     * @param possibleVariables Names of possible variables ordered from most specific.
     * @param detectedIdentifier Name of data attribute, which will hold the detected variable name.
     * @param force If set will again detect the variable name even when the detectedIdentifier attribute is already set.
     * @param offset Offset for the possibleVariables parameter. When set to 1, first possible variable is skipped.
     */
    private static detectThemeVariable(element: HTMLElement, targetVariable: string, possibleVariables: string[],
        detectedIdentifier: string, force = false, offset = 0): void {
        if (element.dataset[detectedIdentifier] && !force)
            return;

        // if element has applied custom theme - check theme locally
        const detectLocally = !!element.dataset.themeLocal;

        let possibleVar;
        for (possibleVar of possibleVariables) {
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
                    if (s == possibleVar) {
                        exists = true;
                        break;
                    }

                    index++;
                }

                // if variable found - set as theme background
                if (exists) {
                    element.style.setProperty(
                        targetVariable,
                        `var(${possibleVar})`
                    );
                    break;
                }
            }
            else {
                element.style.setProperty(
                    targetVariable,
                    `var(${possibleVar})`
                );

                const cptStyle = getComputedStyle(element);
                const actValue = cptStyle.getPropertyValue(targetVariable);

                if (actValue)
                    break;
            }
        }

        let attrValue = (possibleVar || 'none');
        if (detectLocally) {
            attrValue += ';local';
        }

        element.dataset[detectedIdentifier] = attrValue;
    }
}