import { HueColorTempPicker } from '../src/controls/color-temp-picker';

describe('HueTempPicker', () => {
    it('should match kelvin and position', () => {

        const picker = new HueColorTempPicker();
        picker.mode = 'temp';
        picker.tempMin = 2020;
        picker.tempMax = 6451;

        const x = 0;
        const radius = 950;
        const increment = 10;
        for (let y = -radius; y <= radius; y += increment) {
            const data = picker.getColorAndValue(x, y, radius);

            expect(data).not.toBeNull();
            expect(data).toHaveProperty('kelvin');

            if ('kelvin' in data!) {
                const coords = picker.getCoordinatesAndTemp(data.kelvin, radius);
                const diff = Math.abs(coords.position.Y - y);
                expect(diff).toBeLessThanOrEqual(1); // 1 px tolerance
                expect(coords.position.X).toBe(0);
            }
        }
    });

    it('should match color and position', () => {

        const picker = new HueColorTempPicker();
        picker.mode = 'color';

        const radius = 777;
        const increment = 7;
        const maxDiff = 0.005 * radius;
        for (let x = -radius; x <= radius; x += increment) {
            for (let y = -radius; y <= radius; y += increment) {
                const data = picker.getColorAndValue(x, y, radius);

                if (!data)
                    continue;

                expect(data).toHaveProperty('hsv');

                if ('hsv' in data) {
                    const [hue, saturation] = data.hsv;

                    const coords = picker.getCoordinatesAndColor(hue, saturation, radius);
                    const yDiff = Math.abs(coords.position.Y - y);
                    const xDiff = Math.abs(coords.position.X - x);

                    // the coordinates may not be the same, because we are cutting everthing over saturation 1 (previous possible value was 1.0003)
                    expect(yDiff).toBeLessThan(maxDiff);
                    expect(xDiff).toBeLessThan(maxDiff);
                }
            }
        }
    });
});