/**
 * card-mod styling of the Hue dialog: with the theme `card-mod-test` (test-ha/config/themes) active, card-mod must
 * hook the dialog opened through the HA dialog manager (`show-dialog` event) and apply `card-mod-dialog`
 * to its ha-dialog (class `type-hue-dialog-test`); `card-mod-card` must style the cards. Run with `npm run ha-test -- cardmod`.
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardErrors, cardPoint, findDeep, isDialogOpen, openBrowser, openView, tap, DialogTag } from './helpers.mjs';

const OutDir = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(OutDir, { recursive: true });

const { browser, page, errors } = await openBrowser();
let failed = false;
const check = (ok, message) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
    failed ||= !ok;
};
const setTheme = (name) => page.evaluate(async (theme) => {
    const hass = document.querySelector('home-assistant').hass;
    await hass.callService('frontend', 'reload_themes');
    await hass.callService('frontend', 'set_theme', { name: theme });
}, name);
const dialogStyling = async () => {
    const dialogs = await findDeep(page, DialogTag);
    return dialogs.evaluate(list => {
        const haDialog = list[0]?.shadowRoot?.querySelector('ha-dialog');
        const surface = haDialog?.shadowRoot?.querySelector('wa-dialog')?.shadowRoot?.querySelector('[part~="dialog"]');
        return {
            classes: haDialog ? [...haDialog.classList] : [],
            cardModElements: haDialog ? haDialog.querySelectorAll('card-mod').length : 0,
            surfaceBackground: surface ? getComputedStyle(surface).backgroundColor : null,
            surfaceRadius: surface ? getComputedStyle(surface).borderRadius : null
        };
    });
};

await openView(page, 'basic');
check(await page.evaluate(() => !!customElements.get('card-mod')), 'card-mod is loaded');

await setTheme('card-mod-test');
await page.waitForTimeout(2000);
const cards = await findDeep(page, 'hue-like-light-card-test');
const outlined = await cards.evaluate(list => list.filter(c => getComputedStyle(c.shadowRoot.querySelector('ha-card')).outlineColor === 'rgb(10, 100, 10)').length);
check(outlined === await cards.evaluate(l => l.length) && outlined > 0, `theme card-mod-card styles the cards (${outlined})`);
await tap(page, await cardPoint(page, 0, '.tap-area'));
await page.waitForTimeout(2000);
check(await isDialogOpen(page), 'Hue dialog opens with the card-mod theme active');
const styled = await dialogStyling();
check(styled.classes.includes('type-hue-dialog-test'), `card-mod marks the ha-dialog with the dialog type class (${styled.classes.join(' ')})`);
check(styled.cardModElements === 1, `card-mod element attached to the ha-dialog (${styled.cardModElements})`);
check(styled.surfaceBackground === 'rgb(10, 100, 10)', `theme card-mod-dialog style applied to the dialog surface (${styled.surfaceBackground})`);
check(styled.surfaceRadius === '4px', `theme border radius applied (${styled.surfaceRadius})`);
await page.screenshot({ path: join(OutDir, 'card-mod-dialog.png') });

await page.keyboard.press('Escape');
await page.waitForTimeout(1500);
await setTheme('default');
await page.waitForTimeout(2000);
await tap(page, await cardPoint(page, 0, '.tap-area'));
await page.waitForTimeout(2000);
const unstyled = await dialogStyling();
check(unstyled.surfaceBackground !== 'rgb(10, 100, 10)', `default theme: card-mod style removed again (${unstyled.surfaceBackground})`);
await page.keyboard.press('Escape');
await page.waitForTimeout(1000);

const relevantErrors = cardErrors(errors);
check(relevantErrors.length === 0, `console errors: ${relevantErrors.length ? relevantErrors.join(' | ') : 'none'}`);

await browser.close();
process.exitCode = failed ? 1 : 0;
