import { html } from 'lit';
import { styleMap } from 'lit-html/directives/style-map.js';
import { HueLikeLightCardConfig } from '../types/config';
import { Consts } from '../types/consts';
import { Action } from '../types/functions';
import { ThemeHelper } from '../types/theme-helper';
import { Background } from './colors/background';
import { Color } from './colors/color';
import { LightController } from './light-controller';

export class ViewUtils {

    /**
     * Creates switch for given lightController.
     * @param onChange Be careful - this function is called on different scope, better pack your function to arrow call.
     */
    public static createSwitch(ctrl: LightController, onChange: Action) {
        // To help change themes on the fly
        const styles = ThemeHelper.getSwitchThemeStyle();

        return html`<ha-switch
        .checked=${ctrl.isOn()}
        .disabled=${ctrl.isUnavailable()}
        .haptic=true
        style=${styleMap(styles)}
        @change=${(ev: Event) => this.changed(ctrl, onChange, false, ev)}
        ></ha-switch>`;
    }

    /**
     * Creates slider for given lightController and config.
     * @param onChange Be careful - this function is called on different scope, better pack your function to arrow call.
     */
    public static createSlider(ctrl: LightController, config: HueLikeLightCardConfig, onChange: Action) {

        // If the controller doesn't support brightness change, the slider will not be created
        if (!ctrl.features.brightness)
            return html``;

        const min = config.allowZero ? 0 : 1;
        const max = 100;
        const step = 1;

        return html`<ha-slider .min=${min} .max=${max} .step=${step} .disabled=${config.allowZero ? ctrl.isUnavailable() : ctrl.isOff()} .value=${ctrl.value}
        pin @change=${(ev: Event) => this.changed(ctrl, onChange, true, ev)}
        ignore-bar-touch
        ></ha-slider>`;
    }

    private static changed(ctrl: LightController, onChange: Action, isSlider: boolean, ev: Event) {

        // TODO: try to update on sliding (use debounce) not only on change. (https://www.webcomponents.org/element/@polymer/paper-slider/elements/paper-slider#events)

        const target = ev.target;
        if (!target)
            return;

        if (isSlider) {
            const value = (target as HTMLInputElement).value;
            if (value != null) {
                ctrl.value = parseInt(value);
            }
        } else { // isToggle
            const checked = (target as HTMLInputElement).checked;
            if (checked) {
                ctrl.turnOn();
            } else {
                ctrl.turnOff();
            }
        }

        // update styles
        onChange();
        //this.updateStyles();
    }

    /**
     * Calculates and returns background and foregound color (for actual light brightness).
     * Creates readable text on background with shadow based on current brightness.
     * @param ctrl Light controller
     * @param offBackground background used when all lights are off (null can be passed, and if used, null bg and fg will be returned)
     * @param assumeShadow If turned off, calculates foreground for max brightness (noShadow).
     */
    public static calculateBackAndForeground(ctrl: LightController, offBackground: Background | null, assumeShadow = true) {
        const currentBackground = ctrl.isOff() ? offBackground : (ctrl.getBackground() || offBackground);

        let foreground: Color | null;
        if (currentBackground == null) {
            foreground = null;
        } else {
            const fgx = this.calculateForeground(ctrl, currentBackground, assumeShadow);
            foreground = fgx.foreground;
        }

        return {
            background: currentBackground,
            foreground: foreground
        };
    }

    /**
     * Calculates and returns foregound color for given background (and actual light brightness).
     * Creates readable text on background with shadow based on current brightness.
     * @param assumeShadow If turned off, calculates foreground for max brightness (noShadow).
     */
    private static calculateForeground(ctrl: LightController, currentBackground: Background, assumeShadow = true) {

        let currentValue = ctrl.value;
        // if the shadow is not present, act like the value is on max.
        if (!assumeShadow) {
            currentValue = 100;
        }

        const opacity = 1;
        const offset = ctrl.isOn() && currentValue > 50
            ? -(10 - ((currentValue - 50) / 5)) // offset: -10-0
            : 0;
        let foreground = ctrl.isOn() && currentValue <= 50
            ? Consts.LightColor // is on and under 50 => Light
            : currentBackground.getForeground(
                Consts.LightColor, // should be light
                Consts.DarkColor, // should be dark
                offset // offset for darker brightness
            );

        // make the dark little lighter, when Off
        if (ctrl.isOff()) {
            if (foreground == Consts.DarkColor) {
                foreground = Consts.DarkOffColor;
            } else {
                foreground = Consts.LightOffColor;
            }
        }

        return {
            foreground: foreground,
            opacity: opacity
        };
    }

    /**
     * Calculates default shadow for passed element, using passed lightController state and config.
     */
    public static calculateDefaultShadow(element: Element, ctrl: LightController, config: HueLikeLightCardConfig): string {
        if (ctrl.isOff())
            return config.disableOffShadow ? '0px 0px 0px white' : 'inset 0px 0px 10px rgba(0,0,0,0.2)';

        const card = element;
        if (!card || !card.clientHeight)
            return '';
        const darkness = 100 - ctrl.value;
        const coef = (card.clientHeight / 100);
        const spread = 20;
        const position = spread + (darkness * 0.95) * coef;
        let width = card.clientHeight / 2;
        if (darkness > 70) {
            width -= (width - 20) * (darkness - 70) / 30; // width: 20-clientHeight/2
        }
        let shadowDensity = 0.65;
        if (darkness > 60) {
            shadowDensity -= (shadowDensity - 0.5) * (darkness - 60) / 40; // shadowDensity: 0.5-0.65
        }

        return `inset 0px -${position}px ${width}px -${spread}px rgba(0,0,0,${shadowDensity})`;
    }
}