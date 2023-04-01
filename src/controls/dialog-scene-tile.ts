import { forwardHaptic } from 'custom-card-helpers';
import { html, css, unsafeCSS, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Color } from '../core/colors/color';
import { HueEffectQueue } from '../core/effect-queue';
import { Consts } from '../types/consts';
import { nameof } from '../types/extensions';
import { SceneConfig, SceneData } from '../types/types-config';
import { HueDialogTile } from './dialog-tile';

/**
 * Represents Scene tile element in HueDialog.
 */
@customElement(HueDialogSceneTile.ElementName)
export class HueDialogSceneTile extends HueDialogTile {

    public static override readonly ElementName = HueDialogTile.ElementName + '-scene';

    private readonly _effectQueue = new HueEffectQueue();
    private _sceneConfig: SceneConfig | null = null;
    @property() private _scene: SceneData | null = null;

    public set sceneConfig(config: SceneConfig) {
        const oldSceneConfig = this._sceneConfig;

        this._sceneConfig = config;
        this._scene = new SceneData(config);
        this.updateHassDependentProps();

        // custom @property() implementation
        this.requestUpdate(nameof(this, 'sceneConfig'), oldSceneConfig);
    }

    protected override updateHassDependentProps() {
        if (this._hass && this._scene) {
            this._scene.hass = this._hass;
        }
    }

    private sceneClicked() {
        if (!this._scene)
            return;

        // vibrate a little
        forwardHaptic('light');

        // activate scene
        this._scene.activate();

        // stops the animation and clears the queue
        this._effectQueue.stopAndClear();

        // find tile and start animation
        const sceneElement = this.renderRoot.querySelector('.scene');
        if (sceneElement) {
            sceneElement.classList.remove('clicked', 'unclicked');
            const animationMs = (HueDialogSceneTile.animationSeconds * 1000);
            this._effectQueue.addEffect(0, () => sceneElement.classList.add('clicked'));
            this._effectQueue.addEffect(3000, () => sceneElement.classList.add('unclicked'));
            this._effectQueue.addEffect(animationMs, () => { sceneElement.classList.add('stop-color-animate'); sceneElement.classList.remove('clicked'); });
            this._effectQueue.addEffect(50, () => { sceneElement.classList.remove('stop-color-animate', 'unclicked'); });
            this._effectQueue.start();
        }
    }

    private static readonly colorDimensions = HueDialogTile.height / 2; // px
    public static readonly iconScale = (HueDialogSceneTile.colorDimensions * 0.75) / 24; // 24 = default icon size
    private static readonly animationSeconds = 1.0;

    public static override get styles() {
        return [
            HueDialogTile.hueDialogStyle,
            css`
    .scene {
        cursor: pointer;
    }
    .scene .icon-background {
        height: calc(100% - ${HueDialogTile.titleHeight}px);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .scene .icon-background .color {
        background: var(--hue-tile-accent-color, darkgoldenrod);
        height: ${HueDialogSceneTile.colorDimensions}px;
        width: ${HueDialogSceneTile.colorDimensions}px;
        border-radius: ${HueDialogSceneTile.colorDimensions / 2}px;
        box-shadow: ${unsafeCSS(Consts.HueShadow)}, inset rgba(0,0,0,0.1) -8px -8px 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all ${HueDialogSceneTile.animationSeconds}s linear;
    }
    .scene .icon-background .color ha-icon {
        color: var(--hue-tile-fg-color, ${unsafeCSS(Consts.LightColor)});
        transform: scale(${HueDialogSceneTile.iconScale});
    }
    .scene.clicked .icon-background .color {
        height: ${HueDialogTile.height * 2}px;
        width: ${HueDialogTile.width * 2}px;
        border-radius: ${HueDialogTile.height}px;
        margin-left: -${HueDialogTile.padding * 2}px;
        margin-right: -${HueDialogTile.padding * 2}px;
    }
    .scene.clicked .icon-background .color ha-icon{
        animation: pop-icon 0.5s linear 1;
    }
    .scene.unclicked .icon-background .color {
        background: transparent;
    }
    .scene.stop-color-animate .icon-background .color {
        transition: none;
    }

    .scene .title {
        transition: all ${HueDialogSceneTile.animationSeconds / 2}s linear;
    }
    .scene.clicked .title {
        color:var(--hue-tile-fg-text-color, ${unsafeCSS(Consts.LightColor)});
    }

    @keyframes pop-icon{
        50% { transform: scale(${HueDialogSceneTile.iconScale * 2}); }
    }
    `];
    }

    protected override updated(changedProps: PropertyValues) {
        if (this._scene && changedProps.has(nameof(this, 'sceneConfig'))) {
            const accentColor = this._scene.getColor();
            if (accentColor) {
                const fg = accentColor.getForeground(Consts.LightColor, Consts.DarkColor, 20); // offset:20 - lets make the text color light sooner
                const textFg = accentColor.getForeground(Consts.LightColor, new Color('black'), 20); // offset:20 - lets make the text color light sooner

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

    protected override render() {
        if (!this._scene)
            return html``;

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