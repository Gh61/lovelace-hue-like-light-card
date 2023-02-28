import { html, css, TemplateResult, PropertyValues } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ViewUtils } from '../core/view-utils';
import { Consts } from '../types/consts';
import { nameof } from '../types/extensions';
import { ILightContainer } from '../types/types';
import { HueDialogTile } from './dialog-tile';

/**
 * Represents Scene tile element in HueDialog.
 */
@customElement(HueDialogLightTile.ElementName)
export class HueDialogLightTile extends HueDialogTile {

    /**
     * Name of this Element
     */
    public static override readonly ElementName = HueDialogTile.ElementName + '-light';

    private _lightContainer: ILightContainer | null = null;

    public set lightContainer(light: ILightContainer | null) {
        const oldLight = this._lightContainer;

        this._lightContainer = light;

        // custom @property() implementation
        this.requestUpdate(nameof(this, 'lightContainer'), oldLight);
    }

    public static override get styles() {
        return [
            HueDialogTile.hueDialogStyle,
            css`` // TODO: add styles
        ];
    }

    protected update(changedProps: PropertyValues): void {

        // register for changes on light
        if (changedProps.has(nameof(this, 'lightContainer'))) {
            const oldValue = changedProps.get(nameof(this, 'lightContainer')) as ILightContainer | null;
            if (oldValue) {
                oldValue.unregisterOnPropertyChanged(this._id);
            }
            if (this._lightContainer) {
                this._lightContainer.registerOnPropertyChanged(this._id, () => this.lightUpdated());
            }
        }

        // TODO: change shadow and color
    }

    private lightUpdated() {
        this.requestUpdate();
    }

    protected override render(): TemplateResult {
        if (!this._lightContainer)
            return html``;

        const title = this._lightContainer.getTitle().resolveToString(null);
        const icon = this._lightContainer.getIcon() ?? Consts.DefaultOneIcon;
        const onChange = () => { };

        /*eslint-disable */
        return html`
        <div class='hue-tile light' title='${title}'>
            <div class='icon-slot'>
                <ha-icon icon="${icon}"></ha-icon>
            </div>
            <div class='title'>
                <span>${title}</span>
            </div>
            <div class='switch'>
                ${ViewUtils.createSwitch(this._lightContainer, onChange)}
            </div>
        </div>
        `;
        /*eslint-enable */
    }
}