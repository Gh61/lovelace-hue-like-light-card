import { LovelaceCardConfig } from 'custom-card-helpers';
import { HassEntityAttributeBase } from 'home-assistant-js-websocket';

export type ValueFactory = () => unknown;

export interface HueLikeLightCardConfig extends LovelaceCardConfig {
    readonly title?: string;
    readonly icon?: string;
    readonly hueBorders?: boolean;
    readonly offColor?: string;
    readonly allowZero?: boolean;
    readonly entity?: string;
    readonly entities?: string[]
}

export interface HassLightAttributes extends HassEntityAttributeBase {
    brightness?: number;
    rgb_color?: number[];
}