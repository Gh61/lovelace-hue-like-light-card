/**
 * Stubs of Home Assistant frontend custom elements that the card relies on at runtime.
 * Import this module in tests that render elements using the HA `actionHandler()` directive.
 */

/**
 * HA registers a global `<action-handler>` element (lovelace bundle) and the `actionHandler()` directive
 * looks it up in `document.body`. In jsdom nobody defines it, so `bind` would be missing.
 */
class ActionHandlerStub extends HTMLElement {
    public holdTime = 500;

    public bind(): void {
        // no gesture handling in tests
    }
}

if (!customElements.get('action-handler')) {
    customElements.define('action-handler', ActionHandlerStub);
}
