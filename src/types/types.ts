import { LovelaceCardConfig } from "custom-card-helpers";

export interface HueLikeLightCardConfig extends LovelaceCardConfig {
    readonly title?: string;
    readonly icon?: string;
    readonly entity: string;
    readonly entites: string[]
}