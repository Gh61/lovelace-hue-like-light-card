import { Color } from './core/colors/color';
import { Consts } from './types/consts';

export class VersionNotifier {
    public static toConsole() {
        const stopColors = [
            new Color('#0046FF'),
            new Color('#9E00FF'),
            new Color('#FF00F3'),
            new Color('#FF0032'),
            new Color('#FF8B00')
        ];

        const textInfo = this.getText();
        const consoleColors = new Array<Color>();
        const segmentSteps = Math.floor(textInfo.colorCount / (stopColors.length - 1));

        for (let i = 0; i < stopColors.length - 1; i++) {
            const color1 = stopColors[i];
            const color2 = stopColors[i + 1];

            const segmentGradient = this.generateGradientArray(color1, color2, segmentSteps);
            consoleColors.push(...segmentGradient);
        }

        while (consoleColors.length < textInfo.colorCount) {
            consoleColors.push(stopColors[stopColors.length - 1]);
        }

        /* eslint no-console: 0 */
        console.info(
            textInfo.result,
            ...consoleColors.map(c => 'font-weight:bold;color:white;background:' + c.toString())
        );
    }

    private static getText() {
        const cardName = Consts.CardElementName.toUpperCase() + ' ' + Consts.Version;
        let result = '%c';
        let colorCount = 1;
        for (let i = 0; i < cardName.length; i++) {
            result += cardName.charAt(i) + '%c';
            colorCount++;
        }

        return {
            result,
            colorCount
        };
    }

    private static generateGradientArray(color1: Color, color2: Color, steps: number): Color[] {
        const gradientArray = [];
        for (let i = 0; i < steps; i++) {
            const factor = i / steps;
            gradientArray.push(this.interpolateColor(color1, color2, factor));
        }
        return gradientArray;
    }

    private static interpolateColor(color1: Color, color2: Color, factor: number): Color {
        const red = Math.round(color1.getRed() + factor * (color2.getRed() - color1.getRed()));
        const green = Math.round(color1.getGreen() + factor * (color2.getGreen() - color1.getGreen()));
        const blue = Math.round(color1.getBlue() + factor * (color2.getBlue() - color1.getBlue()));

        return new Color(red, green, blue);
    }
}