export class ErrorInfo {
    private _message: string;
    private _stack: string | undefined;

    public constructor(er: unknown) {
        if (typeof er === 'string') {
            this._message = er;
        }
        else if (er instanceof Error) {
            this._message = er.message;
            this._stack = er.stack;
        }
        else {
            this._message = er?.toString() || 'UNKNOWN ERROR';
        }
    }

    public get message() {
        return this._message;
    }

    public get stack(): string {
        return this._stack || '';
    }
}