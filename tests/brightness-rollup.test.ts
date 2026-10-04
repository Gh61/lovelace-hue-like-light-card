import { HueBrightnessRollup } from '../src/controls/brightness-rollup';

describe('HueBrightnessRollup', () => {
    it('should not dispatch immediate-value-change on external value set', () => {
        const rollup = new HueBrightnessRollup();
        const listener = jest.fn();
        rollup.addEventListener('immediate-value-change', listener);
        rollup.addEventListener('change', listener);

        rollup.value = 42;

        expect(rollup.value).toBe(42);
        expect(rollup.immediateValue).toBe(42);
        expect(listener).not.toHaveBeenCalled();
    });
});
