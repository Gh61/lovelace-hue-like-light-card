export type MaybeArray<T> = T | T[];

/** Id returned by setTimeout (the browser one - a number). */
export type TimeoutId = ReturnType<typeof setTimeout>;