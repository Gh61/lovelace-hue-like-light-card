import { html, render } from 'lit';
import { horizontalScroll } from '../src/directives/horizontal-scroll';
import { noop } from '../src/types/functions';

describe('horizontalScroll', () => {
    let addSpy: jest.SpyInstance;
    let removeSpy: jest.SpyInstance;

    const wheelCalls = (spy: jest.SpyInstance) => spy.mock.calls.filter(c => c[0] === 'wheel');

    beforeEach(() => {
        addSpy = jest.spyOn(HTMLDivElement.prototype, 'addEventListener');
        removeSpy = jest.spyOn(HTMLDivElement.prototype, 'removeEventListener');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const renderScroller = (container: HTMLElement) => render(html`<div ${horizontalScroll()}></div>`, container);

    it('should attach the wheel listener only once', () => {
        const container = document.createElement('div');
        renderScroller(container);
        renderScroller(container);

        expect(wheelCalls(addSpy)).toHaveLength(1);
        expect(wheelCalls(removeSpy)).toHaveLength(0);
    });

    it('should remove the wheel listener on disconnect and re-attach it on reconnect', () => {
        const container = document.createElement('div');
        const part = renderScroller(container);
        const listener = wheelCalls(addSpy)[0][1];

        part.setConnected(false);
        expect(wheelCalls(removeSpy)).toHaveLength(1);
        expect(wheelCalls(removeSpy)[0][1]).toBe(listener);

        part.setConnected(true);
        expect(wheelCalls(addSpy)).toHaveLength(2);

        // re-render after reconnect must not add another listener
        renderScroller(container);
        expect(wheelCalls(addSpy)).toHaveLength(2);
    });

    it('should cancel a running scroll animation on disconnect', () => {
        const requestSpy = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(42);
        const cancelSpy = jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(noop);

        const container = document.createElement('div');
        const part = renderScroller(container);
        const el = container.querySelector('div')!;
        // jsdom has no layout - make the element scrollable
        Object.defineProperty(el, 'scrollWidth', { value: 1000 });
        Object.defineProperty(el, 'clientWidth', { value: 100 });

        el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
        expect(requestSpy).toHaveBeenCalledTimes(1);

        part.setConnected(false);
        expect(cancelSpy).toHaveBeenCalledWith(42);
    });

    it('should not attach the wheel listener when rendered while disconnected', () => {
        const container = document.createElement('div');
        const part = renderScroller(container);
        part.setConnected(false);

        renderScroller(container);
        expect(wheelCalls(addSpy)).toHaveLength(1);

        part.setConnected(true);
        expect(wheelCalls(addSpy)).toHaveLength(2);
    });
});
