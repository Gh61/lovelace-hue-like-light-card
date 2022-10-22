import { fireEvent } from 'custom-card-helpers';
import { HueDialog } from '../hue-dialog/dialog';
import { HueLikeLightCardConfig } from '../types/config';
import { ClickAction, ClickActionData, SceneData } from '../types/types';
import { LightController } from './light-controller';

export class ClickHandler {
    private _config: HueLikeLightCardConfig;
    private _ctrl: LightController;
    private _el: HTMLElement | Window;

    constructor(config: HueLikeLightCardConfig, ctrl: LightController, element: HTMLElement | Window) {
        this._config = config;
        this._ctrl = ctrl;
        this._el = element;
    }

    public handleClick() : void {
        const isOn = this._ctrl.isOn();
        let action = isOn ? this._config.onClickAction : this._config.offClickAction;
        const actionData = isOn ? this._config.onClickData : this._config.offClickData;

        // resolve the default action
        if (action == ClickAction.Default) {
            if (isOn) {
                action = this.resolveDefaultWhenOn();
            } else {
                action = this.resolveDefaultWhenOff();
            }
        }

        // executed resolved or config action
        this.executeClickAction(action, actionData);
    }

    private resolveDefaultWhenOn() : ClickAction {
        // When is on and has scenes - show scenes
        if (this._config.scenes.length) {
            return ClickAction.HueScreen;
        }

        // When is only 1 (and has no scenes) - show more-info
        if (this._ctrl.count == 1) {
            return ClickAction.MoreInfo;
        }

        return ClickAction.TurnOff;
    }

    private resolveDefaultWhenOff() : ClickAction {
        // When is off and is only 1 - show more-info
        if (this._ctrl.count == 1) {
            return ClickAction.MoreInfo;
        }

        // When is more than 1 (and has scenes) - show scenes
        if (this._config.scenes.length) {
            return ClickAction.HueScreen;
        }

        return ClickAction.TurnOn;
    }

    private executeClickAction(action: ClickAction, actionData: ClickActionData) {
        switch (action) {
            case ClickAction.NoAction:
                break;
            case ClickAction.TurnOn:
                this._ctrl.turnOn();
                break;
            case ClickAction.TurnOff:
                this._ctrl.turnOff();
                break;
            case ClickAction.MoreInfo:
                let entityId:string = actionData.getData('entity');

                // no entity defined in data
                if (!entityId) {
                    // if is on, get first onLight
                    if (this._ctrl.isOn()) {
                        entityId = this._ctrl.getLitLights()[0].getEntityId();
                    } else {
                        entityId = this._config.getEntities()[0];
                    }
                }

                fireEvent(this._el, 'hass-more-info', { entityId: entityId });
                break;
            case ClickAction.Scene:
                const sceneId = actionData.getData('scene');
                if (!sceneId)
                    throw new Error('No scene for click defined.');

                // create scene object and activate
                const scene = new SceneData(sceneId);
                scene.hass = this._ctrl.hass;
                scene.activate();

                break;
            case ClickAction.HueScreen:
                const dialog = new HueDialog(this._config, this._ctrl);
                dialog.show();
                break;

            case ClickAction.Default:
                throw new Error('Cannot execute Default action');
            default:
                throw new Error(`Cannot executed unwknow action ${action}.`);
        }
    }
}