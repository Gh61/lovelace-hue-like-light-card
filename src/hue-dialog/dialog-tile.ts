import { HomeAssistant } from 'custom-card-helpers';
import { html, css, LitElement, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { HueEffectQueue } from '../core/effect-queue';
import { Consts } from '../types/consts';
import { nameof } from '../types/extensions';
import { SceneConfig, SceneData } from '../types/types';

/**
 * Represents tile element in HueDialog (it can be Scene tile, Light tile, ...)
 */
@customElement(HueDialogTile.ElementName)
export class HueDialogTile extends LitElement {

    public static readonly ElementName = Consts.CardElementName + '-hue-dialog-tile';

    private readonly _effectQueue = new HueEffectQueue();
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

    private tileClicked() {
        // set scene
        this._hass.callService('scene', 'turn_on', { entity_id: this._sceneConfig.entity });

        // stops the animation and clears the queue
        this._effectQueue.stopAndClear();

        // TODO: move selected class to scene - add changin of text and icon color
        const colorElement = this.renderRoot.querySelector('.color');
        if (colorElement) {
            colorElement.classList.remove('selected', 'unselected');
            const animationMs = (HueDialogTile.animationSeconds * 1000);
            this._effectQueue.addEffect(0, () => colorElement.classList.add('selected'));
            this._effectQueue.addEffect(3000, () => colorElement.classList.add('unselected'));
            this._effectQueue.addEffect(animationMs, () => { colorElement.classList.add('no-animate'); colorElement.classList.remove('selected'); });
            this._effectQueue.addEffect(50, () => { colorElement.classList.remove('no-animate', 'unselected'); });
            this._effectQueue.start();
        }
    }

    private static readonly padding = 5; // px
    private static readonly height = 100; // px
    private static readonly width = 85; // px
    private static readonly colorDimensions = HueDialogTile.height / 2; // px
    private static readonly iconScale = (HueDialogTile.colorDimensions * 0.75) / 24; // 24 = default icon size
    private static readonly animationSeconds = 1.0;

    static styles = css`
    .hue-tile{
        background: ${unsafeCSS(Consts.OffColor)};
        width: ${HueDialogTile.width}px;
        height: ${HueDialogTile.height}px;
        padding: ${HueDialogTile.padding}px;
        border-radius: ${Consts.HueBorderRadius}px;
        box-shadow: ${unsafeCSS(Consts.HueShadow)};
        overflow:hidden;
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
        background: cyan; /* TODO: */
        height: ${HueDialogTile.colorDimensions}px;
        width: ${HueDialogTile.colorDimensions}px;
        border-radius: ${HueDialogTile.colorDimensions / 2}px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all ${HueDialogTile.animationSeconds}s linear;
    }
    .scene .icon-background .color ha-icon {
        color:${unsafeCSS(Consts.LightColor)}; /* TODO: dark color */
        transform: scale(${HueDialogTile.iconScale});
    }
    .scene .icon-background .color.selected {
        height: ${HueDialogTile.height * 2}px;
        width: ${HueDialogTile.width * 2}px;
        border-radius: ${HueDialogTile.height}px;
        margin-left: -${HueDialogTile.padding * 2}px;
        margin-right: -${HueDialogTile.padding * 2}px;
    }
    .scene .icon-background .color.selected ha-icon{
        animation: pop-icon 0.5s linear 1;
    }
    .scene .icon-background .color.unselected {
        background: transparent;
    }
    .scene .icon-background .color.no-animate {
        transition: none;
    }

    .scene .title {
        color:${unsafeCSS(Consts.LightColor)};
        font-size: 12px;
        line-height: 15px;
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

    @keyframes pop-icon{
        50% { transform: scale(${HueDialogTile.iconScale * 2}); }
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
        <div class='hue-tile scene' title='${this._scene.getTitle()}' @click="${this.tileClicked}">
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