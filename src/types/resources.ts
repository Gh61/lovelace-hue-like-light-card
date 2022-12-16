import { ResourcesInterface } from './types-config';

export class Resources implements ResourcesInterface {
    /**
     * Creates new instance of text resources.
     */
    constructor(config:ResourcesInterface | undefined) {
        config = config || {};

        this.scenes = config.scenes || 'Scenes';
        this.lights = config.lights || 'Lights';
    }

    readonly scenes: string;
    readonly lights: string;
}