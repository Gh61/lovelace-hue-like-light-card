import { Action } from './functions';

export type ApiMethodPostFix =
    '_openHueScreen' |
    '_test';
export type ApiMethodName = `${string}${ApiMethodPostFix}`;
export const CreateApiMethodName = (apiId: string, method: ApiMethodPostFix) => {
    return <ApiMethodName>(apiId + method);
};

/**
 * Defines API interface in JS for controling registered cards over API.
 */
export interface IApiWrapper {
    version: string,
    [key: ApiMethodName]: Action,
}

/**
 * Defines interface for card (API object) to fulfill.
 */
export interface ICardApi {
    openHueScreen(): void;
}