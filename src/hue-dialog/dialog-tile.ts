import { HomeAssistant } from 'custom-card-helpers';
import { html, css, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Consts } from '../types/consts';
import { nameof } from '../types/extensions';
import { SceneConfig, SceneData } from '../types/types';

/**
 * Represents tile element in HueDialog (it can be Scene tile, Light tile, ...)
 */
@customElement(HueDialogTile.ElementName)
export class HueDialogTile extends LitElement {

    public static readonly ElementName = Consts.CardElementName + '-hue-dialog-tile';

    private _hass: HomeAssistant;
    private _sceneConfig: SceneConfig;
    private _scene: SceneData;

    set hass(hass:HomeAssistant) {
        // custom @property() implementation
        this.requestUpdate(nameof(this, 'hass'), this._hass);

        this._hass = hass;
        this.updateHassDependentProps();
    }

    set sceneConfig(config:SceneConfig) {
        // custom @property() implementation
        this.requestUpdate(nameof(this, 'sceneConfig'), this._sceneConfig);

        this._sceneConfig = config;
        this._scene = new SceneData(config);
        this.updateHassDependentProps();
    }

    private updateHassDependentProps() {
        if (this._hass && this._scene) {
            this._scene.hass = this._hass;
        }
    }

    static styles = css`
    .hue-tile{
        background: ${unsafeCSS(Consts.OffColor)};
        width: 130px;
        height: 145px;
        padding: 5px;
    }
    .scene {
        cursor: pointer;
    }
    .scene .icon-background {
        height: 70%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .scene .icon-background .color {
        background: red; /* TODO */
        height: 60px;
        width: 60px;
        border-radius: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .scene .icon-background .color ha-icon{
        color:${unsafeCSS(Consts.LightColor)};
        transform: scale(1.8);
    }

    .scene .title {
        color:${unsafeCSS(Consts.LightColor)};
        font-weight:400;
        height:30%;
        text-align: center;
        display: flex;
        flex-flow: column;
        justify-content: center;
    }
    .scene .title span {
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }
    `;

    protected render() {
        if (this._scene) {
            return this.renderScene();
        }

        return '';
    }

    private renderScene() {
        /*eslint-disable */
        return html`
        <div class='hue-tile scene'>
            <div class='icon-background'>
                <div class='color'>
                    <ha-icon icon="${this._scene.getIcon()}"></ha-icon>
                </div>
            </div>
            <div class='title'>
                <span>${this._scene.getTitle()}</span>
            </div>
        </div>
        `;
        /*eslint-enable */
    }
}