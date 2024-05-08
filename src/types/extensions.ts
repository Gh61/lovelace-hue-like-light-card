export function nameof<TObject>(obj: TObject, key: keyof TObject): string;
export function nameof<TObject>(key: keyof TObject): string;
export function nameof(key1: unknown, key2?: unknown): unknown {
    return key2 ?? key1;
}

/**
 * Ensures that given entityId is under expectedDomain, else throws exception.
 */
export function ensureEntityDomain(entityId: string, expectedDomain: string, ...expectedDomains: string[]) {
    expectedDomains.unshift(expectedDomain);

    const domain = entityId.split('.')[0];
    if (expectedDomains.indexOf(domain) < 0)
        throw new Error(`Unsupported entity type: ${domain} (in '${entityId}'). Supported type(s): '${expectedDomains.join('\', \'')}'.`);
}

/**
 * @returns new array from passed array, but with only first occurrence of every item.
 */
export function removeDuplicates<T>(array: Array<T>): Array<T> {
    return array.filter(function (elem, index, self) {
        return index === self.indexOf(elem);
    });
}

/**
 * In place removal of passed items from given array.
 */
export function removeFrom<T>(array: Array<T>, ...items: Array<T>): void {
    items.forEach(i => {
        const index = array.indexOf(i);
        if (index >= 0) {
            array.splice(index, 1);
        }
    });
}

/**
 * @returns given text without diacritics, using normalized state for removal.
 */
export function removeDiacritics(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Will vibrate for given amount of ms, if the current device supports this function.
 */
export function doVibrate(...ms: number[]) {
    if (window?.navigator?.vibrate) {
        window.navigator.vibrate(ms);
    }
}