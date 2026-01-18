import { nothing } from 'lit';
import { html, unsafeStatic } from 'lit/static-html.js';
import { styleMap } from 'lit-html/directives/style-map.js';
import { HueLikeLightCardConfig } from '../types/config';
import { Consts } from '../types/consts';
import { Action } from '../types/functions';
import { ThemeHelper } from '../types/theme-helper';
import { ILightContainer } from '../types/types-interface';
import { Background } from './colors/background';
import { Color } from './colors/color';
import { HaIcon, IHassWindow } from '../types/types-hass';
import { SliderType } from '../types/types-config';
import { HueMushroomSliderContainer } from '../controls/mushroom-slider-container';
import { HomeAssistant } from '../ha/types';
import { HassEntity } from 'home-assistant-js-websocket';
import { computeStateDisplay } from '../ha/common/entity/compute_state_display';

export class ViewUtils {

    /**
     * Creates switch for given ILightContainer.
     * @param onChange Be careful - this function is called on different scope, better pack your function to arrow call.
     */
    public static createSwitch(ctrl: ILightContainer, onChange: Action, switchOnScene?: string) {
        // To help change themes on the fly
        const styles = ThemeHelper.getSwitchThemeStyle();

        return html`
        <ha-switch
            .checked=${ctrl.isOn()}
            .disabled=${ctrl.isUnavailable()}
            .haptic=true
            style=${styleMap(styles)}
            @change=${(ev: Event) => ViewUtils.changed(ev, false, ctrl, onChange, switchOnScene)}
        ></ha-switch>`;
    }

    /**
     * Creates slider for given ILightContainer and config.
     * @param onChange Be careful - this function is called on different scope, better pack your function to arrow call.
     */
    public static createSlider(ctrl: ILightContainer, config: HueLikeLightCardConfig, onChange: Action) {

        // If the controller doesn't support brightness change or slider is disabled, the slider will not be created
        if (!ctrl.features.brightness || config.slider == SliderType.None)
            return nothing;

        const min = config.allowZero ? 0 : 1;
        const max = 100;
        const step = 1;

        if (config.slider == SliderType.Mushroom) {
            return html`
                <${unsafeStatic(HueMushroomSliderContainer.ElementName)}
                    class="brightness-slider"
                    .min=${min}
                    .max=${max}
                    .step=${step}
                    .disabled=${config.allowZero ? ctrl.isUnavailable() : ctrl.isOff()}
                    .value=${ctrl.brightnessValue}
                    .showActive=${true}
                    @change=${(ev: Event) => ViewUtils.changed(ev, true, ctrl, onChange)}
                />`;

            // @current-change=${this.onCurrentChange}
        }

        return html`
        <ha-slider pin ignore-bar-touch
            class="brightness-slider"
            .min=${min}
            .max=${max}
            .step=${step}
            .disabled=${config.allowZero ? ctrl.isUnavailable() : ctrl.isOff()}
            .value=${ctrl.brightnessValue}
            @change=${(ev: Event) => ViewUtils.changed(ev, true, ctrl, onChange)}
        ></ha-slider>`;
    }

    private static changed(ev: Event, isSlider: boolean, ctrl: ILightContainer, onChange: Action, switchOnScene?: string) {

        // TODO: try to update on sliding (use throttle) not only on change. (https://www.webcomponents.org/element/@polymer/paper-slider/elements/paper-slider#events)

        const target = ev.target;
        if (!target)
            return;

        if (isSlider) {
            const value = (target as HTMLInputElement).value;
            if (value != null) {
                ctrl.brightnessValue = parseInt(value);
            }
        }
        else { // isToggle
            const checked = (target as HTMLInputElement).checked;
            if (checked) {
                ctrl.turnOn(switchOnScene);
            }
            else {
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
     * @param defaultColor Default color, if light does not provide his color.
     */
    public static calculateBackAndForeground(ctrl: ILightContainer, offBackground: Background | null, assumeShadow = true, defaultColor: Background | null = offBackground) {
        const currentBackground = ctrl.isOff() ? offBackground : (ctrl.getBackground() || defaultColor || offBackground);

        let foreground: Color | null;
        if (currentBackground == null) {
            foreground = null;
        }
        else {
            const fgx = ViewUtils.calculateForeground(ctrl, currentBackground, assumeShadow);
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
    private static calculateForeground(ctrl: ILightContainer, currentBackground: Background, assumeShadow = true) {

        let currentValue = ctrl.brightnessValue;
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
            }
            else {
                foreground = Consts.LightOffColor;
            }
        }

        return {
            foreground: foreground,
            opacity: opacity
        };
    }

    /**
     * Calculates default shadow for passed element, using passed ILightContainer state and config.
     */
    public static calculateDefaultShadow(element: Element, ctrl: ILightContainer, useOffShadow: boolean): string {
        if (ctrl.isOff())
            return useOffShadow ? 'inset 0px 0px 10px rgba(0,0,0,0.2)' : '0px 0px 0px white';

        const card = element;
        if (!card || !card.clientHeight)
            return '';
        const darkness = 100 - ctrl.brightnessValue;
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

    /** Will return whether hue custom icons (https://github.com/arallsopp/hass-hue-icons) are installed */
    public static hasHueIcons(): boolean {
        const haWindow = (window as IHassWindow);

        return !!haWindow.customIcons && typeof haWindow.customIcons.hue == 'object';
    }

    /** Will set size of icon inside of HaIcon */
    public static setIconSize(haIcon: HaIcon, sizePx: number) {
        sizePx = Math.round(sizePx);
        if (haIcon?.updateComplete) {
            // wait for render
            haIcon.updateComplete.then(() => {
                const innerIcon = <HTMLElement>haIcon.renderRoot.children[0];
                innerIcon.style.setProperty('--mdc-icon-size', sizePx + 'px');
            });
        }
    }

    /** Shortcut for native computeStateDisplay function */
    public static computeStateDisplay(entity: HassEntity, hass: HomeAssistant){
        if (hass.localize != null) {
            return computeStateDisplay(hass.localize, entity, hass.locale, [], hass.config, hass.entities);
        }

        return entity.state;
    }
}