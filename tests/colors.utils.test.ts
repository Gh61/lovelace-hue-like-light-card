import { Color } from '../src/core/colors/color';

describe('Color utils', () => {
    it('should return valid HSV values - rgb2hsv', () => {
        for (let r = 0; r < 256; r += 9) {
            for (let g = 0; g < 256; g += 9) {
                for (let b = 0; b < 256; b += 9) {
                    const [h, s, v] = Color.rgb2hsv(r, g, b);

                    expect(h).toBeGreaterThanOrEqual(0);
                    expect(h).toBeLessThanOrEqual(360);
                    expect(s).toBeGreaterThanOrEqual(0);
                    expect(s).toBeLessThanOrEqual(1);
                    expect(v).toBeGreaterThanOrEqual(0);
                    expect(v).toBeLessThanOrEqual(1);
                }
            }
        }
    });

    it('should return valid RGB values - hsv2rgb', () => {
        for (let h = 0; h <= 360; h += 9) {
            for (let s = 0; s <= 1; s += 0.032) {
                for (let v = 0.2; v <= 1; v += 0.032) {
                    const [r, g, b] = Color.hsv2rgb(h, s, v);

                    expect(r).toBeGreaterThanOrEqual(0);
                    expect(r).toBeLessThanOrEqual(255);
                    expect(g).toBeGreaterThanOrEqual(0);
                    expect(g).toBeLessThanOrEqual(255);
                    expect(b).toBeGreaterThanOrEqual(0);
                    expect(b).toBeLessThanOrEqual(255);
                }
            }
        }
    });

    it('should return valid RGB values - xy2rgb', () => {
        for (let x = 0; x <= 1; x += 0.05) {
            for (let y = 0.05; y <= 1; y += 0.05) {
                for (let brightness = 0; brightness <= 254; brightness += 17) {
                    const [r, g, b] = Color.xy2rgb(x, y, brightness);

                    expect(r).toBeGreaterThanOrEqual(0);
                    expect(r).toBeLessThanOrEqual(255);
                    expect(g).toBeGreaterThanOrEqual(0);
                    expect(g).toBeLessThanOrEqual(255);
                    expect(b).toBeGreaterThanOrEqual(0);
                    expect(b).toBeLessThanOrEqual(255);
                }
            }
        }
    });

    it('should return valid XY values - rgb2xy', () => {
        for (let r = 0; r < 256; r += 17) {
            for (let g = 0; g < 256; g += 17) {
                for (let b = 0; b < 256; b += 17) {
                    const [x, y, brightness] = Color.rgb2xy(r, g, b);

                    expect(x).toBeGreaterThanOrEqual(0);
                    expect(x).toBeLessThanOrEqual(1);
                    expect(y).toBeGreaterThanOrEqual(0);
                    expect(y).toBeLessThanOrEqual(1);
                    expect(brightness).toBeGreaterThanOrEqual(0);
                    expect(brightness).toBeLessThanOrEqual(254);
                }
            }
        }
    });

    it('should return zero coordinates for black - rgb2xy', () => {
        const [x, y, brightness] = Color.rgb2xy(0, 0, 0);

        expect(x).toBe(0);
        expect(y).toBe(0);
        expect(brightness).toBe(0);
    });

    it('should return distinct coordinates for primary colors - rgb2xy', () => {
        const [redX, redY, redBrightness] = Color.rgb2xy(255, 0, 0);
        const [greenX, greenY, greenBrightness] = Color.rgb2xy(0, 255, 0);
        const [blueX, blueY, blueBrightness] = Color.rgb2xy(0, 0, 255);

        expect(redX).not.toBeCloseTo(greenX, 2);
        expect(redY).not.toBeCloseTo(greenY, 2);
        expect(redX).not.toBeCloseTo(blueX, 2);
        expect(redY).not.toBeCloseTo(blueY, 2);
        expect(greenX).not.toBeCloseTo(blueX, 2);
        expect(greenY).not.toBeCloseTo(blueY, 2);
        expect(redBrightness).toBe(254);
        expect(greenBrightness).toBe(254);
        expect(blueBrightness).toBe(254);
    });
});
