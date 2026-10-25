import { ViewUtils } from '../src/core/view-utils';

describe('ViewUtils.getSliderColorStyles', () => {
    it('should color the slider with the given foreground, overridable by --hue-slider-color', () => {
        const styles = ViewUtils.getSliderColorStyles('--hue-text-color');

        expect(styles).toContain('--ha-slider-indicator-color: var(--hue-slider-color, var(--hue-text-color));');
        expect(styles).toContain('--ha-slider-thumb-color: var(--hue-slider-color, var(--hue-text-color));');
        expect(styles).toContain('--ha-slider-track-color: color-mix(in srgb, var(--hue-slider-color, var(--hue-text-color)) 35%, transparent);');
    });
});

describe('ViewUtils.getSwitchColorStyles', () => {
    it('should color the checked switch with the given foreground, overridable by --hue-switch-color', () => {
        const styles = ViewUtils.getSwitchColorStyles('--hue-light-text-color');

        expect(styles).toContain('--ha-switch-checked-thumb-background-color: var(--hue-switch-color, var(--hue-light-text-color));');
        expect(styles).toContain('--ha-switch-checked-background-color: color-mix(in srgb, var(--hue-switch-color, var(--hue-light-text-color)) 35%, transparent);');
    });
});
