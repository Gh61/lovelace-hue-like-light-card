import { fireEvent } from '../ha/common/dom/fire_event';
import { HueDialog, HueDialogParams } from '../controls/dialog';
import { HueLikeLightCardConfig } from '../types/config';
import { SceneData } from '../types/types-config';
import { CardGesture } from '../types/card-actions';
import { handleAction } from '../ha/panels/lovelace/common/handle-action';
import { AreaLightController } from './area-light-controller';
import { HueLikeLightCard } from '../hue-like-light-card';

export class ActionHandler {
    private _config: HueLikeLightCardConfig;
    private _ctrl: AreaLightController;
    private _owner: HueLikeLightCard;

    public constructor(config: HueLikeLightCardConfig, ctrl: AreaLightController, element: HueLikeLightCard) {
        this._config = config;
        this._ctrl = ctrl;
        this._owner = element;
    }

    public showMoreInfo(entityId: string): void {
        fireEvent(this._owner, 'hass-more-info', { entityId: entityId });
    }

    /** Opens the Hue screen through the HA dialog manager (history, stacking and card-mod work like for HA dialogs). */
    public openHueScreen(): void {
        const params: HueDialogParams = {
            config: this._config,
            lightController: this._ctrl,
            actionHandler: this
        };
        fireEvent(this._owner, 'show-dialog', {
            dialogTag: HueDialog.ElementName as keyof HTMLElementTagNameMap, // HA types the tag against the global tag map
            dialogImport: () => Promise.resolve(), // the element is part of this bundle
            dialogParams: params
        });
    }

    /**
     * Executes the configured action of the card for the gesture (tap / hold / double tap).
     * Actions of the card run here, the HA actions are handed to Home Assistant (`hass-action` event -
     * confirmation, haptics, navigation, service calls, ...).
     */
    public handleCardAction(gesture: CardGesture): void {
        const isOn = this._ctrl.isOn();
        const action = this._config.actions.getAction(gesture, isOn);

        switch (action.action) {
            case 'turn-on':
                this._ctrl.turnOn();
                break;
            case 'turn-off':
                this._ctrl.turnOff();
                break;
            case 'toggle':
                // toggle of the whole card, not of a single entity as HA would do
                if (isOn) {
                    this._ctrl.turnOff();
                }
                else {
                    this._ctrl.turnOn();
                }
                break;
            case 'scene': {
                const scene = new SceneData(action.scene);
                scene.hass = this._ctrl.hass;
                scene.activate();
                break;
            }
            case 'hue-screen':
                this.openHueScreen();
                break;
            case 'none':
                break;
            default:
                handleAction(this._owner, this._ctrl.hass, {
                    entity: this._ctrl.getMoreInfoEntityId(),
                    [`${gesture}_action`]: action
                }, gesture);
        }
    }
}