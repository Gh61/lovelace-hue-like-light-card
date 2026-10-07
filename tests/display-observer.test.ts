import { DisplayObserver } from '../src/core/display-observer';

/** Minimal ResizeObserver mock - the test triggers the callback by `resize()`. */
class ResizeObserverMock {
    public static instances: ResizeObserverMock[] = [];
    public readonly observed = new Set<Element>();

    public constructor(private readonly callback: () => void) {
        ResizeObserverMock.instances.push(this);
    }

    public observe(element: Element) {
        this.observed.add(element);
    }

    public unobserve(element: Element) {
        this.observed.delete(element);
    }

    public resize() {
        this.callback();
    }
}

function createElement(height: number) {
    const element = document.createElement('div');
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: height });
    return element;
}

function setHeight(element: Element, height: number) {
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: height });
}

describe('DisplayObserver', () => {
    const originalResizeObserver = globalThis.ResizeObserver;

    beforeEach(() => {
        ResizeObserverMock.instances = [];
        globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
    });

    afterEach(() => {
        globalThis.ResizeObserver = originalResizeObserver;
    });

    it('should call the callback once when the element gets displayed', () => {
        const onDisplayed = jest.fn();
        const observer = new DisplayObserver(onDisplayed);
        const ro = ResizeObserverMock.instances[0];
        const element = createElement(0);

        observer.waitForDisplay(element);
        ro.resize();
        expect(onDisplayed).not.toHaveBeenCalled();

        setHeight(element, 50);
        ro.resize();
        ro.resize();

        expect(onDisplayed).toHaveBeenCalledTimes(1);
        expect(ro.observed.size).toBe(0);
    });

    it('should observe only the last element', () => {
        const observer = new DisplayObserver(jest.fn());
        const ro = ResizeObserverMock.instances[0];
        const first = createElement(0);
        const second = createElement(0);

        observer.waitForDisplay(first);
        observer.waitForDisplay(second);
        observer.waitForDisplay(second);

        expect([...ro.observed]).toEqual([second]);
    });

    it('should not call the callback for a replaced element', () => {
        const onDisplayed = jest.fn();
        const observer = new DisplayObserver(onDisplayed);
        const ro = ResizeObserverMock.instances[0];
        const first = createElement(0);
        const second = createElement(0);

        observer.waitForDisplay(first);
        observer.waitForDisplay(second);
        setHeight(first, 50);
        ro.resize();

        expect(onDisplayed).not.toHaveBeenCalled();
    });

    it('should wait again for the same element after it was displayed', () => {
        const onDisplayed = jest.fn();
        const observer = new DisplayObserver(onDisplayed);
        const ro = ResizeObserverMock.instances[0];
        const element = createElement(0);

        observer.waitForDisplay(element);
        setHeight(element, 50);
        ro.resize();

        setHeight(element, 0);
        observer.waitForDisplay(element);
        setHeight(element, 50);
        ro.resize();

        expect(onDisplayed).toHaveBeenCalledTimes(2);
    });

    it('should not call the callback after stop', () => {
        const onDisplayed = jest.fn();
        const observer = new DisplayObserver(onDisplayed);
        const ro = ResizeObserverMock.instances[0];
        const element = createElement(0);

        observer.waitForDisplay(element);
        observer.stop();
        setHeight(element, 50);
        ro.resize();

        expect(onDisplayed).not.toHaveBeenCalled();
        expect(ro.observed.size).toBe(0);
    });

    it('should do nothing without ResizeObserver support', () => {
        globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;
        const observer = new DisplayObserver(jest.fn());

        expect(() => {
            observer.waitForDisplay(createElement(0));
            observer.stop();
        }).not.toThrow();
    });
});
