import { HueLikeLightCardConfig } from '../src/types/config';
import { SceneProvider } from '../src/types/types-config';

const presetsJson = {
    categories: [{ id: 'c1', name: 'Hue' }],
    presets: [
        { id: 'p1', categoryId: 'c1', name: 'Savanna sunset', img: 'p1.png', bri: 200, lights: [{ x: 0.5, y: 0.4 }] },
        { id: 'p2', categoryId: 'c1', name: 'Arctic aurora', img: 'p2.png', bri: 150, lights: [{ x: 0.2, y: 0.3 }] }
    ]
};

/** Mocks fetch and clears the presets shared by the configs (each test loads them again). */
function mockPresetsFetch(response: { ok: boolean, json?: unknown }) {
    const fetchMock = jest.fn(() => Promise.resolve({ ok: response.ok, json: () => Promise.resolve(response.json) }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    (HueLikeLightCardConfig as unknown as { _sharedPresets: unknown })._sharedPresets = null;
    return fetchMock;
}

describe('Config presets', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('should load the presets also for a config that needs no init', async () => {
        mockPresetsFetch({ ok: true, json: presetsJson });
        const config = new HueLikeLightCardConfig({
            entities: ['light.a', 'light.b'],
            scenes: ['scene.one'],
            sceneProvider: [SceneProvider.HaScenes, SceneProvider.ScenePresets]
        });
        expect(config.isInitialized).toBe(true);

        await config.presetsLoaded;

        expect(config.presets.map(p => p.preset.name)).toStrictEqual(['Savanna sunset', 'Arctic aurora']);
        expect(config.presets[0].categoryName).toBe('Hue');
    });

    it('should load the JSON once for all configs', async () => {
        const fetchMock = mockPresetsFetch({ ok: true, json: presetsJson });
        const plain = { area: 'living_room', sceneProvider: [SceneProvider.ScenePresets] };

        const first = new HueLikeLightCardConfig(plain);
        await first.presetsLoaded;
        // a card created again by HA gets a new config
        const second = new HueLikeLightCardConfig(plain);
        await second.presetsLoaded;

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(second.presets).toHaveLength(2);
    });

    it('should not load anything without the Scene Presets provider', async () => {
        const fetchMock = mockPresetsFetch({ ok: true, json: presetsJson });
        const config = new HueLikeLightCardConfig({ entity: 'light.a' });

        await config.presetsLoaded;

        expect(fetchMock).not.toHaveBeenCalled();
        expect(config.presets).toHaveLength(0);
    });

    it('should have no presets when the addon is not installed', async () => {
        mockPresetsFetch({ ok: false });
        const config = new HueLikeLightCardConfig({ entity: 'light.a', sceneProvider: [SceneProvider.ScenePresets] });

        await config.presetsLoaded;

        expect(config.presets).toHaveLength(0);
    });
});
