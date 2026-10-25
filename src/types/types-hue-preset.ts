import { HomeAssistant } from '../ha/types';
import { Color } from '../core/colors/color';
import ColorThief from 'colorthief';

/**
 * Represents XY color coordinates in the CIE color space
 */
export interface LightColor {
    /** X coordinate in CIE color space (0-1) */
    x: number;
    /** Y coordinate in CIE color space (0-1) */
    y: number;
}

/**
 * Represents a category for organizing lighting presets
 */
export interface Category {
    /** Unique identifier for the category (UUID) */
    id: string;
    /** Display name of the category */
    name: string;
}

/**
 * Represents a lighting preset with specific colors and brightness
 */
export interface Preset {
    /** Unique identifier for the preset (UUID) */
    id: string;
    /** Reference to the parent category ID */
    categoryId: string;
    /** Display name of the preset */
    name: string;
    /** Image filename for the preset preview */
    img: string;
    /** Brightness level (0-254) */
    bri: number;
    /** Array of light colors in the preset */
    lights: LightColor[];
}

/**
 * Root structure containing all categories and presets
 */
export interface LightingData {
    /** All available categories */
    categories: Category[];
    /** All available lighting presets */
    presets: Preset[];
}

/**
 * Configuration for applying a preset
 */
export interface PresetConfig {
    /** Preset object from the JSON */
    preset: Preset;
    /** Optional category name for display */
    categoryName?: string;
}

/**
 * Lights the preset is applied to (one of the target kinds)
 */
export interface PresetTargets {
    entity_id?: string | string[];
    area_id?: string;
    floor_id?: string;
    label_id?: string;
}

/**
 * Dynamic scene running in Scene Presets (websocket `scene_presets/get_dynamic_scenes`)
 */
export interface DynamicScene {
    id: string;
    interval: number;
    running: boolean;
    parameters: {
        preset_id: string;
        light_entity_ids: string[];
    };
}

/**
 * Data wrapper for a preset with Home Assistant integration
 */
export class PresetData {
    private _config: PresetConfig;
    private _hass!: HomeAssistant;
    private _pictureColor?: Color;

    public constructor(config: PresetConfig) {
        this._config = config;
    }

    public set hass(value: HomeAssistant) {
        this._hass = value;
    }

    private ensureHass() {
        if (!this._hass)
            throw new Error('Hass not set');
    }

    /**
     * Activate this preset for the given targets
     * @param targets Object containing entity_id, area_id, floor_id, or label_id
     * @param shuffle Whether to shuffle the colors
     * @param smartShuffle Whether to use smart shuffle
     */
    public async activate(targets: PresetTargets, shuffle: boolean = false, smartShuffle: boolean = false) {
        this.ensureHass();

        // a running dynamic scene would overwrite the preset with its next step
        await this._hass.callService('scene_presets', 'stop_dynamic_scenes_for_targets', { targets: targets });

        const data = {
            preset_id: this._config.preset.id,
            targets: targets,
            shuffle: shuffle,
            smart_shuffle: smartShuffle
        };

        await this._hass.callService('scene_presets', 'apply_preset', data);
    }

    /**
     * Start this preset as a dynamic scene (colors keep changing) for the given targets.
     * Scene Presets stops the dynamic scenes already running on the targets.
     * @param targets Object containing entity_id, area_id, floor_id, or label_id
     * @param interval Seconds between the steps (Scene Presets default when not set)
     * @param transition Seconds of the transition of a step (Scene Presets default when not set)
     */
    public async activateDynamic(targets: PresetTargets, interval?: number, transition?: number) {
        this.ensureHass();

        const data = {
            preset_id: this._config.preset.id,
            targets: targets,
            ...(interval != null && { interval: interval }),
            ...(transition != null && { transition: transition })
        };

        await this._hass.callService('scene_presets', 'start_dynamic_scene', data);
    }

    /**
     * @returns Ids of the presets running as a dynamic scene on any of the given lights.
     */
    public static getRunningPresetIds(dynamicScenes: DynamicScene[], lightIds: string[]): string[] {
        return dynamicScenes
            .filter(s => s.running && s.parameters.light_entity_ids.some(id => lightIds.includes(id)))
            .map(s => s.parameters.preset_id);
    }

    /**
     * Get the preset title
     */
    public getTitle(): string {
        return this._config.preset.name;
    }

    /**
     * Get the preset picture URL
     */
    public getPicture(): string | undefined {
        if (this._config.preset.img) {
            return `/assets/scene_presets/${this._config.preset.img}`;
        }
        return undefined;
    }

    /**
     * Get the accent color from the first light color in the preset
     */
    public async getAccentColor(): Promise<Color | undefined> {
        this.ensureHass();
        
        return new Promise((resolve) => {
            
            if (this._pictureColor) {
                return resolve(this._pictureColor);
            }

            const picture = this.getPicture();
            if (picture) {
                const img = new Image();
                img.crossOrigin = '';
                img.src = picture;
                img.onload = () => {
                    const ct = new ColorThief();
                    const mainColor = ct.getColor(img);
                    this._pictureColor = new Color(mainColor[0], mainColor[1], mainColor[2]);

                    resolve(this._pictureColor);
                };
            }
            else {
                return resolve(undefined);
            }
        });
    }

    /**
     * Get the category name
     */
    public getCategoryName(): string | undefined {
        return this._config.categoryName;
    }
}
