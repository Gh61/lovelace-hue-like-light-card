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
 * Returns new array from passed array, but with removed duplicites.
 */
export function removeDuplicites<T>(array: Array<T>): Array<T> {
    return array.filter(function (elem, index, self) {
        return index === self.indexOf(elem);
    });
}