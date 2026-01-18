// import type { PropertyValues, ReactiveElement } from "lit";
// import type { Constructor, HomeAssistant } from "../types";

export interface ProvideHassElement {
  provideHass(element: HTMLElement): void;
}

// export const ProvideHassLitMixin = <T extends Constructor<ReactiveElement>>(
//   superClass: T
// ) =>
//   class extends superClass {
//     protected hass!: HomeAssistant;

//     private __provideHass: HTMLElement[] = [];

//     public provideHass(el: HTMLElement) {
//       this.__provideHass.push(el);
//       el.hass = this.hass;
//     }

//     protected override updated(changedProps: PropertyValues) {
//       super.updated(changedProps);

//       if (changedProps.has("hass")) {
//         this.__provideHass.forEach((el) => {
//           (el as any).hass = this.hass;
//         });
//       }
//     }
//   };
