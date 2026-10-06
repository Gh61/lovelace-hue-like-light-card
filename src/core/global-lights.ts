import { ConsoleLogger } from './console-logger';
import { LightController } from './light-controller';

const log = new ConsoleLogger('GlobalLights');

/**
 * Static class making LightContainer instances global.
 */
export class GlobalLights {
    private static _containers:Record<string, LightController> = {};

    public static getLightContainer(entity_id: string): LightController {
        let instance = GlobalLights._containers[entity_id];
        if (!instance) {
            log.trace(() => `Creating instance for '${entity_id}'`);
            instance = new LightController(entity_id);
            GlobalLights._containers[entity_id] = instance;
        }
        else {
            log.trace(() => `Reusing instance for '${entity_id}'`);
        }
        return instance;
    }
}
