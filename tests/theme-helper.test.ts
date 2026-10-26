import { ThemeHelper } from '../src/types/theme-helper';
import { Themes } from '../src/ha/data/ws-themes';
import { Consts } from '../src/types/consts';

function createThemes(): Themes {
    return {
        default_theme: 'default',
        default_dark_theme: null,
        themes: {
            'my-theme': { 'primary-text-color': '#cdd6f4' }
        },
        darkMode: true,
        theme: 'my-theme'
    } as unknown as Themes;
}

describe('ThemeHelper.applyTheme', () => {
    it('should not set the HA built-in theme for the default theme', () => {
        const element = document.createElement('div');

        ThemeHelper.applyTheme(element, createThemes(), Consts.ThemeDefault);

        expect(element.style.getPropertyValue('--primary-background-color')).toBe('');
        expect(element.style.getPropertyValue('--primary-text-color')).toBe('');
    });

    it('should set the local theme and reset it back to the global one', () => {
        const element = document.createElement('div');
        const themes = createThemes();

        ThemeHelper.applyTheme(element, themes, 'my-theme');
        expect(element.style.getPropertyValue('--primary-text-color')).toBe('#cdd6f4');

        ThemeHelper.applyTheme(element, themes, Consts.ThemeDefault);
        expect(element.style.getPropertyValue('--primary-text-color')).toBe('');
    });
});
