import { HomeAssistant } from 'custom-card-helpers';
import { Color } from '../core/colors/color';

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
 * Data wrapper for a preset with Home Assistant integration
 */
export class PresetData {
    private _config: PresetConfig;
    private _hass!: HomeAssistant;

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
    public activate(targets: { entity_id?: string | string[], area_id?: string, floor_id?: string, label_id?: string }, shuffle: boolean = false, smartShuffle: boolean = false) {
        this.ensureHass();

        const data = {
            preset_id: this._config.preset.id,
            targets: targets,
            shuffle: shuffle,
            smart_shuffle: smartShuffle
        };

        this._hass.callService('scene_presets', 'apply_preset', data);
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
        if (this._config.preset.lights && this._config.preset.lights.length > 0) {
            const firstLight = this._config.preset.lights[0];
            return new Color(firstLight.x, firstLight.y, this._config.preset.bri, 1, 'xy');
        }
        return undefined;
    }

    /**
     * Get the category name
     */
    public getCategoryName(): string | undefined {
        return this._config.categoryName;
    }
}
