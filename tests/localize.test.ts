import { localize } from '../src/localize/localize';
import { hassMockup } from './mockup-hass-states';

describe('Localization', () => {
    it('should return text', () => {
        const result = localize('cs', 'dialog.lights');
        expect(result).toBe('Světla');
    });

    it('should localize hass lang', () => {
        const result = localize(hassMockup, 'dialog.lights');
        expect(result).toBe('Světla');
    });

    it('should localize specific locale', () => {
        const result = localize('cs-CZ', 'dialog.lights');
        expect(result).toBe('Světla');
    });

    it('should localize non existing language', () => {
        const result = localize('xx-XX', 'dialog.lights');
        expect(result).toBe('Lights');
    });
});