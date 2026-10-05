#!/usr/bin/env node
/**
 * ha-test - runs a throwaway Home Assistant instance in Docker for browser testing of the dev build.
 *
 * The instance uses the configuration in `test-ha/config/` (demo lights, scenes, the testing dashboard,
 * automatic login from the container host) and serves the dev build from `./dist` as `/local/dist/hue-like-light-card.js`
 * (next to card-mod in `test-ha/www`, the host side of `/config/www`).
 * The HA version comes from `homeAssistantVersion` in `src/ha/ha-sync.json`, so the tests run against the
 * HA release whose frontend source is copied into `src/ha/`.
 *
 * Commands:
 *   node scripts/ha-test.mjs start     Starts the Docker daemon when needed (cloud session), pulls the image
 *                                      when missing, starts the container and waits for the dashboard.
 *   node scripts/ha-test.mjs stop      Removes the container.
 *   node scripts/ha-test.mjs status    Prints whether the instance answers.
 *   node scripts/ha-test.mjs smoke     Runs `test-ha/browser/smoke.mjs` (Playwright) against the running instance.
 *   node scripts/ha-test.mjs dialog    Runs `test-ha/browser/dialog.mjs` (Hue dialog lifecycle, history, stacked more-info).
 *   node scripts/ha-test.mjs cardmod   Runs `test-ha/browser/card-mod.mjs` (card-mod theme styling of the Hue dialog).
 *   node scripts/ha-test.mjs logs      Prints the Home Assistant log of the container.
 *
 * Needs `npm run rollup` (or `npm start`) for the dev build in `./dist`.
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ConfigDir = join(RepoRoot, 'test-ha', 'config');
const DistDir = join(RepoRoot, 'dist');
const ContainerName = 'hue-card-test-ha';
// host side of /config/www (not committed): card-mod.js plus the dev build mounted as /config/www/dist
const WwwDir = join(RepoRoot, 'test-ha', 'www');
// card-mod is installed in the testing instance to check theme styling of dialogs (its source file is the release artifact)
const CardModVersion = 'v4.2.1';
const CardModUrl = `https://raw.githubusercontent.com/thomasloven/lovelace-card-mod/${CardModVersion}/card-mod.js`;
const Port = 8123;
export const BaseUrl = `http://127.0.0.1:${Port}`;
export const DashboardUrl = `${BaseUrl}/lovelace-testing`;
const StartTimeoutMs = 180_000;

function docker(args, options = {}) {
    return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trimEnd();
}

function dockerOk(args) {
    return spawnSync('docker', args, { stdio: 'ignore' }).status === 0;
}

function imageTag() {
    const manifest = JSON.parse(readFileSync(join(RepoRoot, 'src', 'ha', 'ha-sync.json'), 'utf8'));
    if (!manifest.homeAssistantVersion)
        throw new Error('homeAssistantVersion is missing in src/ha/ha-sync.json');
    return `ghcr.io/home-assistant/home-assistant:${manifest.homeAssistantVersion}`;
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function httpStatus(url) {
    try {
        return (await fetch(url, { redirect: 'manual' })).status;
    }
    catch {
        return 0;
    }
}

/** Starts dockerd when no daemon answers (cloud session container); a local machine normally has one running. */
async function ensureDockerDaemon() {
    if (dockerOk(['info']))
        return;
    console.log('Starting the Docker daemon ...');
    const log = openSync('/tmp/dockerd.log', 'a');
    spawn('dockerd', ['--storage-driver=vfs'], { detached: true, stdio: ['ignore', log, log] }).unref();
    for (let i = 0; i < 30; i++) {
        await sleep(1000);
        if (dockerOk(['info']))
            return;
    }
    throw new Error('the Docker daemon did not start (see /tmp/dockerd.log)');
}

function ensureImage(tag) {
    if (dockerOk(['image', 'inspect', tag]))
        return;
    console.log(`Pulling ${tag} (one-time, ~1.5 GB) ...`);
    execFileSync('docker', ['pull', tag], { stdio: 'inherit' });
}

/** Access token of the single user through the trusted_networks login flow (automatic login, no password). */
async function accessToken() {
    const clientId = `${BaseUrl}/`;
    const post = async (url, body, json = true) => {
        const response = await fetch(url, json
            ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
            : { method: 'POST', body: new URLSearchParams(body) });
        if (!response.ok)
            throw new Error(`${url} answered HTTP ${response.status}`);
        return response.json();
    };
    const flow = await post(`${BaseUrl}/auth/login_flow`, { client_id: clientId, handler: ['trusted_networks', null], redirect_uri: clientId });
    if (flow.type !== 'create_entry')
        throw new Error('trusted_networks login did not bypass the user selection - is there exactly one user?');
    const token = await post(`${BaseUrl}/auth/token`, { grant_type: 'authorization_code', code: flow.result, client_id: clientId }, false);
    return token.access_token;
}

/** Minimal Home Assistant WebSocket client: `call(type, data)` resolves with the result. */
async function connectWs(token) {
    const socket = new WebSocket(`${BaseUrl.replace('http', 'ws')}/api/websocket`);
    const pending = new Map();
    let nextId = 1;
    await new Promise((resolve, reject) => {
        socket.onerror = () => reject(new Error('WebSocket connection failed'));
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            switch (message.type) {
                case 'auth_required': socket.send(JSON.stringify({ type: 'auth', access_token: token })); break;
                case 'auth_ok': resolve(); break;
                case 'auth_invalid': reject(new Error('WebSocket auth failed')); break;
                case 'result': {
                    const { resolve: ok, reject: fail } = pending.get(message.id);
                    pending.delete(message.id);
                    message.success ? ok(message.result) : fail(new Error(message.error?.message));
                    break;
                }
            }
        };
    });
    return {
        call: (type, data = {}) => new Promise((resolve, reject) => {
            const id = nextId++;
            pending.set(id, { resolve, reject });
            socket.send(JSON.stringify({ id, type, ...data }));
        }),
        close: () => socket.close()
    };
}

// registry data the dashboard relies on (demo entities have none): floor -> areas -> devices of the lights, one label
const Seed = {
    floor: { name: 'Ground floor', floor_id: 'ground_floor' },
    areas: [
        { name: 'Living room', area_id: 'living_room', entities: ['light.bed_light', 'light.ceiling_lights', 'light.living_room_rgbww_lights'] },
        { name: 'Kitchen', area_id: 'kitchen', entities: ['light.kitchen_lights', 'switch.decorative_lights'] }
    ],
    label: { name: 'Accent', label_id: 'accent', entities: ['light.office_rgbw_lights', 'light.entrance_color_white_lights'] }
};

/** Entity registry entries of the seeded entities; waits until the demo platforms have created them. */
async function waitForSeedEntities(ws) {
    const wanted = [...Seed.areas.flatMap(a => a.entities), ...Seed.label.entities];
    const deadline = Date.now() + 60_000;
    for (;;) {
        const entities = await ws.call('config/entity_registry/list');
        if (wanted.every(id => entities.some(e => e.entity_id === id)))
            return entities;
        if (Date.now() > deadline)
            throw new Error(`demo entities did not appear in the entity registry: ${wanted.filter(id => !entities.some(e => e.entity_id === id)).join(', ')}`);
        await sleep(2000);
    }
}

/** Creates the floor, areas and label of `Seed` and assigns the demo entities (idempotent). */
async function seedRegistry() {
    const ws = await connectWs(await accessToken());
    try {
        const entities = await waitForSeedEntities(ws);
        const floors = await ws.call('config/floor_registry/list');
        if (!floors.some(f => f.floor_id === Seed.floor.floor_id))
            await ws.call('config/floor_registry/create', { name: Seed.floor.name });

        const areas = await ws.call('config/area_registry/list');
        for (const area of Seed.areas) {
            if (!areas.some(a => a.area_id === area.area_id))
                await ws.call('config/area_registry/create', { name: area.name, floor_id: Seed.floor.floor_id });
            for (const entityId of area.entities) {
                const entry = entities.find(e => e.entity_id === entityId);
                if (entry?.device_id)
                    await ws.call('config/device_registry/update', { device_id: entry.device_id, area_id: area.area_id });
            }
        }

        const labels = await ws.call('config/label_registry/list');
        if (!labels.some(l => l.label_id === Seed.label.label_id))
            await ws.call('config/label_registry/create', { name: Seed.label.name });
        for (const entityId of Seed.label.entities)
            await ws.call('config/entity_registry/update', { entity_id: entityId, labels: [Seed.label.label_id] });
    }
    finally {
        ws.close();
    }
}

/** Downloads the card-mod bundle once (test-ha/www is not committed). */
async function ensureCardMod() {
    const file = join(WwwDir, 'card-mod.js');
    if (existsSync(file))
        return file;
    console.log(`Downloading card-mod ${CardModVersion} ...`);
    const response = await fetch(CardModUrl);
    if (!response.ok)
        throw new Error(`card-mod download failed: HTTP ${response.status}`);
    mkdirSync(WwwDir, { recursive: true });
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    return file;
}

async function start() {
    if (!existsSync(join(DistDir, 'hue-like-light-card.js')))
        throw new Error('dist/hue-like-light-card.js is missing - run `npm run rollup` or `npm start` first');
    await ensureDockerDaemon();
    const tag = imageTag();
    ensureImage(tag);
    await ensureCardMod();

    if (dockerOk(['container', 'inspect', ContainerName])) {
        if (await httpStatus(DashboardUrl) === 200) {
            await seedRegistry();
            console.log(`Home Assistant already runs at ${DashboardUrl}`);
            return;
        }
        docker(['rm', '-f', ContainerName]);
    }

    console.log(`Starting ${tag} as ${ContainerName} ...`);
    docker(['run', '-d', '--name', ContainerName,
        '-p', `127.0.0.1:${Port}:8123`,
        '-v', `${ConfigDir}:/config`,
        '-v', `${WwwDir}:/config/www`,
        '-v', `${DistDir}:/config/www/dist:ro`,
        tag]);

    const deadline = Date.now() + StartTimeoutMs;
    while (Date.now() < deadline) {
        if (await httpStatus(DashboardUrl) === 200) {
            await seedRegistry();
            console.log(`Home Assistant is up: ${DashboardUrl}`);
            return;
        }
        await sleep(3000);
    }
    throw new Error(`Home Assistant did not answer within ${StartTimeoutMs / 1000}s - see \`npm run ha-test -- logs\``);
}

function stop() {
    if (dockerOk(['container', 'inspect', ContainerName])) {
        docker(['rm', '-f', ContainerName]);
        console.log(`${ContainerName} removed`);
    }
    else {
        console.log(`${ContainerName} is not running`);
    }
}

async function status() {
    const code = await httpStatus(DashboardUrl);
    console.log(code === 200 ? `running: ${DashboardUrl}` : `not running (HTTP ${code})`);
    process.exitCode = code === 200 ? 0 : 1;
}

function logs() {
    execFileSync('docker', ['logs', ContainerName], { stdio: 'inherit' });
}

async function browserTest(script) {
    if (await httpStatus(DashboardUrl) !== 200)
        throw new Error('Home Assistant is not running - `npm run ha-test -- start` first');
    execFileSync(process.execPath, [join(RepoRoot, 'test-ha', 'browser', `${script}.mjs`)], { stdio: 'inherit' });
}

const command = process.argv[2];
try {
    switch (command) {
        case 'start': await start(); break;
        case 'stop': stop(); break;
        case 'status': await status(); break;
        case 'logs': logs(); break;
        case 'smoke': await browserTest('smoke'); break;
        case 'dialog': await browserTest('dialog'); break;
        case 'cardmod': await browserTest('card-mod'); break;
        default:
            console.log('Usage: ha-test start | stop | status | logs | smoke | dialog | cardmod');
            process.exitCode = 2;
    }
}
catch (error) {
    console.error(`ha-test: ${error.message}`);
    process.exitCode = 1;
}
