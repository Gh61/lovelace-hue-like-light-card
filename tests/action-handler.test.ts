import { HomeAssistant } from '../src/ha/types';
import { HueLikeLightCard } from '../src/hue-like-light-card';
import { ActionHandler } from '../src/core/action-handler';
import { HueDialog } from '../src/controls/dialog';
import { Consts } from '../src/types/consts';
import { HueLikeLightCardConfigInterface } from '../src/types/types-config';
import { hassMockup } from './mockup-hass-states';
import './mockup-ha-elements';

describe('ActionHandler', () => {
    const createCard = async (config: Partial<HueLikeLightCardConfigInterface> = {}) => {
        const hass = { ...hassMockup, themes: { default_theme: 'default', themes: {} } } as unknown as HomeAssistant;
        const card = new HueLikeLightCard();
        card.setConfig({
            type: 'custom:' + Consts.CardElementName,
            entity: 'light.test',
            scenes: [], // no async config init
            ...config
        });
        card.hass = hass;
        document.body.appendChild(card);
        await card.updateComplete;
        return card;
    };

    it('should open the Hue screen through the HA show-dialog event', async () => {
        const card = await createCard();
        // eslint-disable-next-line @typescript-eslint/dot-notation
        const handler = new ActionHandler(card['_config']!, card['_ctrl']!, card);

        const events: CustomEvent[] = [];
        document.body.addEventListener('show-dialog', (ev) => events.push(ev as CustomEvent), { once: true });

        handler.openHueScreen();

        expect(events).toHaveLength(1);
        const detail = events[0].detail;
        expect(detail.dialogTag).toBe(HueDialog.ElementName);
        expect(detail.dialogParams.config).toBe(card['_config']);
        expect(detail.dialogParams.lightController).toBe(card['_ctrl']);
        expect(detail.dialogParams.actionHandler).toBe(handler);
        await expect(detail.dialogImport()).resolves.toBeUndefined();

        card.remove();
    });

    it('should open the Hue screen on tap and more-info on hold by default', async () => {
        const card = await createCard();
        // eslint-disable-next-line @typescript-eslint/dot-notation
        const handler = new ActionHandler(card['_config']!, card['_ctrl']!, card);
        const events: string[] = [];
        document.body.addEventListener('show-dialog', () => events.push('show-dialog'), { once: true });
        document.body.addEventListener('hass-action', (ev) => events.push('hass-action:' + (ev as CustomEvent).detail.action), { once: true });

        handler.handleCardAction('tap');
        handler.handleCardAction('hold');
        handler.handleCardAction('double_tap'); // none

        expect(events).toStrictEqual(['show-dialog', 'hass-action:hold']);
        card.remove();
    });

    it('should hand HA actions to Home Assistant with the more-info entity', async () => {
        const card = await createCard({ tap_action: { action: 'navigate', navigation_path: '/lovelace/1' } });
        // eslint-disable-next-line @typescript-eslint/dot-notation
        const handler = new ActionHandler(card['_config']!, card['_ctrl']!, card);
        const events: CustomEvent[] = [];
        document.body.addEventListener('hass-action', (ev) => events.push(ev as CustomEvent), { once: true });

        handler.handleCardAction('tap');

        expect(events).toHaveLength(1);
        expect(events[0].detail).toStrictEqual({
            config: { entity: 'light.test', tap_action: { action: 'navigate', navigation_path: '/lovelace/1' } },
            action: 'tap'
        });
        card.remove();
    });

    it('should run the card actions through the controller', async () => {
        const card = await createCard({ tap_action: { action: 'toggle' }, hold_action: { action: 'turn-off' }, double_tap_action: { action: 'turn-on' } });
        // eslint-disable-next-line @typescript-eslint/dot-notation
        const ctrl = card['_ctrl']!;
        // eslint-disable-next-line @typescript-eslint/dot-notation
        const handler = new ActionHandler(card['_config']!, ctrl, card);
        const turnOn = jest.spyOn(ctrl, 'turnOn').mockImplementation(() => undefined);
        const turnOff = jest.spyOn(ctrl, 'turnOff').mockImplementation(() => undefined);
        const isOn = jest.spyOn(ctrl, 'isOn');

        isOn.mockReturnValue(true);
        handler.handleCardAction('tap');
        expect(turnOff).toHaveBeenCalledTimes(1);

        isOn.mockReturnValue(false);
        handler.handleCardAction('tap');
        expect(turnOn).toHaveBeenCalledTimes(1);

        handler.handleCardAction('hold');
        handler.handleCardAction('double_tap');
        expect(turnOff).toHaveBeenCalledTimes(2);
        expect(turnOn).toHaveBeenCalledTimes(2);

        card.remove();
    });

    it('should fire hass-more-info for more-info', async () => {
        const card = await createCard();
        // eslint-disable-next-line @typescript-eslint/dot-notation
        const handler = new ActionHandler(card['_config']!, card['_ctrl']!, card);

        const events: CustomEvent[] = [];
        document.body.addEventListener('hass-more-info', (ev) => events.push(ev as CustomEvent), { once: true });

        handler.showMoreInfo('light.test');

        expect(events).toHaveLength(1);
        expect(events[0].detail.entityId).toBe('light.test');

        card.remove();
    });
});
