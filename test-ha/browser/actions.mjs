/**
 * Card actions (`tap_action` & co.) in the testing Home Assistant instance, view `actions`:
 * toggle through the controller, HA navigate, state dependent scene / turn-off, double tap with delayed tap,
 * deprecated `onClickAction` options. Run with `npm run ha-test -- actions`.
 */

import { cardErrors, cardPointByTitle, doubleTap, hold, isDialogOpen, isMoreInfoOpen, openBrowser, openView, tap } from './helpers.mjs';

const { browser, page, errors } = await openBrowser();
let failed = false;
const check = (ok, message) => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${message}`);
    failed ||= !ok;
};
const settle = (ms = 1500) => page.waitForTimeout(ms);
const state = (entityId) => page.evaluate((id) => document.querySelector('home-assistant').hass.states[id]?.state, entityId);
const turn = (entityId, on) => page.evaluate(([id, service]) => document.querySelector('home-assistant').hass.callService('light', service, { entity_id: id }), [entityId, on ? 'turn_on' : 'turn_off']);
const closeDialogs = async () => {
    await page.keyboard.press('Escape');
    await settle(1200);
};

await openView(page, 'actions');

// card 0: toggle on tap (controller), hue-screen on hold
await turn('light.bed_light', false); await settle();
await tap(page, await cardPointByTitle(page, 'Toggle on tap', '.tap-area')); await settle();
check(await state('light.bed_light') === 'on', `tap toggles the light on (${await state('light.bed_light')})`);
await tap(page, await cardPointByTitle(page, 'Toggle on tap', '.tap-area')); await settle();
check(await state('light.bed_light') === 'off', `tap toggles the light off (${await state('light.bed_light')})`);
await hold(page, await cardPointByTitle(page, 'Toggle on tap', '.tap-area')); await settle();
check(await isDialogOpen(page), 'hold opens the Hue screen');
await closeDialogs();

// card 1: navigate on tap (executed by HA)
await tap(page, await cardPointByTitle(page, 'Navigate on tap', '.tap-area')); await settle();
check(page.url().endsWith('/lovelace-testing/basic'), `navigate action changed the view (${page.url()})`);
await openView(page, 'actions');

// card 2: tap none, double tap more-info
await tap(page, await cardPointByTitle(page, 'Double tap more-info', '.tap-area')); await settle();
check(!(await isDialogOpen(page)) && !(await isMoreInfoOpen(page)), 'tap with action none does nothing');
await doubleTap(page, await cardPointByTitle(page, 'Double tap more-info', '.tap-area')); await settle();
check(await isMoreInfoOpen(page), 'double tap opens more-info');
await closeDialogs();

// card 3: scene when off, turn-off when on
await turn('light.bed_light', false); await turn('light.ceiling_lights', false); await turn('light.kitchen_lights', false); await settle();
await tap(page, await cardPointByTitle(page, 'Scene by state', '.tap-area')); await settle(2500);
check(await state('light.ceiling_lights') === 'on' && await state('light.kitchen_lights') === 'on', 'off_tap_action activates the scene');
await tap(page, await cardPointByTitle(page, 'Scene by state', '.tap-area')); await settle(2500);
check(await state('light.ceiling_lights') === 'off' && await state('light.kitchen_lights') === 'off', 'on_tap_action turns the lights off');

// card 4: deprecated options
await turn('light.office_rgbw_lights', false); await settle();
await tap(page, await cardPointByTitle(page, 'Deprecated options', '.tap-area')); await settle();
check(await state('light.office_rgbw_lights') === 'on', 'deprecated offClickAction turn-on works');
await tap(page, await cardPointByTitle(page, 'Deprecated options', '.tap-area')); await settle();
check(await state('light.office_rgbw_lights') === 'off', 'deprecated onClickAction turn-off works');
await turn('light.office_rgbw_lights', true); await settle();
await hold(page, await cardPointByTitle(page, 'Deprecated options', '.tap-area')); await settle();
check(await isMoreInfoOpen(page), 'deprecated onHoldAction more-info with onHoldData opens more-info');
await closeDialogs();

const relevantErrors = cardErrors(errors);
check(relevantErrors.length === 0, `console errors: ${relevantErrors.length ? relevantErrors.join(' | ') : 'none'}`);

await browser.close();
process.exitCode = failed ? 1 : 0;
