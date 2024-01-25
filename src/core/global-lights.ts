import { LightController } from './light-controller';

/**
 * Static class making LightContainer instances global.
 */
export class GlobalLights {
    private static _containers:Record<string, LightController> = {};

    public static getLightContainer(entity_id: string): LightController {
        let instance = GlobalLights._containers[entity_id];
        if (!instance) {
            //console.log(`[GlobalLights] Creating instance for '${entity_id}'`);
            instance = new LightController(entity_id);
            GlobalLights._containers[entity_id] = instance;
        }
        else {
            //console.log(`[GlobalLights] Reusing instance for '${entity_id}'`);
        }
        return instance;
    }
}