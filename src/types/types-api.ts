import { Action } from './functions';

type OpenHueScreenMethodName = `${string}_openHueScreen`;

/**
 * Defines API interface in JS for controling registered cards over API.
 */
export interface IApiRouter {
    version: string,
    [key: OpenHueScreenMethodName]: Action,
}