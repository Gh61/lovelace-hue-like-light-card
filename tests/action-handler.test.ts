import { HomeAssistant } from '../src/ha/types';
import { HueLikeLightCard } from '../src/hue-like-light-card';
import { ActionHandler } from '../src/core/action-handler';
import { HueDialog } from '../src/controls/dialog';
import { Consts } from '../src/types/consts';
import { hassMockup } from './mockup-hass-states';
import './mockup-ha-elements';

describe('ActionHandler', () => {
    const createCard = async () => {
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
        return card;
    };

    it('should open the Hue screen through the HA show-dialog event', async () => {
        const card = await createCard();
        // eslint-disable-next-line @typescript-eslint/dot-notation
        const handler = new ActionHandler(card['_config']!, card['_ctrl']!, card);

        const events: CustomEvent[] = [];
        document.body.addEventListener('show-dialog', (ev) => events.push(ev as CustomEvent));

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

    it('should fire hass-more-info for more-info', async () => {
        const card = await createCard();
        // eslint-disable-next-line @typescript-eslint/dot-notation
        const handler = new ActionHandler(card['_config']!, card['_ctrl']!, card);

        const events: CustomEvent[] = [];
        document.body.addEventListener('hass-more-info', (ev) => events.push(ev as CustomEvent));

        handler.showMoreInfo('light.test');

        expect(events).toHaveLength(1);
        expect(events[0].detail.entityId).toBe('light.test');

        card.remove();
    });
});
