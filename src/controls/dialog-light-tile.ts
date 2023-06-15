import { html, css, nothing, unsafeCSS, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { Background } from '../core/colors/background';
import { Color } from '../core/colors/color';
import { ViewUtils } from '../core/view-utils';
import { Consts } from '../types/consts';
import { ILightContainer } from '../types/types-interface';
import { HueDialogSceneTile } from './dialog-scene-tile';
import { HueDialogTile, ITileEventDetail } from './dialog-tile';
import { noop } from '../types/functions';

export interface ILightSelectedEventDetail extends ITileEventDetail {
    isSelected: boolean;
    lightContainer: ILightContainer | null;
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
    public lightContainer: ILightContainer | null = null;

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
            const oldValue = changedProps.get('lightContainer') as ILightContainer | null;
            if (oldValue) {
                oldValue.unregisterOnPropertyChanged(this._id);
            }
            if (this.lightContainer) {
                this.lightContainer.registerOnPropertyChanged(this._id, () => this.lightUpdated());
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
            } else {
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

            // fire event on change
            this.dispatchEvent(new CustomEvent<ILightSelectedEventDetail>('selected-change', {
                detail: {
                    isSelected: this.isSelected,
                    lightContainer: this.lightContainer,
                    tileElement: this
                }
            }));
        }

        if (changedProps.has('isUnselected')) {
            const tile = <Element>this.renderRoot.querySelector('.hue-tile');
            tile.classList.toggle('unselected', !!this.isUnselected);
        }
    }

    private lightUpdated() {
        this.requestUpdate();
    }

    private lightClicked(): void {
        // toggle select this light
        this.isSelected = !this.isSelected;
    }

    protected override render() {
        if (!this.lightContainer)
            return nothing;

        const title = this.lightContainer.getTitle().resolveToString(null);
        const icon = this.lightContainer.getIcon() ?? Consts.DefaultOneIcon;

        /*eslint-disable */
        return html`
        <div class='selector'>
            <div class='hue-tile light' title='${title}'>
                <div class="tap-area" @click="${(): void => this.lightClicked()}">
                    <div class='icon-slot'>
                        <ha-icon icon="${icon}"></ha-icon>
                    </div>
                    <div class='title'>
                        <span>${title}</span>
                    </div>
                </div>
                <div class='switch' @mouseenter=${() => this.disableClickEffect()} @mouseleave=${() => this.enableClickEffect()}>
                    ${ViewUtils.createSwitch(this.lightContainer, noop)}
                </div>
            </div>
        </div>
        `;
        /*eslint-enable */
    }
}