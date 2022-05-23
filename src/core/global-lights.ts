import { LightContainer } from './light-container';

/**
 * Static class making LightContainer instances global.
 */
export class GlobalLights {
    private static _containers:Record<string, LightContainer> = {};

    static getLightContainer(entity_id: string): LightContainer {
        let instance = this._containers[entity_id];
        if (!instance) {
            //console.log(`[GlobalLights] Creating instance for '${entity_id}'`);
            instance = new LightContainer(entity_id);
            this._containers[entity_id] = instance;
        } else {
            //console.log(`[GlobalLights] Reusing instance for '${entity_id}'`);
        }
        return instance;
    }
}