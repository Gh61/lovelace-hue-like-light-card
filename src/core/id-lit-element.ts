import { LitElement } from 'lit';

export abstract class IdLitElement extends LitElement {
    private static maxId = 1;
    protected _id: string;

    protected constructor(idPrefix:string) {
        super();
        this._id = idPrefix + '_' + IdLitElement.maxId++;
    }
}