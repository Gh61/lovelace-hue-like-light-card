import { HomeAssistant } from 'custom-card-helpers';
import { HueLikeLightCardConfig } from '../src/types/config';
import { HueLikeLightCardConfigInterface, SceneOrder } from '../src/types/types-config';
import { HassLabelInfo, HassSearchDeviceResult } from '../src/types/types-hass';

interface WsMessage {
    type: string;
    item_type?: string;
    item_id?: string;
}

const relatedResults: Record<string, Record<string, HassSearchDeviceResult>> = {
    floor: {
        ground_floor: {
            config_entry: [],
            entity: ['light.floor_1', 'switch.floor', 'light.floor_2'],
            scene: ['scene.floor_b', 'scene.floor_a']
        },
        empty_floor: {
            config_entry: [],
            entity: ['sensor.empty']
        }
    },
    area: {
        living_room: {
            config_entry: [],
            entity: ['light.living_1', 'light.living_2', 'sensor.living'],
            scene: ['scene.living_relax', 'scene.living_bright']
        },
        empty_area: {
            config_entry: [],
            entity: ['sensor.empty']
        },
        broken: {
            config_entry: []
        }
    },
    label: {
        party: {
            config_entry: [],
            entity: ['light.party_1', 'light.living_1'],
            scene: ['scene.party']
        },
        no_icon: {
            config_entry: [],
            entity: ['light.no_icon']
        },
        empty_label: {
            config_entry: [],
            entity: ['switch.empty']
        }
    }
};

const labelRegistry: HassLabelInfo[] = [
    { label_id: 'party', name: 'Party Lights', icon: 'mdi:party-popper' },
    { label_id: 'no_icon', name: 'No Icon' },
    { label_id: 'empty_label', name: 'Empty Label' },
    { label_id: 'broken', name: 'Broken' }
];

const createHass = () => {
    const sendMessagePromise = jest.fn(async (msg: WsMessage) => {
        if (msg.type === 'config/label_registry/list')
            return labelRegistry;

        if (msg.type === 'search/related') {
            if (msg.item_id === 'broken')
                throw new Error('WS failure');

            // copy - loaded scenes are sorted in place
            return JSON.parse(JSON.stringify(relatedResults[msg.item_type!]?.[msg.item_id!] ?? {}));
        }

        throw new Error(`Unexpected message ${msg.type}`);
    });

    const hass = {
        connection: { sendMessagePromise },
        floors: { ground_floor: { name: 'Ground Floor' } },
        areas: { living_room: { name: 'Living Room' } }
    } as unknown as HomeAssistant;

    return { hass, sendMessagePromise };
};

const initConfig = async (plainConfig: HueLikeLightCardConfigInterface) => {
    const { hass, sendMessagePromise } = createHass();
    // no scene provider - avoids fire&forget loading of scenes from entity areas
    const config = new HueLikeLightCardConfig({ sceneProvider: [], ...plainConfig });
    await config.init(hass);
    return { config, sendMessagePromise };
};

describe('Config init', () => {
    it('should load floor lights, title and scenes', async () => {
        const { config } = await initConfig({ floor: 'Ground Floor' });

        expect(config.getEntities().getIdList()).toStrictEqual(['light.floor_1', 'light.floor_2']);
        expect(config.title).toBe('Ground Floor');
        expect(config.scenes.map(s => s.entity)).toStrictEqual(['scene.floor_b', 'scene.floor_a']);
    });

    it('should load area lights, title and scenes', async () => {
        const { config } = await initConfig({ area: 'Living Room' });

        expect(config.getEntities().getIdList()).toStrictEqual(['light.living_1', 'light.living_2']);
        expect(config.title).toBe('Living Room');
        expect(config.scenes.map(s => s.entity)).toStrictEqual(['scene.living_relax', 'scene.living_bright']);
    });

    it('should load label lights, title and icon, but no scenes', async () => {
        const { config } = await initConfig({ label: 'Party' });

        expect(config.getEntities().getIdList()).toStrictEqual(['light.party_1', 'light.living_1']);
        expect(config.title).toBe('Party Lights');
        expect(config.icon).toBe('mdi:party-popper');
        expect(config.scenes).toStrictEqual([]);
    });

    it('should not set icon when label has none', async () => {
        const { config } = await initConfig({ label: 'No Icon' });

        expect(config.icon).toBeUndefined();
    });

    it('should keep title and icon from config', async () => {
        const { config } = await initConfig({ label: 'Party', title: 'My title', icon: 'mdi:lamp' });

        expect(config.title).toBe('My title');
        expect(config.icon).toBe('mdi:lamp');
    });

    it('should sort group scenes by sceneOrder', async () => {
        const { config } = await initConfig({ floor: 'Ground Floor', sceneOrder: SceneOrder.NameAsc });

        expect(config.scenes.map(s => s.entity)).toStrictEqual(['scene.floor_a', 'scene.floor_b']);
    });

    it('should not use group scenes when other entities are outside the group', async () => {
        const { config } = await initConfig({ entity: 'light.other', area: 'Living Room' });

        expect(config.getEntities().getIdList()).toStrictEqual(['light.other', 'light.living_1', 'light.living_2']);
        expect(config.scenes).toStrictEqual([]);
    });

    it('should use group scenes when other entities are inside the group', async () => {
        const { config } = await initConfig({ entity: 'light.living_2', area: 'Living Room' });

        expect(config.getEntities().getIdList()).toStrictEqual(['light.living_2', 'light.living_1']);
        expect(config.scenes.map(s => s.entity)).toStrictEqual(['scene.living_relax', 'scene.living_bright']);
    });

    it('should keep scenes from config', async () => {
        const { config } = await initConfig({ area: 'Living Room', scenes: ['scene.mine'] });

        expect(config.scenes.map(s => s.entity)).toStrictEqual(['scene.mine']);
    });

    it.each([
        [['scene.mine'], ['scene.mine']],
        [[], []]
    ])('should load floor lights when scenes %p are configured', async (scenes, expectedScenes) => {
        const { hass } = createHass();
        const config = new HueLikeLightCardConfig({ sceneProvider: [], floor: 'Ground Floor', scenes });

        expect(config.isInitialized).toBe(false);

        await config.init(hass);

        expect(config.getEntities().getIdList()).toStrictEqual(['light.floor_1', 'light.floor_2']);
        expect(config.scenes.map(s => s.entity)).toStrictEqual(expectedScenes);
    });

    it('should combine floor, area and label in this order with title from floor', async () => {
        const { config } = await initConfig({ label: 'Party', area: 'Living Room', floor: 'Ground Floor' });

        expect(config.getEntities().getIdList()).toStrictEqual([
            'light.floor_1', 'light.floor_2', 'light.living_1', 'light.living_2', 'light.party_1'
        ]);
        expect(config.title).toBe('Ground Floor');
        // floor scenes are used, because the floor was the only source when it was loaded
        expect(config.scenes.map(s => s.entity)).toStrictEqual(['scene.floor_b', 'scene.floor_a']);
    });

    it('should not call WS without floor, area and label', async () => {
        const { config, sendMessagePromise } = await initConfig({ entity: 'light.test' });

        expect(config.isInitialized).toBe(true);
        expect(sendMessagePromise).not.toHaveBeenCalled();
    });

    it('should load group lights only once when init is called twice', async () => {
        const { hass, sendMessagePromise } = createHass();
        const config = new HueLikeLightCardConfig({ sceneProvider: [], floor: 'Ground Floor', label: 'Party' });

        await config.init(hass);
        const callCount = sendMessagePromise.mock.calls.length;
        await config.init(hass);

        expect(sendMessagePromise).toHaveBeenCalledTimes(callCount);
        expect(config.getEntities().getIdList()).toStrictEqual([
            'light.floor_1', 'light.floor_2', 'light.party_1', 'light.living_1'
        ]);
    });

    it.each([
        [{ floor: 'Basement' }, 'Floor \'Basement\' does not exist.'],
        [{ area: 'Garage' }, 'Area \'Garage\' does not exist.'],
        [{ label: 'Unknown' }, 'Label \'Unknown\' does not exist.'],
        [{ floor: 'Empty Floor' }, 'Floor \'Empty Floor\' has no light entities.'],
        [{ area: 'Empty Area' }, 'Area \'Empty Area\' has no light entities.'],
        [{ label: 'Empty Label' }, 'Label \'Empty Label\' has no light entities.'],
        [{ floor: 'Broken' }, 'Cannot load entities from floor \'Broken\'. See console for more info.'],
        [{ label: 'No Icon', area: 'Broken' }, 'Cannot load entities from area \'Broken\'. See console for more info.'],
        [{ label: 'Broken' }, 'Cannot load entities from label \'Broken\'. See console for more info.']
    ])('should throw user-friendly error for %p', async (plainConfig, message) => {
        const { hass } = createHass();
        const config = new HueLikeLightCardConfig({ sceneProvider: [], ...plainConfig });
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(config.init(hass)).rejects.toThrow(message);

        consoleError.mockRestore();
    });
});
