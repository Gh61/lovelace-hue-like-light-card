import { Color } from '../src/core/colors/color';

describe('Color', () => {
    it('too short hex', () => {
        const s = '#32';
        
        expect(() => {
            new Color(s);
        }).toThrowError('Hex color format should have 3/6 letters or 4/8 letters for transparency.');
    });

    it('simple hex', () => {
        const s = '#abc';
        const color = new Color(s);

        expect(color.getRed()).toBe(170);
        expect(color.getGreen()).toBe(187);
        expect(color.getBlue()).toBe(204);
        expect(color.getOpacity()).toBe(1);
        expect(color.toString()).toBe('rgb(170,187,204)');
    });

    it('invalid simple hex', () => {
        const s = '#ffx';

        expect(() => {
            new Color(s);
        }).toThrowError('Hex color format contains non hex characters - \'x\'');
    });

    it('full hex', () => {
        const s = '#17f7ad';
        const color = new Color(s);

        expect(color.getRed()).toBe(23);
        expect(color.getGreen()).toBe(247);
        expect(color.getBlue()).toBe(173);
        expect(color.getOpacity()).toBe(1);
        expect(color.toString()).toBe('rgb(23,247,173)');
    });

    it('too short full hex', () => {
        const s = '#17fec';
        
        expect(() => {
            new Color(s);
        }).toThrowError('Hex color format should have 3/6 letters or 4/8 letters for transparency.');
    });

    it('invalid full hex', () => {
        const s = '#17fgad';
        
        expect(() => {
            new Color(s);
        }).toThrowError('Hex color format contains non hex characters - \'g\'');
    });

    it('unknown format', () => {
        const s = 'rga(84,68,43)';
        
        expect(() => {
            new Color(s);
        }).toThrowError();
    });

    it('rgb', () => {
        const s = 'rgb(1,234,56)';
        const color = new Color(s);

        expect(color.getRed()).toBe(1);
        expect(color.getGreen()).toBe(234);
        expect(color.getBlue()).toBe(56);
        expect(color.getOpacity()).toBe(1);
        expect(color.toString()).toBe('rgb(1,234,56)');
    });

    it('rgb spaces', () => {
        const s = 'rgb( 240,           89 ,38 )';
        const color = new Color(s);

        expect(color.getRed()).toBe(240);
        expect(color.getGreen()).toBe(89);
        expect(color.getBlue()).toBe(38);
        expect(color.getOpacity()).toBe(1);
        expect(color.toString()).toBe('rgb(240,89,38)');
    });

    // named colors cannot be tested, because in test environment parsing color from canvas is not possible
});