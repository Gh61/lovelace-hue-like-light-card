import { HomeAssistant } from 'custom-card-helpers';
import { IHassTextTemplate } from '../types/types';

class VariableTemplatePart implements IHassTextTemplate {
    private _textOrEntity:string;
    private _attribute:string | null = null;

    public constructor(templatePart:string) {
        // trim variable
        templatePart = templatePart.trim();

        const firstDot = templatePart.indexOf('.');
        const lastDot = templatePart.lastIndexOf('.');

        // if there are 2 different dots, take the string after last dot as attribute selector
        if (firstDot != lastDot) {
            this._textOrEntity = templatePart.substring(0, lastDot);
            this._attribute = templatePart.substring(lastDot + 1);
        } else {
            this._textOrEntity = templatePart;
        }
    }

    public resolveToString(hass:HomeAssistant | null) {
        if (!hass) {
            return '';
        } else {
            const entity = hass.states[this._textOrEntity];
            if (!entity) {
                // error indication
                return 'MISS[' + this._textOrEntity + ']';
            }

            // try resolve attribute
            if (this._attribute && entity.attributes) {
                const atr = entity.attributes[this._attribute];
                if (atr) {
                    return atr.toString();
                }
                // if not found, fallback to state
            }

            return entity.state;
        }
    }
}

/**
 * Static text implementing IHassTextTemplate
 */
export class StaticTextTemplate implements IHassTextTemplate {
    private _text:string;

    public constructor(text:string) {
        this._text = text;
    }

    public resolveToString(_hass: HomeAssistant | null = null): string {
        return this._text;
    }

    public toString() {
        return this.resolveToString();
    }
}

/**
 * HassTextTemplate that allows templated strings - like 'Text {{type.entity}} with attribute: {{ type.entity.attr }}!'
 */
export class HassTextTemplate implements IHassTextTemplate {
    private _templateParts:IHassTextTemplate[];

    /**
     * Creates Text template, that is dependend on hass states.
     */
    public constructor(templateText:string) {
        this._templateParts = HassTextTemplate.parseTemplate(templateText);
    }

    /**
     * Will create string value, where variable parts of this template will be resolved.
     */
    public resolveToString(hass:HomeAssistant | null) {

        // for most cards will be no variable
        if (this._templateParts.length == 1) {
            return this._templateParts[0].resolveToString(hass);
        }

        let result = '';
        this._templateParts.forEach(part => {
            result += part.resolveToString(hass);
        });

        return result;
    }

    private static parseTemplate(templateText:string):IHassTextTemplate[] {
        const result = new Array<IHassTextTemplate>();

        let lastIndex = 0;
        let insideVariable = false;

        while (lastIndex < templateText.length) {
            let index:number;
            if (!insideVariable) {
                // searching for start of variable part
                index = templateText.indexOf('{{', lastIndex);
                if (index < 0)
                    break; // no beginning of variable found

                // create new text part
                const part = templateText.substring(lastIndex, index);
                result.push(new StaticTextTemplate(part));

                // change state to inside variable
                insideVariable = true;
            } else {
                // searching for end of variable part
                index = templateText.indexOf('}}', lastIndex);
                if (index < 0)
                    break; // no ending found

                // create new variable part
                const variablePart = templateText.substring(lastIndex, index);
                result.push(new VariableTemplatePart(variablePart));

                // change state to outside of variable
                insideVariable = false;
            }

            lastIndex = index + 2; // +2 - move index behind the template indicator
        }

        if (insideVariable) {
            //tell user, that last variable is not ended?
            lastIndex -= 2; // fix index of last variable start
        }

        // add remaining string to template collection
        if (lastIndex < templateText.length) {
            const lastPart = templateText.substring(lastIndex);
            result.push(new StaticTextTemplate(lastPart));
        }

        // return collection of template parts
        return result;
    }
}