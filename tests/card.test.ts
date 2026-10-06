import { HomeAssistant } from 'custom-card-helpers';
import { HueLikeLightCard } from '../src/hue-like-light-card';
import { GlobalLights } from '../src/core/global-lights';
import { Consts } from '../src/types/consts';
import { hassMockup } from './mockup-hass-states';

describe('Card', () => {
    it('creates card instance, config first', () => {
        const card = new HueLikeLightCard();
        card.setConfig({
            type: 'custom:' + Consts.CardElementName,
            entity: 'light.test'
        });
        card.hass = hassMockup;
    });

    it('creates card instance, hass first', () => {
        const card = new HueLikeLightCard();
        card.hass = hassMockup;
        card.setConfig({
            type: 'custom:' + Consts.CardElementName,
            entity: 'light.test'
        });
    });

    it('works with style', () => {
        const s = '*{color:white}';
        const card = new HueLikeLightCard();
        card.setConfig({
            type: 'custom:' + Consts.CardElementName,
            entity: 'light.test',
            style: '*{color:white}'
        });

        expect(card['_config']?.style).toBe(s);
    });

    it('works with card_mod/style', () => {
        const s = { style: '*{color:white}' };
        const card = new HueLikeLightCard();
        card.setConfig({
            type: 'custom:' + Consts.CardElementName,
            entity: 'light.test',
            card_mod: s
        });

        expect(card['_config']?.card_mod).toBe(s);
    });

    it('should not register listeners while disconnected', async () => {
        const hass = { ...hassMockup, themes: { default_theme: 'default', themes: {} } } as unknown as HomeAssistant;
        const card = new HueLikeLightCard();
        card.setConfig({
            type: 'custom:' + Consts.CardElementName,
            entity: 'light.test',
            scenes: [] // no async config init
        });
        card.hass = hass;

        document.body.appendChild(card);
        await card.updateComplete;

        const ctrl = card['_ctrl']!;
        const registerSpy = jest.spyOn(ctrl, 'registerOnPropertyChanged');

        card.remove();
        card.hass = { ...hass };
        await card.updateComplete;

        expect(registerSpy).not.toHaveBeenCalled();
        expect(card['_ctrlListenerRegistered']).toBe(false);
        expect(card['_mc']).toBeUndefined();

        // reconnected card registers again
        document.body.appendChild(card);
        await card.updateComplete;

        expect(registerSpy).toHaveBeenCalledTimes(1);
        expect(card['_mc']).toBeDefined();

        card.remove();
    });

    it('should move listener to the new controller when config is set again', async () => {
        const hass = {
            ...hassMockup,
            states: { ...hassMockup.states, 'light.test_other': hassMockup.states['light.test'] },
            themes: { default_theme: 'default', themes: {} }
        } as unknown as HomeAssistant;
        const card = new HueLikeLightCard();
        card.setConfig({
            type: 'custom:' + Consts.CardElementName,
            entity: 'light.test',
            scenes: [] // no async config init
        });
        card.hass = hass;

        document.body.appendChild(card);
        await card.updateComplete;

        const elementId = card['_elementId'];
        const hasCardCallback = (entityId: string) =>
            elementId in GlobalLights.getLightContainer(entityId)['_propertyChangedCallbacks'];

        expect(hasCardCallback('light.test')).toBe(true);

        // e.g. card editor preview while editing YAML
        card.setConfig({
            type: 'custom:' + Consts.CardElementName,
            entity: 'light.test_other',
            scenes: []
        });
        await card.updateComplete;

        expect(hasCardCallback('light.test_other')).toBe(true);
        expect(hasCardCallback('light.test')).toBe(false);

        card.remove();
        expect(hasCardCallback('light.test_other')).toBe(false);
    });
});
