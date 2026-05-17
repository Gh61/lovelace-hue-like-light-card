import { PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { nameof } from '../types/extensions';
import { PresetConfig, PresetData } from '../types/types-hue-preset';
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
        return this._preset?.getAccentColor() ?? Promise.resolve(null);
    }

    protected override activateTile(): void {
        this._preset?.activate(this._targets, false, false);
    }

    protected override isTileDataChanged(changedProps: PropertyValues): boolean {
        return !!this._preset && changedProps.has('presetConfig');
    }
}
