import { HueLikeLightCard } from '../hue-like-light-card';
import { Consts } from '../types/consts';
import { CreateApiMethodName, IApiWrapper } from '../types/types-api';
import { IHassWindow } from '../types/types-hass';
import { LocationStateTracker } from './location-state-tracker';

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
    private static readonly _wrapper: IApiWrapper = {
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
        HueApiProvider.publishWrapper();
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

    /* Monitoring hash */
    private static _lastHash = '';

    private static onLocationChanged() {
        if (location.hash == HueApiProvider._lastHash)
            return;

        // first save the new value, then call the handler
        HueApiProvider._lastHash = location.hash;
        HueApiProvider.onHashChanged(location.hash);
    }

    private static onHashChanged(hash: string, retry = 0) {
        // we only react to '#hue_card:' prefixed hash
        if (hash.indexOf('#' + Consts.ApiProviderName + ':') != 0)
            return;

        const methodName = hash.substring(Consts.ApiProviderName.length + 2);
        const method = HueApiProvider._wrapper[methodName];
        if (typeof method === 'function') {
            logMessage('Hash - Calling API function ' + methodName);

            // call the method 'async', because some other events can be running, rendering must not be completely alright
            setTimeout(() => {
                method();
            }, 10);

            // API method called, clean the history hash
            if (location.hash == hash) {
                // if not changed in the meantime
                location.hash = '';
            }
        }
        else {
            // retry logic for when all cards are not registered
            if (retry < 5) {
                setTimeout(() => HueApiProvider.onHashChanged(hash, retry + 1), 50);
            }
            else {
                console.error(`[HueApiProvider] API function named ${methodName} was NOT found on API object window.${Consts.ApiProviderName}`);
            }
        }
    }

    /**
     * Will publish router to the window object, if needed.
     */
    private static publishWrapper() {
        const w = <IHassWindow>window;
        const router = w[Consts.ApiProviderName];
        if (!router) {
            w[Consts.ApiProviderName] = HueApiProvider._wrapper;
            logMessage('Wrapper published to window.' + Consts.ApiProviderName);

            // Source for another solutions, if needed:
            // https://stackoverflow.com/questions/3522090/event-when-window-location-href-changes
            LocationStateTracker.overrideHistory();
            window.addEventListener('navigate', HueApiProvider.onLocationChanged);
            window.addEventListener('load', HueApiProvider.onLocationChanged);
            window.addEventListener('hashchange', HueApiProvider.onLocationChanged);
            window.addEventListener('popstate', HueApiProvider.onLocationChanged);
            window.addEventListener('pushstate', HueApiProvider.onLocationChanged);
            window.addEventListener('replacestate', HueApiProvider.onLocationChanged);
            logMessage('Registered for hash changes');

            HueApiProvider.onLocationChanged(); // initial read
        }
    }

    private static registerRouterMethods(apiId: string) {
        HueApiProvider._wrapper[CreateApiMethodName(apiId, '_openHueScreen')] = () => HueApiProvider.openHueScreen(apiId);
    }

    private static unregisterRouterMethods(apiId: string) {
        delete HueApiProvider._wrapper[CreateApiMethodName(apiId, '_openHueScreen')];
    }

    private static openHueScreen(apiId: string) {
        const card = HueApiProvider._registeredCards[apiId];
        if (!card) {
            throw new Error(`[HueApiProvider] Card with API ID ${apiId} not found`);
        }

        card.api().openHueScreen();
    }
}