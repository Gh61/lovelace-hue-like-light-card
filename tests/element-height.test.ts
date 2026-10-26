import { ElementHeight } from '../src/core/element-height';

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

/** Element counting the reads of its clientHeight. */
function createElement(height: number) {
    const element = document.createElement('div');
    const state = { height, reads: 0 };
    Object.defineProperty(element, 'clientHeight', {
        configurable: true,
        get: () => {
            state.reads++;
            return state.height;
        }
    });
    return { element, state };
}

describe('ElementHeight', () => {
    const originalResizeObserver = globalThis.ResizeObserver;

    beforeEach(() => {
        ResizeObserverMock.instances = [];
        globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
    });

    afterEach(() => {
        globalThis.ResizeObserver = originalResizeObserver;
    });

    it('should measure the height once and then keep it without reading', () => {
        const height = new ElementHeight(jest.fn());
        const { element, state } = createElement(80);

        expect(height.get(element)).toBe(80);
        expect(height.get(element)).toBe(80);
        expect(height.get(element)).toBe(80);

        expect(state.reads).toBe(1);
        expect([...ResizeObserverMock.instances[0].observed]).toEqual([element]);
    });

    it('should call the callback when the element gets displayed or resized', () => {
        const onChange = jest.fn();
        const height = new ElementHeight(onChange);
        const ro = ResizeObserverMock.instances[0];
        const { element, state } = createElement(0);

        expect(height.get(element)).toBe(0);
        ro.resize();
        expect(onChange).not.toHaveBeenCalled();

        state.height = 80;
        ro.resize();
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(height.get(element)).toBe(80);

        state.height = 100;
        ro.resize();
        ro.resize();
        expect(onChange).toHaveBeenCalledTimes(2);
        expect(height.get(element)).toBe(100);
    });

    it('should observe only the last element', () => {
        const onChange = jest.fn();
        const height = new ElementHeight(onChange);
        const ro = ResizeObserverMock.instances[0];
        const first = createElement(10);
        const second = createElement(20);

        height.get(first.element);
        expect(height.get(second.element)).toBe(20);
        expect([...ro.observed]).toEqual([second.element]);

        first.state.height = 50;
        ro.resize();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('should not call the callback after stop', () => {
        const onChange = jest.fn();
        const height = new ElementHeight(onChange);
        const ro = ResizeObserverMock.instances[0];
        const { element, state } = createElement(0);

        height.get(element);
        height.stop();
        state.height = 50;
        ro.resize();

        expect(onChange).not.toHaveBeenCalled();
        expect(ro.observed.size).toBe(0);
    });

    it('should read the height every time without ResizeObserver support', () => {
        globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;
        const height = new ElementHeight(jest.fn());
        const { element, state } = createElement(30);

        expect(height.get(element)).toBe(30);
        state.height = 40;
        expect(height.get(element)).toBe(40);
        expect(() => height.stop()).not.toThrow();
    });
});
