import { HueColorTempPicker } from '../src/controls/color-temp-picker';

describe('HueTempPicker ', () => {
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
                expect(coords.position.Y).toBe(y);
                expect(coords.position.X).toBe(0);
            }
        }
    });

    it('should match color and position', () => {

        const picker = new HueColorTempPicker();
        picker.mode = 'color';

        const radius = 777;
        const increment = 7;
        for (let x = -radius; x <= radius; x += increment) {
            for (let y = -radius; y <= radius; y += increment) {
                const data = picker.getColorAndValue(x, y, radius);

                if (!data)
                    continue;

                expect(data).toHaveProperty('hs');

                if ('hs' in data) {
                    const [hue, saturation] = data.hs;

                    const coords = picker.getCoordinatesAndColor(hue, saturation, radius);
                    expect(coords.position.Y).toBe(y);
                    expect(coords.position.X).toBe(x);
                }
            }
        }
    });
});