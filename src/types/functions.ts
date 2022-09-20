export interface Action {
    ():void;
}
export interface Action1<T> {
    (arg1:T):void;
}
export interface Action2<T, T2> {
    (arg1:T, arg2:T2):void;
}

export interface Func<TResult> {
    ():TResult;
}
export interface Func1<T, TResult> {
    (arg1:T):TResult;
}
export interface Func2<T, T2, TResult> {
    (arg1:T, arg2:T2):TResult;
}