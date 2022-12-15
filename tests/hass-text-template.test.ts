import { HassTextTemplate, StaticTextTemplate } from "../src/core/hass-text-template"
import { nullString } from "./mockup-general";
import { hassMockup } from "./mockup-hass-states";

describe("HassTextTemplate", () => {

    it("simple text", () => {
        const text = "Simple text template";
        const template = new HassTextTemplate(text);

        expect(template.resolveToString(null)).toBe(text);
    });

    it("empty text", () => {
        const text = "";
        const template = new HassTextTemplate(text);

        expect(template.resolveToString(null)).toBe(text);
    });

    it("single variable (no hass)", () => {
        const templateText = "Status: {{ sensor.my_status }} nice";
        const resultText = "Status:  nice";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(null)).toBe(resultText);
    });

    it("single variable end (no hass)", () => {
        const templateText = "Status: {{ sensor.my_status }}";
        const resultText = "Status: ";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(null)).toBe(resultText);
    });

    it("single variable start (no hass)", () => {
        const templateText = "{{ sensor.my_status }} - nice";
        const resultText = " - nice";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(null)).toBe(resultText);
    });

    it("single variable whole (no hass)", () => {
        const templateText = "{{ sensor.my_status }}";
        const resultText = "";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(null)).toBe(resultText);
    });

    it("unclosed variable", () => {
        const templateText = "Status: {{ sensor.my_status";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(null)).toBe(templateText);
    });

    it("single variable", () => {
        const templateText = "Status: {{ sensor.my_status }} - nice";
        const resultText = "Status: OFF - nice";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(hassMockup)).toBe(resultText);
    });

    it("multiple variable", () => {
        const templateText = "Status: {{ sensor.my_status }} - {{sensor.other_sens}}";
        const resultText = "Status: OFF - On";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(hassMockup)).toBe(resultText);
    });

    it("variable friendly_name attribute", () => {
        const templateText = "Name? {{ sensor.other_sens.friendly_name }}";
        const resultText = "Name? My other sensor";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(hassMockup)).toBe(resultText);
    });

    it("variable string attribute", () => {
        const templateText = "{{ sensor.other_sens.last_state }} was last status";
        const resultText = "Off was last status";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(hassMockup)).toBe(resultText);
    });

    it("variable number attribute", () => {
        const templateText = "v{{sensor.other_sens.version}}";
        const resultText = "v1.023";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(hassMockup)).toBe(resultText);
    });

    it("variable empty attribute fallback", () => {
        const templateText = "Empty atribute (fallback to state): {{sensor.other_sens.empty}} = {{sensor.other_sens}}";
        const resultText = "Empty atribute (fallback to state): On = On";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(hassMockup)).toBe(resultText);
    });

    it("variable missing attribute fallback", () => {
        const templateText = "Missing atr (fallback to state): {{sensor.other_sens.somethings_missing}} = {{sensor.other_sens}}";
        const resultText = "Missing atr (fallback to state): On = On";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(hassMockup)).toBe(resultText);
    });

    it("missing entity error", () => {
        const templateText = "Entity not found: {{sensor.notexisting}}";
        const resultText = "Entity not found: MISS[sensor.notexisting]";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(hassMockup)).toBe(resultText);
    });

    it("missing entity attribute access error", () => {
        const templateText = "Entity not found: {{sensor.notexisting.attri}}";
        const resultText = "Entity not found: MISS[sensor.notexisting]";

        const template = new HassTextTemplate(templateText);
        expect(template.resolveToString(hassMockup)).toBe(resultText);
    });
});

describe("StaticTextTemplate", () => {

    it("simpleText", () => {
        var text = "Test ";
        var template = new StaticTextTemplate(text);

        expect(template.resolveToString()).toBe(text);
    });

    it("should resolve toString", () => {
        var text = "Test 2";
        var template = new StaticTextTemplate(text);

        expect(template + "").toBe(text);
    });

    it("should return null", () => {
        var template = new StaticTextTemplate(nullString);

        expect(template.resolveToString()).toBe(nullString);
    });
})