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
});