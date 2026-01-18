import { HomeAssistant } from '../ha/types';
import { css, nothing, PropertyValues, TemplateResult, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { IdLitElement } from '../core/id-lit-element';
import { Consts } from '../types/consts';
import { nameof } from '../types/extensions';
import { ActionHandlerEvent, ActionHandlerOptions } from '../ha/data/lovelace/action_handler';
import { ActionHandler } from '../core/action-handler';
import { HueHistoryStateManager } from './history-state-manager';

export interface ITileEventDetail {
    tileElement: HueDialogTile;
}

/**
 * Base for tile element in HueDialog
 */
export abstract class HueDialogTile extends IdLitElement {

    /**
     * Name of this Element
     */
    protected static readonly ElementName = 'hue-dialog-tile' + Consts.ElementPostfix;

    @property()
    public cardTitle: string;

    @property()
    public actionHandler: ActionHandler;

    protected _hass: HomeAssistant;
    public set hass(hass: HomeAssistant) {
        const oldHass = this._hass;

        this._hass = hass;
        this.updateHassDependentProps();

        // custom @property() implementation
        this.requestUpdate(nameof(this, 'hass'), oldHass);
    }

    protected constructor() {
        super('HueDialogTile');
    }

    protected updateHassDependentProps() { }

    protected static readonly padding = 5; // px
    protected static readonly height = 90; // px
    protected static readonly width = 85; // px
    protected static readonly titleHeight = 35; // px
    protected static readonly clickTransition = 'transform .15s';

    protected static hueDialogStyle = css`
    :host{
        -webkit-tap-highlight-color: transparent;
    }
    .hue-tile{
        background: ${unsafeCSS(Consts.TileOffColor)};
        width: ${HueDialogTile.width}px;
        height: ${HueDialogTile.height}px;
        padding: ${HueDialogTile.padding}px;
        border-radius: ${Consts.HueBorderRadius}px;
        box-shadow: ${unsafeCSS(Consts.HueShadow)};
        overflow:hidden;
        user-select: none;
        transition: ${unsafeCSS(HueDialogTile.clickTransition)};
    }
    .hue-tile:not(.no-click):active:hover{
        transform: scale(0.95);
    }
    .title {
        color:${unsafeCSS(Consts.LightColor)};
        font-size: 12px;
        line-height: 15px;
        font-weight:400;
        height:${HueDialogTile.titleHeight}px;
        text-align: center;
        display: flex;
        flex-flow: column;
        justify-content: center;
        transition: ${unsafeCSS(Consts.TransitionDefault)};
    }
    .title span {
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }
    `;

    protected get actionHandlerConfig(): ActionHandlerOptions {
        return {
            hasTap: true,
            hasHold: true,
            hasDoubleClick: false
        }
    }

    private handleAction(ev: ActionHandlerEvent){
        switch (ev.detail.action){
            case "hold":
                const entityId = this.getEntityId();
                if (entityId) {
                    if (!this.actionHandler)
                        throw new Error('Cannot open more-info - ActionHandler not set in ' + this._elementId);

                    this.actionHandler.showMoreInfo(entityId);
                    HueHistoryStateManager.instance.tryAddExternalStep();
                }
                break;

            case "tap":
                this.tileClicked(ev);
                break;
        }
    }

    protected abstract getEntityId(): string | undefined;

    protected abstract tileClicked(event: ActionHandlerEvent): void;

    protected abstract override updated(changedProps: PropertyValues): void;

    protected abstract override render(): TemplateResult | typeof nothing;

    public override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener("action", this.handleAction as EventListener);
    }

    public override disconnectedCallback(): void {
        this.removeEventListener("action", this.handleAction as EventListener);
        super.disconnectedCallback();
    }
}