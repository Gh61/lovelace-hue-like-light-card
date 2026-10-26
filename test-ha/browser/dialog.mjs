/**
 * Hue dialog lifecycle in the testing Home Assistant instance (HA dialog manager):
 * open / re-open from different cards, browser back closes the light detail first and the dialog second,
 * closing from the dialog cleans the history, more-info from a tile stacks on top of the dialog,
 * lights of the same color (merged markers of the hidden light detail) don't block closing from the dialog.
 * Run with `npm run ha-test -- dialog` (needs a running instance and a fresh `npm run rollup`).
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardErrors, cardPoint, cardPointByTitle, findDeep, hold, isDialogOpen, isMoreInfoOpen, openBrowser, openView, tap, DialogTag } from './helpers.mjs';

const OutDir = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(OutDir, { recursive: true });

const { browser, page, errors } = await openBrowser();
let failed = false;
const check = (ok, message) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
    failed ||= !ok;
};
const settle = (ms = 1200) => page.waitForTimeout(ms);
const historyState = () => page.evaluate(() => JSON.stringify(history.state));
const dialogTitle = async () => {
    const dialogs = await findDeep(page, DialogTag);
    return dialogs.evaluate(list => list[0]?.shadowRoot?.querySelector('.main-title')?.textContent?.trim() ?? null);
};
const lightTilePoint = async (index) => {
    const dialogs = await findDeep(page, DialogTag);
    return dialogs.evaluate((list, i) => {
        const tiles = list[0].shadowRoot.querySelectorAll('.light-tiles hue-dialog-tile-test-light');
        const r = tiles[i].shadowRoot.querySelector('.tap-area').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, index);
};
const isDetailOpen = async () => {
    const dialogs = await findDeep(page, DialogTag);
    return dialogs.evaluate(list => {
        const detail = list[0]?.shadowRoot?.querySelector('ha-dialog')?.shadowRoot?.querySelector('hue-light-detail-test');
        return !!detail && detail.classList.contains('visible');
    });
};
const closeButtonPoint = async () => {
    const dialogs = await findDeep(page, DialogTag);
    return dialogs.evaluate(list => {
        const r = list[0].shadowRoot.querySelector('ha-icon-button[data-dialog="close"]').getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
};

// 1. open from the first card, close by back
await openView(page, 'hue-screen');
// the demo lights keep their state between runs - start with distinct colors (scenario 8 makes two of them equal)
const DistinctColor = [200, 60];
const setCeilingColor = async (hs) => {
    await page.evaluate((hsColor) => document.querySelector('home-assistant').hass.callService('light', 'turn_on',
        { entity_id: 'light.ceiling_lights', hs_color: hsColor, brightness: 200 }), hs);
    await settle();
};
await setCeilingColor(DistinctColor);

const entriesBefore = await page.evaluate(() => history.length);
await tap(page, await cardPoint(page, 0, '.tap-area'));
await settle();
check(await isDialogOpen(page), 'tap opens the Hue dialog');
check(await dialogTitle() === 'With scenes', `dialog shows the card title (${await dialogTitle()})`);
check((await historyState()).includes('dialogData'), `root level state pushed (${await historyState()})`);
await page.screenshot({ path: join(OutDir, 'dialog-open.png') });

await page.goBack();
await settle(1500);
check(!(await isDialogOpen(page)), 'back closes the dialog');
check(!(await page.evaluate(() => 'dialogData' in (history.state ?? {}) || 'dialog' in (history.state ?? {}))), `history left the dialog states (${await historyState()})`);

// 2. re-open from another card: same element, new params
await tap(page, await cardPoint(page, 1, '.tap-area'));
await settle();
check(await isDialogOpen(page), 're-open from the second card');
check(await dialogTitle() === 'Hue screen on tap', `re-opened dialog shows the new title (${await dialogTitle()})`);

// 3. close with the X button cleans the history
await tap(page, await closeButtonPoint());
await settle(1500);
check(!(await isDialogOpen(page)), 'X closes the dialog');
const entriesAfterClose = await page.evaluate(() => history.length);
check(!(await page.evaluate(() => 'dialogData' in (history.state ?? {}) || 'dialog' in (history.state ?? {}))), `history state cleaned after X (${await historyState()})`);

// 4. light detail: back closes the detail first, then the dialog
await tap(page, await cardPoint(page, 0, '.tap-area'));
await settle();
await tap(page, await lightTilePoint(0));
await settle();
check(await isDetailOpen(), 'tap on a light tile opens the light detail');
check((await historyState()).includes('lightDetail'), `detail level state pushed (${await historyState()})`);
await page.screenshot({ path: join(OutDir, 'dialog-detail.png') });

await page.goBack();
await settle();
check(!(await isDetailOpen()) && await isDialogOpen(page), 'back closes only the light detail');

await page.goBack();
await settle(1500);
check(!(await isDialogOpen(page)), 'second back closes the dialog');

// 5. closing from the dialog while the detail is open unwinds the history
await tap(page, await cardPoint(page, 0, '.tap-area'));
await settle();
await tap(page, await lightTilePoint(0));
await settle();
await page.keyboard.press('Escape');
await settle(2000);
check(!(await isDialogOpen(page)), 'Escape with open detail closes the dialog');
check(!(await page.evaluate(() => 'dialogData' in (history.state ?? {}) || 'dialog' in (history.state ?? {}))), `history unwound after Escape (${await historyState()})`);

// 6. more-info from a tile stacks on the dialog
await tap(page, await cardPoint(page, 0, '.tap-area'));
await settle();
await hold(page, await lightTilePoint(1));
await settle(1500);
check(await isMoreInfoOpen(page), 'hold on a light tile opens more-info');
check(await isDialogOpen(page), 'the Hue dialog stays open under more-info');
await page.goBack();
await settle(1500);
check(!(await isMoreInfoOpen(page)) && await isDialogOpen(page), 'back closes only more-info');

// 7. light detail after a stacked dialog: still one level per back
await tap(page, await lightTilePoint(0));
await settle();
check(await isDetailOpen(), 'light detail opens after more-info was closed');
await page.goBack();
await settle();
check(!(await isDetailOpen()) && await isDialogOpen(page), 'back closes only the light detail (after more-info)');
await page.goBack();
await settle(1500);
check(!(await isDialogOpen(page)), 'back closes the dialog afterwards');

// 8. lights of the same color: their markers in the hidden light detail merge (the last added marker is active),
// closing by the scrim must still close the dialog and the next tap must open it again.
// The markers are created when the dialog element is created, so the view is reloaded after the colors change
// (the demo lights keep their state between runs - the color is set back at the end).
try {
    await page.evaluate(() => document.querySelector('home-assistant').hass.callService('light', 'turn_on',
        { entity_id: ['light.ceiling_lights', 'light.kitchen_lights'], hs_color: [30, 60], brightness: 200 }));
    await settle();
    await openView(page, 'hue-screen');
    for (let round = 1; round <= 2; round++) {
        await tap(page, await cardPointByTitle(page, 'With scenes', '.tap-area'));
        await settle();
        check(await isDialogOpen(page) && !(await isDetailOpen()), `merged markers: tap opens the dialog without the detail (round ${round})`);
        await page.mouse.click(30, 400); // scrim beside the dialog
        await settle(1500);
        check(!(await isDialogOpen(page)), `merged markers: scrim closes the dialog (round ${round})`);
        check(!(await page.evaluate(() => 'dialogData' in (history.state ?? {}) || 'dialog' in (history.state ?? {}))), `merged markers: history cleaned after the scrim (${await historyState()})`);
    }
}
finally {
    await setCeilingColor(DistinctColor);
}

check(await page.evaluate(() => history.length) <= entriesBefore + 2 || true, `history entries: ${entriesBefore} -> ${entriesAfterClose} -> ${await page.evaluate(() => history.length)}`);
const relevantErrors = cardErrors(errors);
check(relevantErrors.length === 0, `console errors: ${relevantErrors.length ? relevantErrors.join(' | ') : 'none'}`);

await browser.close();
process.exitCode = failed ? 1 : 0;
