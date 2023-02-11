import { LitElement } from 'lit';
import { customElement } from 'lit/decorators';
import { Consts } from '../types/consts';

@customElement(HueBrightnessRollup.ElementName)
export class HueBrightnessRollup extends LitElement {
    /**
     * Name of this Element
     */
    public static readonly ElementName = Consts.CardElementName + '-hue-brightness-rollup';

    protected override render() {
        
    }
}