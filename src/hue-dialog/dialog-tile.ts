import { HomeAssistant } from 'custom-card-helpers';
import { html, css, LitElement, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
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

    @property() public cardTitle:string;

    set hass(hass:HomeAssistant) {
        const oldHass = this._hass;

        this._hass = hass;
        this.updateHassDependentProps();

        // custom @property() implementation
        this.requestUpdate(nameof(this, 'hass'), oldHass);
    }

    set sceneConfig(config:SceneConfig) {
        const oldSceneConfig = this._sceneConfig;

        this._sceneConfig = config;
        this._scene = new SceneData(config);
        this.updateHassDependentProps();

        // custom @property() implementation
        this.requestUpdate(nameof(this, 'sceneConfig'), oldSceneConfig);
    }

    private updateHassDependentProps() {
        if (this._hass && this._scene) {
            this._scene.hass = this._hass;
        }
    }

    private sceneClicked() {
        // activate scene
        this._scene.activate();

        // stops the animation and clears the queue
        this._effectQueue.stopAndClear();

        // find tile and start animation
        const sceneElement = this.renderRoot.querySelector('.scene');
        if (sceneElement) {
            sceneElement.classList.remove('selected', 'unselected');
            const animationMs = (HueDialogTile.animationSeconds * 1000);
            this._effectQueue.addEffect(0, () => sceneElement.classList.add('selected'));
            this._effectQueue.addEffect(3000, () => sceneElement.classList.add('unselected'));
            this._effectQueue.addEffect(animationMs, () => { sceneElement.classList.add('stop-color-animate'); sceneElement.classList.remove('selected'); });
            this._effectQueue.addEffect(50, () => { sceneElement.classList.remove('stop-color-animate', 'unselected'); });
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
        background: var(--hue-tile-accent-color, lightslategray);
        height: ${HueDialogTile.colorDimensions}px;
        width: ${HueDialogTile.colorDimensions}px;
        border-radius: ${HueDialogTile.colorDimensions / 2}px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all ${HueDialogTile.animationSeconds}s linear;
    }
    .scene .icon-background .color ha-icon {
        color: var(--hue-tile-fg-color, ${unsafeCSS(Consts.LightColor)});
        transform: scale(${HueDialogTile.iconScale});
    }
    .scene.selected .icon-background .color {
        height: ${HueDialogTile.height * 2}px;
        width: ${HueDialogTile.width * 2}px;
        border-radius: ${HueDialogTile.height}px;
        margin-left: -${HueDialogTile.padding * 2}px;
        margin-right: -${HueDialogTile.padding * 2}px;
    }
    .scene.selected .icon-background .color ha-icon{
        animation: pop-icon 0.5s linear 1;
    }
    .scene.unselected .icon-background .color {
        background: transparent;
    }
    .scene.stop-color-animate .icon-background .color {
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
        transition: all ${HueDialogTile.animationSeconds / 2}s linear;
    }
    .scene .title span {
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }
    .scene.selected .title {
        color:var(--hue-tile-fg-text-color, ${unsafeCSS(Consts.LightColor)});
    }

    @keyframes pop-icon{
        50% { transform: scale(${HueDialogTile.iconScale * 2}); }
    }
    `;

    private _sceneAccentColorSet:boolean;
    protected updated() {
        if (this._scene && !this._sceneAccentColorSet) {
            this._sceneAccentColorSet = true;
            const accentColor = this._scene.getColor();
            if (accentColor) {
                const fg = accentColor.getForeground(Consts.LightColor, Consts.DarkColor, 20); // offset:20 - lets make the text color light sooner
                const textFg = accentColor.getForeground(Consts.LightColor, 'black', 20); // offset:20 - lets make the text color light sooner

                this.style.setProperty(
                    '--hue-tile-accent-color',
                    accentColor.toString()
                );
                this.style.setProperty(
                    '--hue-tile-fg-color',
                    fg.toString()
                );
                this.style.setProperty(
                    '--hue-tile-fg-text-color',
                    textFg.toString()
                );
            }
        }
    }

    protected render() {
        if (this._scene) {
            return this.renderScene();
        }

        return '';
    }

    private renderScene() {
        const title = this._scene.getTitle(this.cardTitle);

        /*eslint-disable */
        return html`
        <div class='hue-tile scene' title='${title}' @click="${this.sceneClicked}">
            <div class='icon-background'>
                <div class='color'>
                    <ha-icon icon="${this._scene.getIcon('mdi:palette')}"></ha-icon>
                </div>
            </div>
            <div class='title'>
                <span>${title}</span>
            </div>
        </div>
        `;
        /*eslint-enable */
    }
}