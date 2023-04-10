import { Color } from "../src/core/colors/color";

describe('Color Transparent', () => {
    it('simple hex opacity param', () => {
        const s = '#cba';
        const color = new Color(s, 0.7);

        expect(color.getRed()).toBe(204);
        expect(color.getGreen()).toBe(187);
        expect(color.getBlue()).toBe(170);
        expect(color.getOpacity()).toBe(0.7);
        expect(color.toString()).toBe('rgba(204,187,170,0.7)');
    });

    it('rgb opacity param', () => {
        const s = 'rgb(99,234,56)';
        const color = new Color(s, 0.33);

        expect(color.getRed()).toBe(99);
        expect(color.getGreen()).toBe(234);
        expect(color.getBlue()).toBe(56);
        expect(color.getOpacity()).toBe(0.33);
        expect(color.toString()).toBe('rgba(99,234,56,0.33)');
    });

    it('rgb param opacity param', () => {
        const color = new Color(101, 102, 103, 0.44);

        expect(color.getRed()).toBe(101);
        expect(color.getGreen()).toBe(102);
        expect(color.getBlue()).toBe(103);
        expect(color.getOpacity()).toBe(0.44);
        expect(color.toString()).toBe('rgba(101,102,103,0.44)');
    });

    it('rgba', () => {
        const s = 'rgba(123,4,56,0.5)';
        const color = new Color(s);

        expect(color.getRed()).toBe(123);
        expect(color.getGreen()).toBe(4);
        expect(color.getBlue()).toBe(56);
        expect(color.getOpacity()).toBe(0.5);
        expect(color.toString()).toBe('rgba(123,4,56,0.5)');
    });

    it('rgba no leading zero', () => {
        const s = 'rgba(1,234,56,.78)';
        const color = new Color(s);

        expect(color.getRed()).toBe(1);
        expect(color.getGreen()).toBe(234);
        expect(color.getBlue()).toBe(56);
        expect(color.getOpacity()).toBe(0.78);
        expect(color.toString()).toBe('rgba(1,234,56,0.78)');
    });

    it('rgba spaces', () => {
        const s = 'rgba(    7 ,11       ,          39,     0)';
        const color = new Color(s);

        expect(color.getRed()).toBe(7);
        expect(color.getGreen()).toBe(11);
        expect(color.getBlue()).toBe(39);
        expect(color.getOpacity()).toBe(0);
        expect(color.toString()).toBe('rgba(7,11,39,0)');
    });

    it('rgba round', () => {
        const s = 'rgba(12, 13, 14, 0.111111111111111111111111111)';
        const color = new Color(s);

        expect(color.getRed()).toBe(12);
        expect(color.getGreen()).toBe(13);
        expect(color.getBlue()).toBe(14);
        expect(color.getOpacity()).toBe(0.11);
        expect(color.toString()).toBe('rgba(12,13,14,0.11)');
    });

    it('simple hex4', () => {
        const s = '#cbad';
        const color = new Color(s);

        expect(color.getRed()).toBe(204);
        expect(color.getGreen()).toBe(187);
        expect(color.getBlue()).toBe(170);
        expect(color.getOpacity()).toBe(0.87);
        expect(color.toString()).toBe('rgba(204,187,170,0.87)');
    });

    it('full hex8', () => {
        const s = '#17f7ad99';
        const color = new Color(s);

        expect(color.getRed()).toBe(23);
        expect(color.getGreen()).toBe(247);
        expect(color.getBlue()).toBe(173);
        expect(color.getOpacity()).toBe(0.6);
        expect(color.toString()).toBe('rgba(23,247,173,0.6)');
    });
});