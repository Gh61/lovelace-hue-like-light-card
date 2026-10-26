import { forwardHaptic } from '../ha/data/haptics';
import { css, html, nothing, PropertyValues, unsafeCSS } from 'lit';
import { Color } from '../core/colors/color';
import { HueEffectQueue } from '../core/effect-queue';
import { Consts } from '../types/consts';
import { HueDialogTile, ITileEventDetail } from './dialog-tile';
import { actionHandler } from '../ha/panels/lovelace/common/directives/action-handler-directive';

/**
 * Shared implementation for scene tiles in HueDialog. Base Class
 */
export abstract class HueDialogSceneTile extends HueDialogTile {
    public static override readonly ElementName = HueDialogTile.ElementName + '-scene';

    private readonly _effectQueue = new HueEffectQueue();

    private static readonly pictureDimensions = HueDialogTile.height / 2; // px
    public static readonly iconScale = (HueDialogSceneTile.pictureDimensions * 0.75) / 24; // 24 = default icon size
    private static readonly clickedScale = (HueDialogTile.height * 2) / HueDialogSceneTile.pictureDimensions; // the clicked circle covers the tile
    private static readonly animationSeconds = 1.0;

    protected abstract getTileTitle(): string | undefined;
    protected abstract getTilePicture(): string | undefined;
    protected abstract getTileIcon(): string | null;
    protected abstract getTileAccentColor(): Promise<Color | undefined>;
    protected abstract activateTile(): void;
    protected abstract isTileDataChanged(changedProps: PropertyValues): boolean;

    protected override tileClicked() {
        if (this.getTileTitle() == null) {
            return;
        }

        // vibrate a little
        forwardHaptic(this, 'light');

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

        /* eslint-disable @/indent */
        return html`
        <div class='hue-tile scene' title='${title}' .actionHandler=${actionHandler(this.actionHandlerConfig)}>
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
        /* eslint-enable @/indent */
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
        display: flex;
        align-items: center;
        justify-content: center;
        /* the ::before (circle under the icon / picture) stays under the content */
        position: relative;
        isolation: isolate;
    }
    /* The circle grows over the tile on click by transform and fades out by opacity - both run on the compositor.
       Growing its size (width / height / margin) relaid and repainted the tile with its shadows in every frame. */
    .scene .icon-background .color::before,
    .scene .icon-background .picture-color::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: 50%;
        box-shadow: ${unsafeCSS(Consts.HueShadow)}, inset rgba(0,0,0,0.1) -8px -8px 15px;
        transition: transform ${HueDialogSceneTile.animationSeconds}s linear, opacity ${HueDialogSceneTile.animationSeconds}s linear,
            background-color ${HueDialogSceneTile.animationSeconds}s linear;
    }
    .scene .icon-background .color::before {
        background-color: var(--hue-tile-accent-color, darkgoldenrod);
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

    .scene.clicked .icon-background .picture-color::before {
        background-color: var(--hue-tile-accent-color, darkgoldenrod);
    }
    .scene.clicked .icon-background .color::before,
    .scene.clicked .icon-background .picture-color::before {
        /* covers the whole tile (it clips the rest) */
        transform: scale(${HueDialogSceneTile.clickedScale});
    }
    .scene.clicked .icon-background .color ha-icon {
        animation: pop-icon 0.5s linear 1;
    }
    .scene.clicked .icon-background .picture {
        animation: pop-picture 0.5s linear 1;
    }

    .scene.unclicked .icon-background .color::before,
    .scene.unclicked .icon-background .picture-color::before {
        opacity: 0;
    }
    .scene.stop-color-animate .icon-background .color::before,
    .scene.stop-color-animate .icon-background .picture-color::before {
        transition: none;
    }

    .scene .title {
        /* positioned after the circle, so it is painted over the clicked circle */
        position: relative;
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
