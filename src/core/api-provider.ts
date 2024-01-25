import { HueLikeLightCard } from '../hue-like-light-card';
import { Consts } from '../types/consts';
import { CreateApiMethodName, IApiRouter } from '../types/types-api';
import { IHassWindow } from '../types/types-hass';

const logMessage = (message: string) => {
    if (Consts.Dev) {
        console.log('[HueApiProvider] ' + message);
    }
};

/**
 * Class providing public API for lovelace environment.
 * Due to this class, card dialogs can be opened from another cards.
 * When activated, Router object will be published into the window object and ApiProvider will be listening for URL changes,
 * prefixed with '#' + Consts.ApiProviderName +  ':'.
 */
export class HueApiProvider {
    private static readonly _registeredCards: Record<string, HueLikeLightCard> = {};
    private static readonly _router: IApiRouter = {
        version: Consts.Version + (Consts.Dev ? ' TEST' : '')
    };

    /**
     * Will register given card under given API id.
     * @param apiId Id of the card, to identify it in the API
     * @param card The card instance itself
     */
    public static registerCard(apiId: string, card: HueLikeLightCard) {
        const existingCard = HueApiProvider._registeredCards[apiId];
        if (existingCard && existingCard.isConnected) {
            throw new Error(`Card with ID '${apiId}' already registered!`);
        }

        HueApiProvider._registeredCards[apiId] = card;
        HueApiProvider.registerRouterMethods(apiId);

        logMessage(`Registered '${apiId}'`);
        HueApiProvider.publishRouter();
    }

    /**
     * Will unregister card with given API id.
     * @param apiId Id of the card, to identify it in the API
     */
    public static unregisterCard(apiId: string) {
        delete HueApiProvider._registeredCards[apiId];
        HueApiProvider.unregisterRouterMethods(apiId);

        logMessage(`Unregistered '${apiId}'`);
    }

    /**
     * Will publish router to the window object, if needed.
     */
    private static publishRouter() {
        const w = <IHassWindow>window;
        const router = w[Consts.ApiProviderName];
        if (!router) {
            w[Consts.ApiProviderName] = HueApiProvider._router;
            logMessage('Router published to window.' + Consts.ApiProviderName);
        }
    }

    private static registerRouterMethods(apiId: string) {
        HueApiProvider._router[CreateApiMethodName(apiId, '_openHueScreen')] = () => HueApiProvider.openHueScreen(apiId);
    }

    private static unregisterRouterMethods(apiId: string) {
        delete HueApiProvider._router[CreateApiMethodName(apiId, '_openHueScreen')];
    }

    private static openHueScreen(apiId: string) {
        const card = HueApiProvider._registeredCards[apiId];
        if (!card) {
            throw new Error(`[HueApiProvider] Card with API ID ${apiId} not found`);
        }

        card.api().openHueScreen();
    }
}