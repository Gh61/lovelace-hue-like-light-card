/**
 * #398 - an area / floor with a disabled light entity: the Area and Floor cards render the remaining lights instead of
 * failing with "Entity ... not found in states". Disables `light.bed_light` (area living_room, floor ground_floor)
 * through the HA WebSocket API for the test and enables it again at the end (HA re-adds the entity after ~30 s).
 * HA 2026.9 already leaves disabled entities out of `search/related`; the card's own filter (with a console warning)
 * is verified only when the search result still contains the entity (older HA).
 * Run with `npm run ha-test -- area-disabled`.
 */

import { cardErrors, findDeep, openBrowser, openView } from './helpers.mjs';

const DisabledEntity = 'light.bed_light';
const GroupCards = ['Area', 'Floor'];

const { browser, page, errors } = await openBrowser();
const warnings = [];
page.on('console', m => {
    if (m.type() === 'warning')
        warnings.push(m.text());
});
let failed = false;

const check = (ok, message) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
    failed ||= !ok;
};

const callWs = (message) => page.evaluate(m => document.querySelector('home-assistant').hass.callWS(m), message);

/** Enables/disables `DisabledEntity` in the entity registry. */
const setDisabled = (disabled) => callWs({ type: 'config/entity_registry/update', entity_id: DisabledEntity, disabled_by: disabled ? 'user' : null });

/** Waits until `DisabledEntity` is (not) present in `hass.states`. */
const waitForState = (present, timeout) => page.waitForFunction(
    ([entityId, expected]) => !!document.querySelector('home-assistant').hass.states[entityId] === expected,
    [DisabledEntity, present], { timeout, polling: 1000 });

/** Ids of the lights rendered by the given cards (from their controllers); null when a card did not render. */
const cardLights = async () => {
    const cards = await findDeep(page, 'hue-like-light-card-test');
    return cards.evaluate((list, titles) => Object.fromEntries(titles.map(title => {
        const card = list.find(c => c.shadowRoot?.querySelector('h2')?.textContent?.trim() === title);
        return [title, card?._ctrl?.getLights().map(l => l.getEntityId()) ?? null];
    })), GroupCards);
};

await openView(page, 'styles');
let lights = await cardLights();
for (const title of GroupCards)
    check(lights[title]?.includes(DisabledEntity), `${title} card contains ${DisabledEntity} before the test (${lights[title]?.join(', ')})`);

try {
    await setDisabled(true);
    await waitForState(false, 15_000);
    const search = await callWs({ type: 'search/related', item_type: 'area', item_id: 'living_room' });
    const searchHasDisabled = (search.entity ?? []).includes(DisabledEntity);
    console.log(`INFO search/related ${searchHasDisabled ? 'still returns' : 'leaves out'} the disabled entity`);

    await openView(page, 'styles');
    await page.waitForTimeout(1500);
    lights = await cardLights();
    for (const title of GroupCards)
        check(Array.isArray(lights[title]) && lights[title].length > 0 && !lights[title].includes(DisabledEntity),
            `${title} card renders the remaining lights (${lights[title]?.join(', ') ?? 'not rendered'})`);

    const warning = warnings.find(w => w.includes('skipping entities without a state') && w.includes(DisabledEntity));
    if (searchHasDisabled)
        check(!!warning, `console warning names the skipped entity${warning ? '' : ` (warnings: ${warnings.join(' | ') || 'none'})`}`);
    else
        check(!warning, 'no skipped-entity warning when the search result has no disabled entity');
}
finally {
    await setDisabled(false);
    await waitForState(true, 90_000);
}

await openView(page, 'styles');
lights = await cardLights();
for (const title of GroupCards)
    check(lights[title]?.includes(DisabledEntity), `${title} card contains ${DisabledEntity} again after the test`);

// the "Templates" card lists the disabled entity explicitly - its "not found in states" error is expected while disabled
const relevantErrors = cardErrors(errors).filter(e => !e.includes(`'${DisabledEntity}' not found in states`));
check(relevantErrors.length === 0, `console errors: ${relevantErrors.length ? relevantErrors.join(' | ') : 'none'}`);

await browser.close();
process.exitCode = failed ? 1 : 0;
