import { LovelaceCardConfig } from "custom-card-helpers";

export interface HueLikeLightCardConfig extends LovelaceCardConfig {
    readonly title?: string;
    readonly icon?: string;
    readonly hueBorders?: boolean;
    readonly offColor?: string;
    readonly allowZero?: boolean;
    readonly entity?: string;
    readonly entities?: string[]
}