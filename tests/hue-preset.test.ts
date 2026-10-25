import { HomeAssistant } from '../src/ha/types';
import { DynamicScene, PresetData } from '../src/types/types-hue-preset';

function createPreset() {
    const callService = jest.fn(() => Promise.resolve());
    const preset = new PresetData({
        preset: { id: 'preset-id', categoryId: 'category-id', name: 'Galaxy', img: 'galaxy.jpg', bri: 200, lights: [] }
    });
    preset.hass = { callService } as unknown as HomeAssistant;
    return { preset, callService };
}

describe('PresetData', () => {
    it('should stop dynamic scenes of the targets before applying the preset', async () => {
        const { preset, callService } = createPreset();

        await preset.activate({ area_id: 'living_room' });

        expect(callService.mock.calls).toStrictEqual([
            ['scene_presets', 'stop_dynamic_scenes_for_targets', { targets: { area_id: 'living_room' } }],
            ['scene_presets', 'apply_preset', { preset_id: 'preset-id', targets: { area_id: 'living_room' }, shuffle: false, smart_shuffle: false }]
        ]);
    });

    it('should start the preset as a dynamic scene', () => {
        const { preset, callService } = createPreset();

        preset.activateDynamic({ entity_id: ['light.a', 'light.b'] });

        expect(callService.mock.calls).toStrictEqual([
            ['scene_presets', 'start_dynamic_scene', { preset_id: 'preset-id', targets: { entity_id: ['light.a', 'light.b'] } }]
        ]);
    });

    it('should return presets running as a dynamic scene on the given lights', () => {
        const scene = (presetId: string, lights: string[], running = true): DynamicScene => ({
            id: presetId + '-scene',
            interval: 60,
            running: running,
            parameters: { preset_id: presetId, light_entity_ids: lights }
        });
        const dynamicScenes = [
            scene('living-room', ['light.a', 'light.b']),
            scene('bedroom', ['light.c']),
            scene('stopped', ['light.a'], false)
        ];

        expect(PresetData.getRunningPresetIds(dynamicScenes, ['light.b'])).toStrictEqual(['living-room']);
        expect(PresetData.getRunningPresetIds(dynamicScenes, ['light.d'])).toStrictEqual([]);
    });
});
