import { HomeAssistant } from 'custom-card-helpers';
import { AreaLightController } from '../src/core/area-light-controller';
import { Color } from '../src/core/colors/color';
import { LightController } from '../src/core/light-controller';

/** Creates hass with given light states, callService returns a promise resolved by the test (one per call). */
function createHass(states: Record<string, { state: 'on' | 'off', brightness?: number }>) {
    const calls: { data: Record<string, unknown>, resolve: () => void }[] = [];
    const hassStates: Record<string, unknown> = {};
    Object.entries(states).forEach(([entityId, s]) => {
        hassStates[entityId] = {
            entity_id: entityId,
            state: s.state,
            attributes: { brightness: s.brightness, supported_color_modes: ['hs', 'color_temp'] }
        };
    });

    const callService = jest.fn((...args: unknown[]) =>
        new Promise<void>(resolve => calls.push({ data: args[2] as Record<string, unknown>, resolve })));

    const hass = { states: hassStates, callService } as unknown as HomeAssistant;
    return { hass, calls, callService };
}

/** @returns whether the promise is settled after all microtasks ran. */
async function isSettled(promise: Promise<void>) {
    let settled = false;
    promise.then(() => settled = true);
    await new Promise(resolve => setTimeout(resolve));
    return settled;
}

describe('LightController', () => {
    it('should resolve setBrightnessValue after the service call is confirmed', async () => {
        const { hass, calls } = createHass({ 'light.ctrl_brightness': { state: 'on', brightness: 255 } });
        const light = new LightController('light.ctrl_brightness');
        light.hass = hass;

        const promise = light.setBrightnessValue(50);

        expect(light.brightnessValue).toBe(50);
        expect(calls.length).toBe(1);
        expect(calls[0].data).toEqual({ entity_id: 'light.ctrl_brightness', brightness: 128 });
        expect(await isSettled(promise)).toBe(false);

        calls[0].resolve();
        expect(await isSettled(promise)).toBe(true);
    });

    it('should resolve setColorTemp and setColor after the service call is confirmed', async () => {
        const { hass, calls } = createHass({ 'light.ctrl_color': { state: 'on', brightness: 255 } });
        const light = new LightController('light.ctrl_color');
        light.hass = hass;

        const tempPromise = light.setColorTemp(3000);
        const colorPromise = light.setColor(new Color(255, 0, 0));

        expect(calls.length).toBe(2);
        expect(await isSettled(tempPromise)).toBe(false);
        expect(await isSettled(colorPromise)).toBe(false);

        calls.forEach(c => c.resolve());
        expect(await isSettled(tempPromise)).toBe(true);
        expect(await isSettled(colorPromise)).toBe(true);
    });

    it('should resolve immediately for a switch without calling a service', async () => {
        const { hass, callService } = createHass({ 'switch.ctrl_switch': { state: 'on' } });
        const light = new LightController('switch.ctrl_switch');
        light.hass = hass;

        expect(await isSettled(light.setBrightnessValue(50))).toBe(true);
        expect(callService).not.toHaveBeenCalled();
    });
});

describe('AreaLightController', () => {
    it('should resolve setBrightnessValue after all lights confirmed', async () => {
        const { hass, calls } = createHass({
            'light.area_a': { state: 'on', brightness: 255 },
            'light.area_b': { state: 'on', brightness: 128 }
        });
        const area = new AreaLightController(['light.area_a', 'light.area_b'], new Color(255, 255, 255));
        area.hass = hass;

        const promise = area.setBrightnessValue(30);

        expect(calls.length).toBe(2);
        calls[0].resolve();
        expect(await isSettled(promise)).toBe(false);

        calls[1].resolve();
        expect(await isSettled(promise)).toBe(true);
    });

    it('should only call the single lit light and resolve after its confirmation', async () => {
        const { hass, calls } = createHass({
            'light.area_single_a': { state: 'on', brightness: 255 },
            'light.area_single_b': { state: 'off' }
        });
        const area = new AreaLightController(['light.area_single_a', 'light.area_single_b'], new Color(255, 255, 255));
        area.hass = hass;

        const promise = area.setBrightnessValue(30);

        expect(calls.length).toBe(1);
        expect(calls[0].data.entity_id).toBe('light.area_single_a');
        expect(await isSettled(promise)).toBe(false);

        calls[0].resolve();
        expect(await isSettled(promise)).toBe(true);
    });

    it('should resolve setBrightnessValue after all lights confirmed when all are off', async () => {
        const { hass, calls } = createHass({
            'light.area_off_a': { state: 'off' },
            'light.area_off_b': { state: 'off' }
        });
        const area = new AreaLightController(['light.area_off_a', 'light.area_off_b'], new Color(255, 255, 255));
        area.hass = hass;

        const promise = area.setBrightnessValue(30);

        expect(calls.length).toBe(2);
        calls[0].resolve();
        expect(await isSettled(promise)).toBe(false);

        calls[1].resolve();
        expect(await isSettled(promise)).toBe(true);
    });
});
