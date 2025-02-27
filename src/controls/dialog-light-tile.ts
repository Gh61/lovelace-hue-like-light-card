import { html, css, nothing, unsafeCSS, PropertyValues } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { Background } from '../core/colors/background';
import { Color } from '../core/colors/color';
import { ViewUtils } from '../core/view-utils';
import { Consts } from '../types/consts';
import { ISingleLightContainer } from '../types/types-interface';
import { HueDialogSceneTile } from './dialog-scene-tile';
import { HueDialogTile, ITileEventDetail } from './dialog-tile';
import { noop } from '../types/functions';
import { IconHelper } from '../core/icon-helper';
import { HueLikeLightCardEntityConfig } from '../types/config';

export interface ILightSelectedEventDetail extends ITileEventDetail {
    isSelected: boolean;
    lightContainer: ISingleLightContainer | null;
}

/**
 * Represents Scene tile element in HueDialog.
 */
@customElement(HueDialogLightTile.ElementName)
export class HueDialogLightTile extends HueDialogTile {

    /**
     * Name of this Element
     */
    public static override readonly ElementName = HueDialogTile.ElementName + '-light';

    @property()
    public lightContainer: ISingleLightContainer | null = null;

    @property()
    public entityConfig: HueLikeLightCardEntityConfig | null = null;

    @property()
    public defaultColor: Color | null = null;

    @property()
    public isSelected = false;

    @property()
    public isUnselected = false;

    private static readonly titlePadding = 10;
    private static readonly switchHeight = 45;
    private static readonly selectorWidth = 2;
    private static readonly selectorSpacing = 2;

    public static override get styles() {
        return [
            HueDialogTile.hueDialogStyle,
            css`
    .hue-tile.light{
        height: ${HueDialogTile.height + HueDialogLightTile.switchHeight}px;
        background:var(--hue-light-background, ${unsafeCSS(Consts.TileOffColor)});
        box-shadow:var(--hue-light-box-shadow), ${unsafeCSS(Consts.HueShadow)};
        transition: ${unsafeCSS(Consts.TransitionDefault)}, ${unsafeCSS(HueDialogTile.clickTransition)};
    }

    .hue-tile.light.unselected{
        opacity: 0.7;
    }

    .selector.active{
        border: ${HueDialogLightTile.selectorWidth}px solid var(--hue-light-background, ${unsafeCSS(Consts.WarmColor)});
        padding: ${HueDialogLightTile.selectorSpacing}px;
        border-radius: ${Consts.HueBorderRadius + HueDialogLightTile.selectorWidth + HueDialogLightTile.selectorSpacing}px;
        margin: -${HueDialogLightTile.selectorWidth + HueDialogLightTile.selectorSpacing}px
    }

    .hue-tile.light .tap-area{
        display: flex;
        flex-flow: column;
        height: ${HueDialogTile.height}px;

        cursor: pointer;
    }

    .title{
        color: var(--hue-light-text-color, ${unsafeCSS(Consts.LightColor)});
        padding-bottom: ${HueDialogLightTile.titlePadding}px;
        font-weight: 500;
    }

    .icon-slot{
        display: flex;
        flex-flow: column;
        text-align: center;
        height: ${HueDialogTile.height - HueDialogLightTile.titleHeight - HueDialogLightTile.titlePadding}px;
        /*height: calc(100% - ${HueDialogLightTile.titleHeight}px - ${HueDialogLightTile.titlePadding}px - ${HueDialogLightTile.switchHeight}px);*/
        justify-content: center;
    }
    .icon-slot ha-icon {
        color: var(--hue-light-text-color, ${unsafeCSS(Consts.LightColor)});
        transform: scale(${HueDialogSceneTile.iconScale});
    }

    .switch{
        display:flex;
        flex-flow:column;

        height: ${HueDialogLightTile.switchHeight + HueDialogTile.padding}px;
        justify-content: center;
        background: linear-gradient(rgba(255, 255, 255, 0.1), transparent);
        border-top: 1px solid rgba(80, 80, 80, 0.1);
        box-sizing: content-box;
        margin: 0 -${HueDialogTile.padding}px;
    }
    .switch ha-switch{
        justify-content:center;
    }

    `];
    }

    protected override updated(changedProps: PropertyValues<HueDialogLightTile>): void {
        // register for changes on light
        if (changedProps.has('lightContainer')) {
            const oldValue = changedProps.get('lightContainer') as ISingleLightContainer | null;
            if (oldValue) {
                oldValue.unregisterOnPropertyChanged(this._elementId);
            }
            if (this.lightContainer) {
                this.lightContainer.registerOnPropertyChanged(this._elementId, () => this.lightUpdated());
            }
        }

        if (this.lightContainer) {
            if (this.lightContainer.isOn()) {
                const defaultColorBg = this.defaultColor ? new Background([this.defaultColor]) : null;
                const bfg = ViewUtils.calculateBackAndForeground(this.lightContainer, null, true, defaultColorBg);

                if (bfg.background) {
                    this.style.setProperty(
                        '--hue-light-background',
                        bfg.background.toString()
                    );
                }

                if (bfg.foreground) {
                    this.style.setProperty(
                        '--hue-light-text-color',
                        bfg.foreground.toString()
                    );
                }
            }
            else {
                this.style.removeProperty(
                    '--hue-light-background'
                );
                this.style.removeProperty(
                    '--hue-light-text-color'
                );
            }

            const shadow = ViewUtils.calculateDefaultShadow(this, this.lightContainer, false);
            this.style.setProperty(
                '--hue-light-box-shadow',
                shadow
            );
        }

        if (changedProps.has('isSelected')) {
            const selector = <Element>this.renderRoot.querySelector('.selector');
            selector.classList.toggle('active', !!this.isSelected);
        }

        if (changedProps.has('isUnselected')) {
            const tile = <Element>this.renderRoot.querySelector('.hue-tile');
            tile.classList.toggle('unselected', !!this.isUnselected);
        }
    }

    private lightUpdated() {
        this.requestUpdate();
    }

    @query('.hue-tile .tap-area')
    protected override clickTarget!: HTMLDivElement;

    protected override tileClicked() {
        // toggle select this light
        this.isSelected = !this.isSelected;

        // fire event onclick
        this.dispatchEvent(new CustomEvent<ILightSelectedEventDetail>('selected-change', {
            detail: {
                isSelected: this.isSelected,
                lightContainer: this.lightContainer,
                tileElement: this
            }
        }));
    }

    protected override getEntityId() {
        return this.lightContainer?.getEntityId();
    }

    protected override render() {
        if (!this.lightContainer)
            return nothing;

        let title: string;
        if (this.entityConfig) {
            title = this.entityConfig.getTitle(this.lightContainer).resolveToString(this._hass);
        }
        else {
            title = this.lightContainer.getTitle().resolveToString(null);
        }

        const icon = this.entityConfig?.icon ?? this.lightContainer.getIcon() ?? IconHelper.getIcon(1);

        /*eslint-disable */
        return html`
        <div class='selector'>
            <div class='hue-tile light' title='${title}'>
                <div class='tap-area'>
                    <div class='icon-slot'>
                        <ha-icon icon="${icon}"></ha-icon>
                    </div>
                    <div class='title'>
                        <span>${title}</span>
                    </div>
                </div>
                <div class='switch'>
                    ${ViewUtils.createSwitch(this.lightContainer, noop)}
                </div>
            </div>
        </div>
        `;
        /*eslint-enable */
    }

    public override connectedCallback(): void {
        super.connectedCallback();

        if (this.lightContainer) {
            this.lightContainer.registerOnPropertyChanged(this._elementId, () => this.lightUpdated());
        }
    }

    public override disconnectedCallback(): void {
        super.disconnectedCallback();

        if (this.lightContainer) {
            this.lightContainer.unregisterOnPropertyChanged(this._elementId);
        }
    }
}