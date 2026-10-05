import { HueLikeLightCardConfig } from '../src/types/config';
import { ClickAction, HueLikeLightCardConfigInterface } from '../src/types/types-config';

describe('CardActions', () => {
    const parse = (plain: Partial<HueLikeLightCardConfigInterface>) => new HueLikeLightCardConfig({ entity: 'light.test', ...plain }).actions;

    it('should use the defaults when nothing is configured', () => {
        const actions = parse({});

        expect(actions.getAction('tap', false)).toStrictEqual({ action: 'hue-screen' });
        expect(actions.getAction('tap', true)).toStrictEqual({ action: 'hue-screen' });
        expect(actions.getAction('hold', true)).toStrictEqual({ action: 'more-info' });
        expect(actions.getAction('double_tap', true)).toStrictEqual({ action: 'none' });
        expect(actions.hasDoubleTap).toBe(false);
    });

    it('should prefer the on/off variant over the general action', () => {
        const actions = parse({
            tap_action: { action: 'toggle' },
            off_tap_action: { action: 'turn-on' },
            hold_action: { action: 'navigate', navigation_path: '/lovelace/0' }
        });

        expect(actions.getAction('tap', false)).toStrictEqual({ action: 'turn-on' });
        expect(actions.getAction('tap', true)).toStrictEqual({ action: 'toggle' });
        expect(actions.getAction('hold', false)).toStrictEqual({ action: 'navigate', navigation_path: '/lovelace/0' });
        expect(actions.getAction('hold', true)).toStrictEqual({ action: 'navigate', navigation_path: '/lovelace/0' });
    });

    it('should report a configured double tap', () => {
        expect(parse({ double_tap_action: { action: 'more-info' } }).hasDoubleTap).toBe(true);
        expect(parse({ on_double_tap_action: { action: 'turn-off' } }).hasDoubleTap).toBe(true);
        expect(parse({ double_tap_action: { action: 'none' } }).hasDoubleTap).toBe(false);
    });

    it('should map the deprecated options to actions', () => {
        const actions = parse({
            offClickAction: ClickAction.TurnOn,
            onClickAction: ClickAction.Scene,
            onClickData: { scene: 'scene.evening' },
            onHoldAction: ClickAction.MoreInfo,
            onHoldData: 'media_player.tv',
            offHoldAction: ClickAction.Default
        });

        expect(actions.getAction('tap', false)).toStrictEqual({ action: 'turn-on' });
        expect(actions.getAction('tap', true)).toStrictEqual({ action: 'scene', scene: 'scene.evening' });
        expect(actions.getAction('hold', true)).toStrictEqual({ action: 'more-info', entity: 'media_player.tv' });
        expect(actions.getAction('hold', false)).toStrictEqual({ action: 'more-info' }); // default
    });

    it('should let the current options win over the deprecated ones', () => {
        const actions = parse({
            onClickAction: ClickAction.TurnOff,
            on_tap_action: { action: 'none' }
        });

        expect(actions.getAction('tap', true)).toStrictEqual({ action: 'none' });
    });

    it('should treat an empty deprecated option as not set', () => {
        const actions = parse({ onClickAction: '' as ClickAction });

        expect(actions.getAction('tap', true)).toStrictEqual({ action: 'hue-screen' });
    });

    it.each([
        [{ tap_action: 'hue-screen' }, /tap_action must be an object/],
        [{ tap_action: { action: 'fly' } }, /action 'fly' was not recognized/],
        [{ hold_action: { action: 'scene' } }, /needs the 'scene' key/],
        [{ on_tap_action: { action: 'navigate' } }, /needs the 'navigation_path' key/],
        [{ off_hold_action: { action: 'url' } }, /needs the 'url_path' key/],
        [{ double_tap_action: { action: 'perform-action' } }, /needs the 'perform_action' key/],
        [{ onClickAction: 'fly' }, /onClickAction 'fly' was not recognized/],
        [{ onClickAction: ClickAction.Scene }, /needs the 'scene' key/]
    ])('should throw a user-friendly error for %p', (plain, message) => {
        expect(() => parse(plain as unknown as HueLikeLightCardConfigInterface)).toThrow(message);
    });
});
