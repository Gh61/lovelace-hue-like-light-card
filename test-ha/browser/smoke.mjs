/**
 * Smoke test of the dev build in the testing Home Assistant instance:
 * every view of the testing dashboard renders all cards without configuration errors,
 * tapping the first card opens the Hue dialog, and the console stays free of card errors.
 * Run with `npm run ha-test -- smoke`. Screenshots go to test-ha/browser/out/ (ignored by git).
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardErrors, cardPoint, countCards, errorCards, isDialogOpen, openBrowser, openView, tap } from './helpers.mjs';

const OutDir = join(dirname(fileURLToPath(import.meta.url)), 'out');
const Views = { basic: 4, 'hue-screen': 3, styles: 5, actions: 5 };

mkdirSync(OutDir, { recursive: true });
const { browser, page, errors } = await openBrowser();
let failed = false;

const check = (ok, message) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
    failed ||= !ok;
};

for (const [view, expectedCards] of Object.entries(Views)) {
    await openView(page, view);
    const cards = await countCards(page);
    const configErrors = await errorCards(page);
    await page.screenshot({ path: join(OutDir, `${view}.png`), fullPage: true });
    check(cards === expectedCards, `view "${view}": ${cards}/${expectedCards} cards rendered`);
    check(configErrors.length === 0, `view "${view}": no configuration errors${configErrors.length ? ` (${configErrors.join(' | ')})` : ''}`);
}

await openView(page, 'basic');
await tap(page, await cardPoint(page, 0, '.tap-area'));
await page.waitForTimeout(1500);
check(await isDialogOpen(page), 'tap on the first card opens the Hue dialog');
await page.screenshot({ path: join(OutDir, 'dialog.png') });

await page.goBack();
await page.waitForTimeout(1000);
check(!(await isDialogOpen(page)), 'browser back closes the Hue dialog');

const relevantErrors = cardErrors(errors);
check(relevantErrors.length === 0, `console errors: ${relevantErrors.length ? relevantErrors.join(' | ') : 'none'}`);

await browser.close();
process.exitCode = failed ? 1 : 0;
