import { CallServiceActionConfig } from '../ha/data/lovelace/config/action';
import { tryParseEnum } from './extensions';
import { ActionHandlerDetail } from '../ha/data/lovelace/action_handler';
import { CardActionConfig, ClickAction, ClickActionData, HueLikeLightCardConfigInterface } from './types-config';

/** Gesture of the card, as reported by the HA action handler directive. */
export type CardGesture = ActionHandlerDetail['action'];

type CardActionKey = `${'' | 'on_' | 'off_'}${CardGesture}_action`;

/** Actions of the card (`turn-on`, ...) and the HA actions (`navigate`, `perform-action`, ...) - checked against the `CardActionConfig` union. */
const CardActionNames: CardActionConfig['action'][] = ['turn-on', 'turn-off', 'scene', 'hue-screen'];
const HaActionNames: CardActionConfig['action'][] = ['none', 'toggle', 'more-info', 'navigate', 'url', 'call-service', 'perform-action', 'assist', 'fire-dom-event'];

/**
 * Tap / hold / double-tap actions of the card.
 *
 * Resolution order for a gesture: `on_<gesture>_action` / `off_<gesture>_action` (by the state of the lights),
 * `<gesture>_action`, the deprecated `onClickAction` + `onClickData` family (mapped to the same action objects),
 * the default (`hue-screen` for tap, `more-info` for hold, `none` for double tap).
 */
export class CardActions {
    private static readonly Defaults: Record<CardGesture, CardActionConfig> = {
        tap: { action: 'hue-screen' },
        hold: { action: 'more-info' },
        double_tap: { action: 'none' }
    };

    private readonly _actions: Partial<Record<CardActionKey, CardActionConfig>> = {};

    public constructor(plainConfig: HueLikeLightCardConfigInterface) {
        for (const gesture of ['tap', 'hold', 'double_tap'] as CardGesture[]) {
            for (const prefix of ['', 'on_', 'off_'] as const) {
                const key: CardActionKey = `${prefix}${gesture}_action`;
                const plain = plainConfig[key];
                if (plain != null) {
                    this._actions[key] = CardActions.parseAction(plain, key);
                }
            }
        }

        // deprecated options (removed later) - only where the current options are not set
        this.setDeprecated('on_tap_action', plainConfig.onClickAction, plainConfig.onClickData, 'onClickAction');
        this.setDeprecated('off_tap_action', plainConfig.offClickAction, plainConfig.offClickData, 'offClickAction');
        this.setDeprecated('on_hold_action', plainConfig.onHoldAction, plainConfig.onHoldData, 'onHoldAction');
        this.setDeprecated('off_hold_action', plainConfig.offHoldAction, plainConfig.offHoldData, 'offHoldAction');
    }

    /**
     * @returns the action to execute for the gesture in the current state of the lights.
     */
    public getAction(gesture: CardGesture, isOn: boolean): CardActionConfig {
        return this._actions[`${isOn ? 'on' : 'off'}_${gesture}_action`]
            ?? this._actions[`${gesture}_action`]
            ?? CardActions.Defaults[gesture];
    }

    /** Whether a double-tap action is configured (the HA action handler then waits for a possible second tap). */
    public get hasDoubleTap(): boolean {
        const keys: CardActionKey[] = ['double_tap_action', 'on_double_tap_action', 'off_double_tap_action'];
        return keys.some(key => this._actions[key] != null && this._actions[key]!.action !== 'none');
    }

    private setDeprecated(key: CardActionKey, plainAction: ClickAction | string | undefined, plainData: string | Record<string, string> | ClickActionData | undefined, optionName: string) {
        // an empty value of the deprecated option means "not set", as before
        if (this._actions[key] != null || !plainAction) {
            return;
        }
        const action = CardActions.parseDeprecatedAction(plainAction, new ClickActionData(plainData), optionName);
        if (action) {
            this._actions[key] = action;
        }
    }

    /**
     * Maps the deprecated `*Action` + `*Data` pair to an action object (`default` means "not set").
     * @throws Error for an unknown action or missing scene.
     */
    private static parseDeprecatedAction(plain: ClickAction | string, data: ClickActionData, optionName: string): CardActionConfig | null {
        switch (tryParseEnum<ClickAction>(ClickAction, plain, optionName)) {
            case ClickAction.Default:
                return null;
            case ClickAction.MoreInfo: {
                const entity = data.getData('entity');
                return entity ? { action: 'more-info', entity } : { action: 'more-info' };
            }
            case ClickAction.Scene:
                return CardActions.validate({ action: 'scene', scene: data.getData('scene') }, optionName);
            default:
                return { action: plain } as CardActionConfig;
        }
    }

    /**
     * @returns the validated action object from the config.
     * @throws Error with a user-friendly message for a wrong shape, unknown action or missing required data.
     */
    private static parseAction(plain: unknown, optionName: string): CardActionConfig {
        if (typeof plain !== 'object' || plain === null || Array.isArray(plain) || typeof (plain as CardActionConfig).action !== 'string') {
            throw new Error(`${optionName} must be an object with the 'action' key, e.g. { action: 'hue-screen' }.`);
        }
        return CardActions.validate(plain as CardActionConfig, optionName);
    }

    private static validate(action: CardActionConfig, optionName: string): CardActionConfig {
        const allowed: string[] = [...CardActionNames, ...HaActionNames];
        if (!allowed.includes(action.action)) {
            throw new Error(`${optionName}: action '${action.action}' was not recognized. Allowed values are: ${allowed.map(n => `'${n}'`).join(', ')}`);
        }

        const required: Partial<Record<string, string>> = {
            scene: 'scene',
            navigate: 'navigation_path',
            url: 'url_path'
        };
        const requiredKey = required[action.action];
        if (requiredKey && !(action as unknown as Record<string, unknown>)[requiredKey]) {
            throw new Error(`${optionName}: action '${action.action}' needs the '${requiredKey}' key.`);
        }
        if (action.action === 'perform-action' || action.action === 'call-service') {
            const call = action as Partial<CallServiceActionConfig>;
            if (!call.perform_action && !call.service) {
                throw new Error(`${optionName}: action '${action.action}' needs the 'perform_action' key.`);
            }
        }

        return action;
    }
}
