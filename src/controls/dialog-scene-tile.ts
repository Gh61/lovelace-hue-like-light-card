import { forwardHaptic } from 'custom-card-helpers';
import { css, html, nothing, PropertyValues, unsafeCSS } from 'lit';
import { Color } from '../core/colors/color';
import { HueEffectQueue } from '../core/effect-queue';
import { Consts } from '../types/consts';
import { HueDialogTile, ITileEventDetail } from './dialog-tile';

/**
 * Shared implementation for scene tiles in HueDialog. Base Class
 */
export abstract class HueDialogSceneTile extends HueDialogTile {
    public static override readonly ElementName = HueDialogTile.ElementName + '-scene';

    private readonly _effectQueue = new HueEffectQueue();

    private static readonly pictureDimensions = HueDialogTile.height / 2; // px
    public static readonly iconScale = (HueDialogSceneTile.pictureDimensions * 0.75) / 24; // 24 = default icon size
    private static readonly animationSeconds = 1.0;

    protected abstract getTileTitle(): string | undefined;
    protected abstract getTilePicture(): string | undefined;
    protected abstract getTileIcon(): string | null;
    protected abstract getTileAccentColor(): Promise<Color | null | undefined>;
    protected abstract activateTile(): void;
    protected abstract isTileDataChanged(changedProps: PropertyValues): boolean;

    protected override tileClicked() {
        if (this.getTileTitle() == null) {
            return;
        }

        // vibrate a little
        forwardHaptic('light');

        // activate scene
        this.activateTile();

        // stops the animation and clears the queue
        this._effectQueue.stopAndClear();

         // find tile and start animation
        const tileElement = this.renderRoot.querySelector('.scene');
        if (tileElement) {
            tileElement.classList.remove('clicked', 'unclicked');
            const animationMs = HueDialogSceneTile.animationSeconds * 1000;
            this._effectQueue.addEffect(0, () => tileElement.classList.add('clicked'));
            this._effectQueue.addEffect(3000, () => tileElement.classList.add('unclicked'));
            this._effectQueue.addEffect(animationMs, () => {
                tileElement.classList.add('stop-color-animate');
                tileElement.classList.remove('clicked');
            });
            this._effectQueue.addEffect(50, () => {
                tileElement.classList.remove('stop-color-animate', 'unclicked');
            });
            this._effectQueue.start();
        }

        // fire event on change
        this.dispatchEvent(new CustomEvent<ITileEventDetail>('activated', {
            detail: {
                tileElement: this
            }
        }));
    }

    protected override updated(changedProps: PropertyValues) {
        if (this.isTileDataChanged(changedProps)) {
            this.getTileAccentColor().then(accentColor => {
                if (!accentColor) {
                    return;
                }

                const fg = accentColor.getForeground(Consts.LightColor, Consts.DarkColor, 20);
                const textFg = accentColor.getForeground(Consts.LightColor, new Color('black'), 20);

                this.style.setProperty('--hue-tile-accent-color', accentColor.toString());
                this.style.setProperty('--hue-tile-fg-color', fg.toString());
                this.style.setProperty('--hue-tile-fg-text-color', textFg.toString());
            });
        }
    }

    protected override render() {
        const title = this.getTileTitle();
        if (title == null) {
            return nothing;
        }

        const picture = this.getTilePicture();

        /*eslint-disable */
        return html`
        <div class='hue-tile scene' title='${title}'>
            <div class='icon-background'>
                ${picture
                ? html`
                    <div class='picture-color'>
                        <div class='picture' style='background-image:url("${picture}")'></div>
                    </div>`
                : html`
                    <div class='color'>
                        <ha-icon icon="${this.getTileIcon() || 'mdi:palette'}"></ha-icon>
                    </div>`
            }
            </div>
            <div class='title'>
                <span>${title}</span>
            </div>
        </div>
        `;
        /*eslint-enable */
    }

    public static get sceneTileStyles() {
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
    .scene .icon-background .color,
    .scene .icon-background .picture-color {
        height: ${HueDialogSceneTile.pictureDimensions}px;
        width: ${HueDialogSceneTile.pictureDimensions}px;
        border-radius: ${HueDialogSceneTile.pictureDimensions / 2}px;
        box-shadow: ${unsafeCSS(Consts.HueShadow)}, inset rgba(0,0,0,0.1) -8px -8px 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all ${HueDialogSceneTile.animationSeconds}s linear;
    }
    .scene .icon-background .color {
        background: var(--hue-tile-accent-color, darkgoldenrod);
    }
    .scene .icon-background .color ha-icon {
        color: var(--hue-tile-fg-color, ${unsafeCSS(Consts.LightColor)});
        transform: scale(${HueDialogSceneTile.iconScale});
    }
    .scene .icon-background .picture-color .picture {
        display: inline-block;
        height: ${HueDialogSceneTile.pictureDimensions}px;
        width: ${HueDialogSceneTile.pictureDimensions}px;
        border-radius: ${HueDialogSceneTile.pictureDimensions / 2}px;
        background-position: center;
        background-size: cover;
    }

    .scene.clicked .icon-background .picture-color {
        background: var(--hue-tile-accent-color, darkgoldenrod);
    }
    .scene.clicked .icon-background .color,
    .scene.clicked .icon-background .picture-color {
        height: ${HueDialogTile.height * 2}px;
        width: ${HueDialogTile.width * 2}px;
        border-radius: ${HueDialogTile.height}px;
        margin-left: -${HueDialogTile.padding * 2}px;
        margin-right: -${HueDialogTile.padding * 2}px;
    }
    .scene.clicked .icon-background .color ha-icon {
        animation: pop-icon 0.5s linear 1;
    }
    .scene.clicked .icon-background .picture {
        animation: pop-picture 0.5s linear 1;
    }

    .scene.unclicked .icon-background .color,
    .scene.unclicked .icon-background .picture-color {
        background: transparent;
    }
    .scene.stop-color-animate .icon-background .color,
    .scene.stop-color-animate .icon-background .picture-color {
        transition: none;
    }

    .scene .title {
        transition: all ${HueDialogSceneTile.animationSeconds / 2}s linear;
    }
    .scene.clicked .title {
        color:var(--hue-tile-fg-text-color, ${unsafeCSS(Consts.LightColor)});
    }

    @keyframes pop-icon {
        50% { transform: scale(${HueDialogSceneTile.iconScale * 2}); }
    }
    @keyframes pop-picture {
        50% { transform: scale(1.5); }
    }
    `];
    }
}
