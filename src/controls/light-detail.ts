import { IdLitElement } from '../core/id-lit-element';
import { Consts } from '../types/consts';


export class HueLightDetail extends IdLitElement {
    /**
     * Name of this Element
     */
    protected static readonly ElementName = 'hue-light-detail' + Consts.ElementPostfix;

    public constructor() {
        super('HueLightDetail');
    }
}