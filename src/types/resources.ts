import { ResourcesInterface } from './types-config';

export class Resources implements ResourcesInterface {
    /**
     * Creates new instance of text resources.
     */
    public constructor(config:ResourcesInterface | undefined) {
        config = config || {};

        this.scenes = config.scenes || 'MY SCENES';
        this.lights = config.lights || 'LIGHTS';
    }

    public readonly scenes: string;
    public readonly lights: string;
}