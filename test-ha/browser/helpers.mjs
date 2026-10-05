/**
 * Playwright helpers for browser tests against the testing Home Assistant instance (`npm run ha-test -- start`).
 * Used by `smoke.mjs` and by ad-hoc test scripts of the browser-tester agent.
 */

import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

export const BaseUrl = 'http://127.0.0.1:8123';
export const DashboardUrl = `${BaseUrl}/lovelace-testing`;
export const CardTag = 'hue-like-light-card-test';
export const DialogTag = 'hue-dialog-test';

const CloudChromium = '/opt/pw-browsers/chromium'; // pre-installed in Claude Code cloud sessions

/**
 * Launches Chromium and opens a page that collects console errors and page errors.
 * @returns {Promise<{browser: import('playwright').Browser, page: import('playwright').Page, errors: string[]}>}
 */
export async function openBrowser(options = {}) {
    const browser = await chromium.launch({
        ...(existsSync(CloudChromium) ? { executablePath: CloudChromium } : {}),
        args: ['--disable-background-networking']
    });
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, ...options });
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => {
        if (m.type() === 'error')
            errors.push(`console: ${m.text()}`);
    });
    return { browser, page, errors };
}

/** Opens a view of the testing dashboard and waits for the Lovelace view to render. */
export async function openView(page, view) {
    await page.goto(`${DashboardUrl}/${view}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !location.pathname.startsWith('/auth/'), null, { timeout: 20_000 });
    await page.waitForTimeout(1500);
}

/**
 * Finds elements by tag name through all shadow roots.
 * @returns {Promise<import('playwright').JSHandle<Element[]>>}
 */
export function findDeep(page, tag) {
    return page.evaluateHandle((tagName) => {
        const found = [];
        const walk = (root) => {
            for (const el of root.querySelectorAll('*')) {
                if (el.localName === tagName)
                    found.push(el);
                if (el.shadowRoot)
                    walk(el.shadowRoot);
            }
        };
        walk(document);
        return found;
    }, tag);
}

/** Number of rendered cards of the dev build (with their `ha-card` present). */
export async function countCards(page) {
    const cards = await findDeep(page, CardTag);
    return cards.evaluate(list => list.filter(c => c.shadowRoot?.querySelector('ha-card')).length);
}

/** Texts of HA "Configuration error" cards on the page. */
export async function errorCards(page) {
    const cards = await findDeep(page, 'hui-error-card');
    return cards.evaluate(list => list.map(c => (c.shadowRoot?.textContent || c.textContent).replace(/\s+/g, ' ').trim()));
}

/** Center of the element matched by `selector` inside the shadow root of the n-th dev card. */
export async function cardPoint(page, cardIndex, selector) {
    const cards = await findDeep(page, CardTag);
    return cards.evaluate((list, [index, sel]) => {
        const target = list[index].shadowRoot.querySelector(sel);
        const r = target.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, [cardIndex, selector]);
}

/**
 * Center of the element matched by `selector` inside the shadow root of the dev card with the given title
 * (the DOM order of the cards is the masonry column order, not the dashboard order).
 */
export async function cardPointByTitle(page, title, selector) {
    const cards = await findDeep(page, CardTag);
    return cards.evaluate((list, [cardTitle, sel]) => {
        const card = list.find(c => c.shadowRoot?.querySelector('h2')?.textContent?.trim() === cardTitle);
        if (!card)
            throw new Error(`card "${cardTitle}" not found`);
        const r = card.shadowRoot.querySelector(sel).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, [title, selector]);
}

/** Tap (short click) at a point. */
export async function tap(page, point) {
    await page.mouse.click(point.x, point.y);
}

/** Double tap at a point. */
export async function doubleTap(page, point) {
    await page.mouse.dblclick(point.x, point.y);
}

/** Hold (press longer than the HA hold threshold of 500 ms) at a point. */
export async function hold(page, point, ms = 700) {
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
}

/** True when the Hue dialog is open (the element stays in the DOM after closing - the HA dialog manager re-uses it). */
export async function isDialogOpen(page) {
    const dialogs = await findDeep(page, DialogTag);
    return dialogs.evaluate(list => list.some(d => d.shadowRoot?.querySelector('ha-dialog')?.hasAttribute('open')));
}

/** True when the HA more-info dialog is open. */
export async function isMoreInfoOpen(page) {
    const dialogs = await findDeep(page, 'ha-more-info-dialog');
    return dialogs.evaluate(list => list.some(d => [...(d.shadowRoot?.children ?? [])].some(c => c.hasAttribute('open'))));
}

/**
 * Filters out noise that is not related to the card: HA resources, source-map fetches through the proxy,
 * and the `component_name` TypeError that card-mod 4.2.1 triggers in HA 2026.9 (`partial-panel-resolver._updateRoutes`).
 */
export function cardErrors(errors) {
    return errors.filter(e => !/favicon|service-worker|manifest\.json|ERR_CERT_AUTHORITY_INVALID|reading 'component_name'|^pageerror: Object$/.test(e));
}
