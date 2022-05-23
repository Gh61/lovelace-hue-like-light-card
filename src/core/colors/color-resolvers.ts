import { Consts } from '../../types/consts';
import { Color } from './color';

export class ColorResolver {
    public static getColor(color_id: string): Color {
        switch (color_id) {
            case 'warm':
                return new Color(Consts.WarmColor);

            case 'cold':
                return new Color(Consts.ColdColor);

            default:
                return new Color(color_id);
        }
    }
}