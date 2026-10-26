import { HueLikeLightCardConfig } from '../src/types/config';
import { Consts } from '../src/types/consts';
import { HueLikeLightCardConfigInterface, KnownIconSize, PresetActivation, SceneProvider } from '../src/types/types-config';

describe('Config parse', () => {
    it('parse default config', () => {
        const c = {
            entity: 'light.test'
        };

        const config = new HueLikeLightCardConfig(c);

        expect(config.entity).toBe('light.test');
        expect(config.getEntities().getIdList()).toStrictEqual(['light.test']);

        expect(config.iconSize).toBe(Consts.IconSize[KnownIconSize.Original]);
        expect(config.sceneProvider).toStrictEqual([SceneProvider.HaScenes]);
    });

    it('parse sceneProvider', () => {
        const config = new HueLikeLightCardConfig({
            entity: 'light.test',
            sceneProvider: [SceneProvider.ScenePresets, SceneProvider.HaScenes]
        });

        expect(config.sceneProvider).toStrictEqual([SceneProvider.ScenePresets, SceneProvider.HaScenes]);
    });

    it('parse unset sceneProvider', () => {
        const config = new HueLikeLightCardConfig({
            entity: 'light.test'
        });

        expect(config.sceneProvider).toStrictEqual([SceneProvider.HaScenes]);
    });

    it('parse set empty sceneProvider', () => {
        const config = new HueLikeLightCardConfig({
            entity: 'light.test',
            sceneProvider: []
        });

        expect(config.sceneProvider).toStrictEqual([]);
    });

    // PresetTapActivation
    it('parse unset presetTapActivation', () => {
        const config = new HueLikeLightCardConfig({
            entity: 'light.test'
        });

        expect(config.presetTapActivation).toBe(PresetActivation.Static);
    });

    it('parse presetTapActivation', () => {
        const config = new HueLikeLightCardConfig({
            entity: 'light.test',
            presetTapActivation: 'dynamic'
        });

        expect(config.presetTapActivation).toBe(PresetActivation.Dynamic);
    });

    it('parse presetDynamicInterval and presetDynamicTransition', () => {
        const unset = new HueLikeLightCardConfig({ entity: 'light.test' });
        expect(unset.presetDynamicInterval).toBeUndefined();
        expect(unset.presetDynamicTransition).toBeUndefined();

        const config = new HueLikeLightCardConfig({ entity: 'light.test', presetDynamicInterval: 12, presetDynamicTransition: 8 });
        expect(config.presetDynamicInterval).toBe(12);
        expect(config.presetDynamicTransition).toBe(8);

        expect(() => new HueLikeLightCardConfig({ entity: 'light.test', presetDynamicInterval: 0 })).toThrow();
        expect(() => new HueLikeLightCardConfig({ entity: 'light.test', presetDynamicTransition: 'slow' as unknown as number })).toThrow();
    });

    it('parse invalid presetTapActivation', () => {
        expect(() => {
            new HueLikeLightCardConfig({
                entity: 'light.test',
                presetTapActivation: 'animated'
            });
        }).toThrow();
    });

    // IconSize
    it('parse icon size enum', () => {
        const c = {
            entity: 'light.test',
            iconSize: 'Big'
        };

        const config = new HueLikeLightCardConfig(c);

        expect(config.iconSize).toBe(Consts.IconSize[KnownIconSize.Big]);
    });

    it('parse icon size number', () => {
        const c = {
            entity: 'light.test',
            iconSize: 1.7569
        };

        const config = new HueLikeLightCardConfig(c);

        expect(config.iconSize).toBe(1.7569);
    });

    it('parse icon size error', () => {
        const c = {
            entity: 'light.test',
            iconSize: 'bigger'
        };

        expect(() => {
            new HueLikeLightCardConfig(c);
        }).toThrow();
    });

    it('parse icon size bool error', () => {
        const c = {
            entity: 'light.test',
            iconSize: true
        };
        const cTyped = (c as unknown) as HueLikeLightCardConfigInterface;

        expect(() => {
            new HueLikeLightCardConfig(cTyped);
        }).toThrow();
    });

    // LiveUpdate
    it('parse default liveUpdate', () => {
        const config = new HueLikeLightCardConfig({
            entity: 'light.test'
        });

        expect(config.liveUpdate).toBe(true);
    });

    it('parse liveUpdate false', () => {
        const config = new HueLikeLightCardConfig({
            entity: 'light.test',
            liveUpdate: false
        });

        expect(config.liveUpdate).toBe(false);
    });
});
