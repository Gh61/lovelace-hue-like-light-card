export function noop(..._args: unknown[]) { }

export interface FuncDefinition {
    'constructor':{
        name: string;
    }
}

export interface Action extends FuncDefinition {
    (): void;
}
export interface Action1<T> extends FuncDefinition {
    (arg1: T): void;
}
export interface Action2<T, T2> extends FuncDefinition {
    (arg1: T, arg2: T2): void;
}

export interface Func<TResult> extends FuncDefinition {
    (): TResult;
}
export interface Func1<T, TResult> extends FuncDefinition {
    (arg1: T): TResult;
}
export interface Func2<T, T2, TResult> extends FuncDefinition {
    (arg1: T, arg2: T2): TResult;
}

export interface AsyncAction extends FuncDefinition {
    (): Promise<void>
}