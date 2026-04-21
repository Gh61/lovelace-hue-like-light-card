import { PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { nameof } from '../types/extensions';
import { SceneConfig, SceneData } from '../types/types-config';
import { HueDialogSceneTile } from './dialog-scene-tile';

/**
 * Represents Scene tile element in HueDialog.
 */
@customElement(HueDialogSceneHATile.ElementName)
export class HueDialogSceneHATile extends HueDialogSceneTile {

    public static override readonly ElementName = HueDialogSceneTile.ElementName + '-ha';
    private _sceneConfig: SceneConfig | null = null;
    @state()
    private _scene: SceneData | null = null;

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

    public static override get styles() {
        return HueDialogSceneTile.sceneTileStyles;
    }

    protected override getEntityId(): string | undefined {
        return this._sceneConfig?.entity;
    }

    protected override getTileTitle(): string | undefined {
        return this._scene?.getTitle(this.cardTitle);
    }

    protected override getTilePicture(): string | undefined {
        return this._scene?.getPicture();
    }

    protected override getTileIcon(): string | null {
        return this._scene?.getIcon('mdi:palette') || 'mdi:palette';
    }

    protected override getTileAccentColor() {
        return this._scene?.getAccentColor() ?? Promise.resolve(undefined);
    }

    protected override activateTile(): void {
        this._scene?.activate();
    }

    protected override isTileDataChanged(changedProps: PropertyValues): boolean {
        return !!this._scene && changedProps.has('sceneConfig');
    }
}
