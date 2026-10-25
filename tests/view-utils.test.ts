import { ViewUtils } from '../src/core/view-utils';

describe('ViewUtils.getHueVar', () => {
    it('should prefer the public variable over the calculated one', () => {
        expect(ViewUtils.getHueVar('background')).toBe('var(--hue-background, var(--hue-calculated-background))');
        expect(ViewUtils.getHueVar('light-background', 'red')).toBe('var(--hue-light-background, var(--hue-calculated-light-background, red))');
    });
});

describe('ViewUtils.getSliderColorStyles', () => {
    it('should color the slider with the given foreground, overridable by --hue-slider-color', () => {
        const styles = ViewUtils.getSliderColorStyles('var(--fg)');

        expect(styles).toContain('--ha-slider-indicator-color: var(--hue-slider-color, var(--fg));');
        expect(styles).toContain('--ha-slider-thumb-color: var(--hue-slider-color, var(--fg));');
        expect(styles).toContain('--ha-slider-track-color: color-mix(in srgb, var(--hue-slider-color, var(--fg)) 35%, transparent);');
    });
});

describe('ViewUtils.getSwitchColorStyles', () => {
    it('should color the checked switch with the given foreground, overridable by --hue-switch-color', () => {
        const styles = ViewUtils.getSwitchColorStyles('var(--fg)');

        expect(styles).toContain('--ha-switch-checked-thumb-background-color: var(--hue-switch-color, var(--fg));');
        expect(styles).toContain('--ha-switch-checked-background-color: color-mix(in srgb, var(--hue-switch-color, var(--fg)) 35%, transparent);');
    });
});
