import { fireEvent } from "../common/dom/fire_event";
import type { ShowToastParams } from "../managers/notification-manager";

declare global{
  interface HASSDomEvents{
    "hass-notification": Record<string, unknown>;
  }
}

export const showToast = (el: HTMLElement, params: ShowToastParams) =>
  fireEvent(el, "hass-notification", params as any);
