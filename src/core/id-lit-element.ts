import { LitElement } from 'lit';

export abstract class IdLitElement extends LitElement {
    private static maxId = 1;
    protected _elementId: string;

    protected constructor(idPrefix:string) {
        super();
        this._elementId = idPrefix + '_' + IdLitElement.maxId++;
    }
}