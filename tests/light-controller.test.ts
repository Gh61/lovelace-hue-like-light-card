import { HomeAssistant } from '../src/ha/types';
import { AreaLightController } from '../src/core/area-light-controller';
import { Color } from '../src/core/colors/color';
import { LightController } from '../src/core/light-controller';
import { Consts } from '../src/types/consts';
import { HassLightEntityFeature } from '../src/types/types-hass';

/** Creates hass with given light states, callService returns a promise resolved by the test (one per call). */
function createHass(states: Record<string, { state: 'on' | 'off', brightness?: number, hueGroup?: boolean, supportedFeatures?: number }>) {
    const calls: { data: Record<string, unknown>, resolve: () => void }[] = [];
    const hassStates: Record<string, unknown> = {};
    Object.entries(states).forEach(([entityId, s]) => {
        hassStates[entityId] = {
            entity_id: entityId,
            state: s.state,
            attributes: { brightness: s.brightness, supported_color_modes: ['hs', 'color_temp'], is_hue_group: s.hueGroup, supported_features: s.supportedFeatures }
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

describe('Live update min interval', () => {
    it('should use the default interval for a regular light', () => {
        const { hass } = createHass({ 'light.interval_regular': { state: 'on', brightness: 255 } });
        const light = new LightController('light.interval_regular');
        light.hass = hass;

        expect(light.liveUpdateMinInterval).toBe(Consts.LiveUpdateMinInterval);
    });

    it('should use the Hue group interval for a Hue room or zone', () => {
        const { hass } = createHass({ 'light.interval_hue_group': { state: 'on', brightness: 255, hueGroup: true } });
        const light = new LightController('light.interval_hue_group');
        light.hass = hass;

        expect(light.liveUpdateMinInterval).toBe(Consts.LiveUpdateHueGroupMinInterval);
    });

    it('should use the default interval when is_hue_group is false', () => {
        const { hass } = createHass({ 'light.interval_not_group': { state: 'on', brightness: 255, hueGroup: false } });
        const light = new LightController('light.interval_not_group');
        light.hass = hass;

        expect(light.liveUpdateMinInterval).toBe(Consts.LiveUpdateMinInterval);
    });

    it('should use the default interval before hass is set', () => {
        const light = new LightController('light.interval_no_hass');

        expect(light.liveUpdateMinInterval).toBe(Consts.LiveUpdateMinInterval);
    });

    it('should use the slowest interval of all lights in an area', () => {
        const { hass } = createHass({
            'light.interval_area_regular': { state: 'on', brightness: 255 },
            'light.interval_area_group': { state: 'on', brightness: 255, hueGroup: true }
        });
        const mixed = new AreaLightController(['light.interval_area_regular', 'light.interval_area_group'], new Color(255, 255, 255));
        mixed.hass = hass;
        const regular = new AreaLightController(['light.interval_area_regular'], new Color(255, 255, 255));
        regular.hass = hass;

        expect(mixed.liveUpdateMinInterval).toBe(Consts.LiveUpdateHueGroupMinInterval);
        expect(regular.liveUpdateMinInterval).toBe(Consts.LiveUpdateMinInterval);
    });
});

describe('Live update transition', () => {
    const flashFeature = 8; // HA LightEntityFeature.FLASH
    const transitionFeature = HassLightEntityFeature.Transition | flashFeature;

    it('should send a live update interval longer than the default transition as transition', () => {
        const { hass, calls } = createHass({ 'light.transition_long': { state: 'on', brightness: 255, supportedFeatures: transitionFeature } });
        const light = new LightController('light.transition_long');
        light.hass = hass;

        light.setBrightnessValue(50, 1000);
        light.setColorTemp(3000, 1000);
        light.setColor(new Color(255, 0, 0), 1000);

        expect(calls.map(c => c.data.transition)).toEqual([1, 1, 1]);
    });

    it('should send the transition in seconds', () => {
        const { hass, calls } = createHass({ 'light.transition_seconds': { state: 'on', brightness: 255, supportedFeatures: transitionFeature } });
        const light = new LightController('light.transition_seconds');
        light.hass = hass;

        light.setBrightnessValue(50, 500);

        expect(calls[0].data.transition).toBe(0.5);
    });

    it('should not send transition without a live update interval or with a short one', () => {
        const { hass, calls } = createHass({ 'light.transition_short': { state: 'on', brightness: 255, supportedFeatures: transitionFeature } });
        const light = new LightController('light.transition_short');
        light.hass = hass;

        light.setBrightnessValue(50);
        light.setBrightnessValue(50, Consts.LiveUpdateDefaultTransition);
        light.setColor(new Color(255, 0, 0), Consts.LiveUpdateMinInterval);

        expect(calls.every(c => !('transition' in c.data))).toBe(true);
    });

    it('should not send transition when the light does not support it', () => {
        const { hass, calls } = createHass({ 'light.transition_unsupported': { state: 'on', brightness: 255, supportedFeatures: flashFeature } });
        const light = new LightController('light.transition_unsupported');
        light.hass = hass;

        light.setBrightnessValue(50, 1000);

        expect(calls[0].data).toEqual({ entity_id: 'light.transition_unsupported', brightness: 128 });
    });

    it('should pass the live update interval of an area to all its lights', () => {
        const { hass, calls } = createHass({
            'light.transition_area_a': { state: 'on', brightness: 255, supportedFeatures: transitionFeature },
            'light.transition_area_b': { state: 'on', brightness: 128 }
        });
        const area = new AreaLightController(['light.transition_area_a', 'light.transition_area_b'], new Color(255, 255, 255));
        area.hass = hass;

        area.setBrightnessValue(30, 1000);

        expect(calls.map(c => c.data.transition)).toEqual([1, undefined]);
    });
});

describe('Brightness preview', () => {
    it('should preview brightness without calling a service and keep it over a hass update', () => {
        const { hass, callService } = createHass({ 'light.preview_single': { state: 'on', brightness: 255 } });
        const light = new LightController('light.preview_single');
        light.hass = hass;
        const onChange = jest.fn();
        light.registerOnPropertyChanged('test', onChange);

        light.previewBrightnessValue(40);

        expect(light.brightnessValue).toBe(40);
        expect(callService).not.toHaveBeenCalled();
        expect(onChange).toHaveBeenCalledTimes(1);

        light.hass = createHass({ 'light.preview_single': { state: 'on', brightness: 128 } }).hass;
        expect(light.brightnessValue).toBe(40);

        light.releaseBrightnessPreview();
        expect(light.brightnessValue).toBe(50);
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('should show the light as on while previewing an off light', () => {
        const { hass } = createHass({ 'light.preview_off': { state: 'off' } });
        const light = new LightController('light.preview_off');
        light.hass = hass;

        light.previewBrightnessValue(30);
        expect(light.isOn()).toBe(true);

        light.releaseBrightnessPreview();
        expect(light.isOn()).toBe(false);
    });

    it('should drop the preview when the light is turned off', () => {
        const { hass } = createHass({ 'light.preview_toggle': { state: 'on', brightness: 255 } });
        const light = new LightController('light.preview_toggle');
        light.hass = hass;

        light.previewBrightnessValue(40);
        light.turnOff();

        expect(light.isOn()).toBe(false);
        expect(light.brightnessValue).toBe(0);
    });

    it('should compute all preview steps of an area from the brightness at the start', () => {
        const { hass } = createHass({
            'light.preview_area_a': { state: 'on', brightness: 204 }, // 80 %
            'light.preview_area_b': { state: 'on', brightness: 77 } // 30 %
        });
        const area = new AreaLightController(['light.preview_area_a', 'light.preview_area_b'], new Color(255, 255, 255));
        area.hass = hass;
        const [a, b] = area.getLights();

        // small steps would get stuck on rounding (80 % light would not move at all) without the start baseline
        for (let v = 56; v <= 70; v++) {
            area.previewBrightnessValue(v);
        }

        expect(a.brightnessValue).toBe(87);
        expect(b.brightnessValue).toBe(53);
    });

    it('should send the previewed values of an area', () => {
        const { hass, calls } = createHass({
            'light.preview_send_a': { state: 'on', brightness: 204 },
            'light.preview_send_b': { state: 'on', brightness: 77 }
        });
        const area = new AreaLightController(['light.preview_send_a', 'light.preview_send_b'], new Color(255, 255, 255));
        area.hass = hass;

        area.previewBrightnessValue(60);
        area.previewBrightnessValue(70);
        area.setBrightnessValue(70);

        expect(calls.map(c => c.data.brightness)).toEqual([Math.round(0.87 * 255), Math.round(0.53 * 255)]);

        area.releaseBrightnessPreview();
        area.previewBrightnessValue(70); // new baseline from the current state
        expect(area.getLights().map(l => l.brightnessValue)).toEqual([87, 53]);
    });

    it('should preview the value on all lights of an area when all are off', () => {
        const { hass } = createHass({
            'light.preview_all_off_a': { state: 'off' },
            'light.preview_all_off_b': { state: 'off' }
        });
        const area = new AreaLightController(['light.preview_all_off_a', 'light.preview_all_off_b'], new Color(255, 255, 255));
        area.hass = hass;

        area.previewBrightnessValue(30);

        expect(area.getLights().map(l => l.brightnessValue)).toEqual([30, 30]);
    });

    it('should preview only the single lit light of an area', () => {
        const { hass } = createHass({
            'light.preview_one_lit_a': { state: 'on', brightness: 255 },
            'light.preview_one_lit_b': { state: 'off' }
        });
        const area = new AreaLightController(['light.preview_one_lit_a', 'light.preview_one_lit_b'], new Color(255, 255, 255));
        area.hass = hass;
        const [a, b] = area.getLights();

        area.previewBrightnessValue(30);

        expect(a.brightnessValue).toBe(30);
        expect(b.isOn()).toBe(false);
    });

    it('should drop the preview when the light is turned on', () => {
        const { hass } = createHass({ 'light.preview_turn_on': { state: 'off' } });
        const light = new LightController('light.preview_turn_on');
        light.hass = hass;

        light.previewBrightnessValue(0);
        light.turnOn();

        expect(light.isOn()).toBe(true);
    });

    it('should ignore brightness preview on a switch and on an unavailable light', () => {
        const { hass } = createHass({ 'switch.preview_switch': { state: 'on' } });
        const sw = new LightController('switch.preview_switch');
        sw.hass = hass;
        const unavailableHass = createHass({ 'light.preview_unavailable': { state: 'off' } }).hass;
        (unavailableHass.states['light.preview_unavailable'] as unknown as { state: string }).state = 'unavailable';
        const unavailable = new LightController('light.preview_unavailable');
        unavailable.hass = unavailableHass;
        const onChange = jest.fn();
        sw.registerOnPropertyChanged('test', onChange);
        unavailable.registerOnPropertyChanged('test', onChange);

        sw.previewBrightnessValue(30);
        unavailable.previewBrightnessValue(30);

        expect(unavailable.isOn()).toBe(false);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('should report the light as off while previewing 0 and clamp the value', () => {
        const { hass } = createHass({ 'light.preview_clamp': { state: 'on', brightness: 255 } });
        const light = new LightController('light.preview_clamp');
        light.hass = hass;

        light.previewBrightnessValue(-5);
        expect(light.brightnessValue).toBe(0);
        expect(light.isOff()).toBe(true);

        light.previewBrightnessValue(150);
        expect(light.brightnessValue).toBe(100);
    });

    it('should drop the preview of all lights when an area is turned off', () => {
        const { hass } = createHass({
            'light.preview_area_off_a': { state: 'on', brightness: 255 },
            'light.preview_area_off_b': { state: 'on', brightness: 128 }
        });
        const area = new AreaLightController(['light.preview_area_off_a', 'light.preview_area_off_b'], new Color(255, 255, 255));
        area.hass = hass;

        area.previewBrightnessValue(30);
        area.turnOff();

        expect(area.isOff()).toBe(true);
        expect(area.getLights().map(l => l.brightnessValue)).toEqual([0, 0]);
    });

    it('should not notify on release when nothing is previewed', () => {
        const { hass } = createHass({ 'light.preview_no_release': { state: 'on', brightness: 255 } });
        const light = new LightController('light.preview_no_release');
        light.hass = hass;
        const onChange = jest.fn();
        light.registerOnPropertyChanged('test', onChange);

        light.releaseBrightnessPreview();

        expect(onChange).not.toHaveBeenCalled();
    });
});
