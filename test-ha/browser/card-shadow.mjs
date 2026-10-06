/**
 * #424 - the card reads the theme's card shadow through `--ha-card-box-shadow` instead of appending a temporary
 * `ha-card` to `document.body`: no `ha-card` is ever added to the body, the "Plain borders" card (default theme,
 * `hueBorders: false`) shows only its own inset shadow, and the "Theme shadow" card (theme `card-shadow-test`,
 * `hueBorders: false`) shows the theme's shadow on top of it. Run with `npm run ha-test -- card-shadow`.
 */

import { cardErrors, findDeep, openBrowser, openView } from './helpers.mjs';

const { browser, page, errors } = await openBrowser();
let failed = false;

const check = (ok, message) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
    failed ||= !ok;
};

// count `ha-card` elements added directly to the body, from the very start of the page (sub-frames have no body)
await page.addInitScript(() => {
    window.__bodyHaCards = 0;
    const observe = () => new MutationObserver(records => {
        for (const r of records)
            for (const n of r.addedNodes)
                if (n.localName === 'ha-card')
                    window.__bodyHaCards++;
    }).observe(document.body, { childList: true });
    if (document.body)
        observe();
    else
        document.addEventListener('DOMContentLoaded', () => document.body && observe());
});

/** Computed box-shadow of the `ha-card` of the card with the given title. */
const cardShadow = async (title) => {
    const cards = await findDeep(page, 'hue-like-light-card-test');
    return cards.evaluate((list, cardTitle) => {
        const card = list.find(c => c.shadowRoot?.querySelector('h2')?.textContent?.trim() === cardTitle);
        return getComputedStyle(card.shadowRoot.querySelector('ha-card')).boxShadow;
    }, title);
};

await openView(page, 'styles');
await page.waitForTimeout(1500);

const plain = await cardShadow('Plain borders');
const themed = await cardShadow('Theme shadow');
console.log(`INFO default theme: ${plain}`);
console.log(`INFO card-shadow-test theme: ${themed}`);
check(plain.includes('inset') && plain.split('inset').length === 2 && !plain.includes(', rgb'), `default theme: only the card's own inset shadow (${plain})`);
check(themed.includes('inset') && themed.includes('rgb(200, 10, 10) 0px 0px 0px 4px'), 'card-shadow-test theme: own inset shadow plus the theme\'s --ha-card-box-shadow');
check(await page.evaluate(() => window.__bodyHaCards) === 0, 'no ha-card element was appended to document.body');

const relevantErrors = cardErrors(errors);
check(relevantErrors.length === 0, `console errors: ${relevantErrors.length ? relevantErrors.join(' | ') : 'none'}`);

await browser.close();
process.exitCode = failed ? 1 : 0;
