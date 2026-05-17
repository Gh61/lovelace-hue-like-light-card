import { HueLikeLightCardConfig } from '../src/types/config';
import { Consts } from '../src/types/consts';
import { HueLikeLightCardConfigInterface, KnownIconSize, SceneProvider } from '../src/types/types-config';

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
});
