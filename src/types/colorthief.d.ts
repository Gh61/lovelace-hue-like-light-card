declare module 'colorthief' {
    type ColorCT = [number, number, number];
    export default class ColorThief {
        public getColor: (img: HTMLImageElement, quality?: number) => ColorCT;
        public getPalette: (
            img: HTMLImageElement,
            colorCount?: number,
            quality?: number
        ) => ColorCT[];
    }
}