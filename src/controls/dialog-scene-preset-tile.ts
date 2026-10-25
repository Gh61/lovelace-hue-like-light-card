import { PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { nameof } from '../types/extensions';
import { PresetConfig, PresetData, PresetTargets } from '../types/types-hue-preset';
import { PresetActivation } from '../types/types-config';
import { HueDialogSceneTile } from './dialog-scene-tile';

/**
 * Represents Scene Preset (https://github.com/Hypfer/hass-scene_presets) tile element in HueDialog.
 */
@customElement(HueDialogScenePresetTile.ElementName)
export class HueDialogScenePresetTile extends HueDialogSceneTile {
    public static override readonly ElementName = HueDialogSceneTile.ElementName + '-preset';

    private _presetConfig: PresetConfig | null = null;
    @state()
    private _preset: PresetData | null = null;
    private _targets: PresetTargets = {};
    private _tapActivation = PresetActivation.Static;

    /**
     * The preset is running as a dynamic scene on the lights of the card.
     */
    @property({ type: Boolean })
    public dynamic = false;

    public set presetConfig(config: PresetConfig) {
        // only one-time setter (disabling re-render in exchange for performance)
        if (this._presetConfig)
            return;

        const oldPresetConfig = this._presetConfig;

        this._presetConfig = config;
        this._preset = new PresetData(config);
        this.updateHassDependentProps();

        // custom @property() implementation
        this.requestUpdate(nameof(this, 'presetConfig'), oldPresetConfig);
    }

    public set targets(value: PresetTargets) {
        this._targets = value;
    }

    /**
     * Activation on tap, hold uses the other one.
     */
    public set tapActivation(value: PresetActivation) {
        this._tapActivation = value;
    }

    public static override get styles() {
        return HueDialogSceneTile.sceneTileStyles;
    }

    protected override updateHassDependentProps() {
        if (this._hass && this._preset) {
            this._preset.hass = this._hass;
        }
    }

    protected override getEntityId(): string | undefined {
        return undefined;
    }

    protected override getTileTitle(): string | undefined {
        return this._preset?.getTitle();
    }

    protected override getTilePicture(): string | undefined {
        return this._preset?.getPicture();
    }

    protected override getTileIcon(): string | null {
        return 'mdi:palette';
    }

    protected override getTileAccentColor() {
        return this._preset?.getAccentColor() ?? Promise.resolve(undefined);
    }

    protected override activateTile(): void {
        this.activatePreset(this._tapActivation);
    }

    protected override tileHeld(): void {
        const holdActivation = this._tapActivation === PresetActivation.Static
            ? PresetActivation.Dynamic
            : PresetActivation.Static;

        this.activateWithEffect(() => this.activatePreset(holdActivation));
    }

    private async activatePreset(activation: PresetActivation) {
        if (!this._preset)
            return;

        if (activation === PresetActivation.Dynamic) {
            await this._preset.activateDynamic(this._targets);
        }
        else {
            await this._preset.activate(this._targets, false, false);
        }

        // the running dynamic scenes have changed
        this.dispatchEvent(new CustomEvent('preset-activated'));
    }

    protected override isTileDynamic(): boolean {
        return this.dynamic;
    }

    protected override isTileDataChanged(changedProps: PropertyValues): boolean {
        return !!this._preset && changedProps.has('presetConfig');
    }
}
