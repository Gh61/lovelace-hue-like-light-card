import { forwardHaptic } from 'custom-card-helpers';
import { html, css, nothing, unsafeCSS, PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { Color } from '../core/colors/color';
import { HueEffectQueue } from '../core/effect-queue';
import { Consts } from '../types/consts';
import { nameof } from '../types/extensions';
import { PresetConfig, PresetData } from '../types/types-hue-preset';
import { HueDialogTile, ITileEventDetail } from './dialog-tile';

/**
 * Represents Hue Preset tile element in HueDialog.
 */
@customElement(HueDialogPresetTile.ElementName)
export class HueDialogPresetTile extends HueDialogTile {

    public static override readonly ElementName = HueDialogTile.ElementName + '-preset';

    private readonly _effectQueue = new HueEffectQueue();
    private _presetConfig: PresetConfig | null = null;
    @state()
    private _preset: PresetData | null = null;

    // Store targets for activation (entity_id, area_id, floor_id, label_id)
    private _targets: { entity_id?: string | string[], area_id?: string, floor_id?: string, label_id?: string } = {};

    public set presetConfig(config: PresetConfig) {
        const oldPresetConfig = this._presetConfig;

        this._presetConfig = config;
        this._preset = new PresetData(config);
        this.updateHassDependentProps();

        // custom @property() implementation
        this.requestUpdate(nameof(this, 'presetConfig'), oldPresetConfig);
    }

    public set targets(value: { entity_id?: string | string[], area_id?: string, floor_id?: string, label_id?: string }) {
        this._targets = value;
    }

    protected override updateHassDependentProps() {
        if (this._hass && this._preset) {
            this._preset.hass = this._hass;
        }
    }

    protected override tileClicked() {
        if (!this._preset)
            return;

        // vibrate a little
        forwardHaptic('light');

        // activate preset
        this._preset.activate(this._targets, false, false);

        // stops the animation and clears the queue
        this._effectQueue.stopAndClear();

        // find tile and start animation
        const presetElement = this.renderRoot.querySelector('.preset');
        if (presetElement) {
            presetElement.classList.remove('clicked', 'unclicked');
            const animationMs = (HueDialogPresetTile.animationSeconds * 1000);
            this._effectQueue.addEffect(0, () => presetElement.classList.add('clicked'));
            this._effectQueue.addEffect(3000, () => presetElement.classList.add('unclicked'));
            this._effectQueue.addEffect(animationMs, () => {
                presetElement.classList.add('stop-color-animate');
                presetElement.classList.remove('clicked');
            });
            this._effectQueue.addEffect(50, () => {
                presetElement.classList.remove('stop-color-animate', 'unclicked');
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

    private static readonly pictureDimensions = HueDialogTile.height / 2; // px
    public static readonly iconScale = (HueDialogPresetTile.pictureDimensions * 0.75) / 24; // 24 = default icon size
    private static readonly animationSeconds = 1.0;

    public static override get styles() {
        return [
            HueDialogTile.hueDialogStyle,
            css`
    .preset {
        cursor: pointer;
    }
    .preset .icon-background {
        height: calc(100% - ${HueDialogTile.titleHeight}px);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .preset .icon-background .color,
    .preset .icon-background .picture-color {
        height: ${HueDialogPresetTile.pictureDimensions}px;
        width: ${HueDialogPresetTile.pictureDimensions}px;
        border-radius: ${HueDialogPresetTile.pictureDimensions / 2}px;
        box-shadow: ${unsafeCSS(Consts.HueShadow)}, inset rgba(0,0,0,0.1) -8px -8px 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all ${HueDialogPresetTile.animationSeconds}s linear;
    }
    .preset .icon-background .color {
        background: var(--hue-tile-accent-color, darkgoldenrod);
    }
    .preset .icon-background .color ha-icon {
        color: var(--hue-tile-fg-color, ${unsafeCSS(Consts.LightColor)});
        transform: scale(${HueDialogPresetTile.iconScale});
    }
    .preset .icon-background .picture-color .picture {
        display: inline-block;
        height: ${HueDialogPresetTile.pictureDimensions}px;
        width: ${HueDialogPresetTile.pictureDimensions}px;
        border-radius: ${HueDialogPresetTile.pictureDimensions / 2}px;
        background-position: center;
        background-size: cover;
    }

    .preset.clicked .icon-background .picture-color {
        background: var(--hue-tile-accent-color, darkgoldenrod);
    }
    .preset.clicked .icon-background .color,
    .preset.clicked .icon-background .picture-color {
        height: ${HueDialogTile.height * 2}px;
        width: ${HueDialogTile.width * 2}px;
        border-radius: ${HueDialogTile.height}px;
        margin-left: -${HueDialogTile.padding * 2}px;
        margin-right: -${HueDialogTile.padding * 2}px;
    }
    .preset.clicked .icon-background .color ha-icon {
        animation: pop-icon 0.5s linear 1;
    }
    .preset.clicked .icon-background .picture {
        animation: pop-picture 0.5s linear 1;
    }

    .preset.unclicked .icon-background .color,
    .preset.unclicked .icon-background .picture-color {
        background: transparent;
    }
    .preset.stop-color-animate .icon-background .color,
    .preset.stop-color-animate .icon-background .picture-color {
        transition: none;
    }

    .preset .title {
        transition: all ${HueDialogPresetTile.animationSeconds / 2}s linear;
    }
    .preset.clicked .title {
        color:var(--hue-tile-fg-text-color, ${unsafeCSS(Consts.LightColor)});
    }

    @keyframes pop-icon {
        50% { transform: scale(${HueDialogPresetTile.iconScale * 2}); }
    }
    @keyframes pop-picture {
        50% { transform: scale(1.5); }
    }
    `];
    }

    protected override getEntityId(): string | undefined {
        // Presets don't have a specific entity, return undefined
        return undefined;
    }

    protected override updated(changedProps: PropertyValues<HueDialogPresetTile>) {
        if (this._preset && changedProps.has('presetConfig')) {
            // set accent color
            this._preset.getAccentColor().then(accentColor => {
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
            });
        }
    }

    protected override render() {
        if (!this._preset)
            return nothing;

        const title = this._preset.getTitle();
        const picture = this._preset.getPicture();

        /*eslint-disable */
        return html`
        <div class='hue-tile preset' title='${title}'>
            <div class='icon-background'>
                ${picture
                ? html`
                    <div class='picture-color'>
                        <div class='picture' style='background-image:url("${picture}")'></div>
                    </div>`
                : html`
                    <div class='color'>
                        <ha-icon icon="mdi:palette"></ha-icon>
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
}

