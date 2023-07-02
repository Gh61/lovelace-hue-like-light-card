import { HueLikeLightCard } from '../dist/hue-like-light-card';
import { hassMockup } from './mockup-hass-states';

describe('Card', () => {
    it('creates card instance, config first', () => {
        const card = new HueLikeLightCard();
        card.setConfig({
            entity: 'light.test'
        });
        card.hass = hassMockup;
    });

    it('creates card instance, hass first', () => {
        const card = new HueLikeLightCard();
        card.hass = hassMockup;
        card.setConfig({
            entity: 'light.test'
        });
    });

    it('works with style', () => {
        const s = '*{color:white}';
        const card = new HueLikeLightCard();
        card.setConfig({
            entity: 'light.test',
            style: '*{color:white}'
        });

        // eslint-disable-next-line no-underscore-dangle
        expect(card._config?.style).toBe(s);
    });

    it('works with card_mod/style', () => {
        const s = { style: '*{color:white}' };
        const card = new HueLikeLightCard();
        card.setConfig({
            entity: 'light.test',
            card_mod: s
        });

        // eslint-disable-next-line no-underscore-dangle
        expect(card._config?.card_mod).toBe(s);
    });
});