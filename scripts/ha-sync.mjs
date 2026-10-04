#!/usr/bin/env node
/**
 * ha-sync - keeps the Home Assistant frontend source copied into `src/ha/` in sync with upstream.
 *
 * The manifest `src/ha/ha-sync.json` lists the upstream repository, the synced commit and the copied files
 * (paths relative to the upstream `src/`; the local copy lives at `src/ha/<path>`).
 *
 * Commands:
 *   node scripts/ha-sync.mjs check [<ref>]
 *       Compares the local `src/ha/` with upstream at the manifest commit (or at <ref>) and lists
 *       identical / locally modified / missing files. Exit code 1 when anything differs.
 *   node scripts/ha-sync.mjs update <ref>
 *       Writes pristine copies of all manifest files at <ref> into the vendor branch `ha-upstream`
 *       (temporary worktree, one commit) together with the updated manifest.
 *       Merge the vendor branch into the development branch afterwards: `git merge ha-upstream`.
 *       Git then does a 3-way merge, so local adaptations in `src/ha/` survive upstream changes.
 *
 * <ref> is a commit sha, tag or branch of the upstream repository (e.g. `dev`, `20260101.0`).
 * The upstream repository is cached in `node_modules/.cache/ha-frontend` (partial clone, sparse checkout).
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LocalDir = join(RepoRoot, 'src', 'ha');
const ManifestPath = join(LocalDir, 'ha-sync.json');
const CacheDir = join(RepoRoot, 'node_modules', '.cache', 'ha-frontend');
const VendorBranch = 'ha-upstream';
const UpstreamSrc = 'src';

function git(args, cwd = RepoRoot, options = {}) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], ...options }).trimEnd();
}

function readManifest() {
    return JSON.parse(readFileSync(ManifestPath, 'utf8'));
}

function writeManifest(path, manifest) {
    writeFileSync(path, JSON.stringify(manifest, null, 4) + '\n');
}

/** Makes sure the upstream cache exists and contains <ref>; returns the resolved full commit sha. */
function fetchUpstream(manifest, ref) {
    if (!existsSync(join(CacheDir, '.git'))) {
        mkdirSync(CacheDir, { recursive: true });
        git(['init', '-q'], CacheDir);
        git(['remote', 'add', 'origin', manifest.repository], CacheDir);
        git(['sparse-checkout', 'init', '--no-cone'], CacheDir);
    }
    console.log(`Fetching ${ref} from ${manifest.repository} ...`);
    git(['fetch', '-q', '--depth=1', '--filter=blob:none', 'origin', ref], CacheDir);
    return git(['rev-parse', 'FETCH_HEAD'], CacheDir);
}

/** Checks out exactly the manifest files at <commit> into the cache working tree (one batched blob fetch). */
function checkoutUpstreamFiles(manifest, commit) {
    const patterns = manifest.files.map(file => `/${UpstreamSrc}/${file}`);
    git(['sparse-checkout', 'set', '--no-cone', '--stdin'], CacheDir, { input: patterns.join('\n') + '\n', stdio: ['pipe', 'pipe', 'inherit'] });
    git(['checkout', '-q', '--detach', commit], CacheDir);
}

function readUpstreamFile(file) {
    const path = join(CacheDir, UpstreamSrc, file);
    return existsSync(path) ? readFileSync(path) : null;
}

function readLocalFile(file) {
    const path = join(LocalDir, file);
    return existsSync(path) ? readFileSync(path) : null;
}

function printList(title, items) {
    if (!items.length)
        return;
    console.log(`\n${title} (${items.length}):`);
    items.forEach(item => console.log(`  ${item}`));
}

function check(manifest, ref) {
    const commit = fetchUpstream(manifest, ref ?? manifest.commit);
    checkoutUpstreamFiles(manifest, commit);

    const identical = [];
    const modified = [];
    const missingLocal = [];
    const missingUpstream = [];
    for (const file of manifest.files) {
        const upstream = readUpstreamFile(file);
        const local = readLocalFile(file);
        if (!upstream)
            missingUpstream.push(file);
        else if (!local)
            missingLocal.push(file);
        else if (upstream.equals(local))
            identical.push(file);
        else
            modified.push(file);
    }

    console.log(`\nCompared src/ha with upstream ${commit.slice(0, 9)}${ref ? '' : ' (manifest commit)'}:`);
    console.log(`  identical: ${identical.length}`);
    printList('Locally modified', modified);
    printList('Missing locally', missingLocal);
    printList('Missing upstream (removed or moved in HA)', missingUpstream);

    const differences = modified.length + missingLocal.length + missingUpstream.length;
    process.exitCode = differences ? 1 : 0;
}

function update(manifest, ref) {
    if (!ref)
        throw new Error('update needs an upstream <ref> (commit, tag or branch)');
    if (git(['status', '--porcelain', '--', 'src/ha']))
        throw new Error('src/ha has uncommitted changes - commit or stash them first');

    const commit = fetchUpstream(manifest, ref);
    checkoutUpstreamFiles(manifest, commit);

    const missingUpstream = manifest.files.filter(file => !readUpstreamFile(file));
    if (missingUpstream.length) {
        printList('Missing upstream (removed or moved in HA) - fix the manifest first', missingUpstream);
        throw new Error('some manifest files do not exist upstream');
    }

    const branchExists = !!git(['branch', '--list', VendorBranch]);
    const worktree = mkdtempSync(join(tmpdir(), 'ha-upstream-'));
    try {
        // the vendor branch starts from the current HEAD, so the first sync records the baseline for 3-way merges
        git(['worktree', 'add', '-q', ...(branchExists ? [] : ['-b', VendorBranch]), worktree, branchExists ? VendorBranch : 'HEAD']);

        const added = [];
        const changed = [];
        for (const file of manifest.files) {
            const target = join(worktree, 'src', 'ha', file);
            const content = readUpstreamFile(file);
            if (!existsSync(target))
                added.push(file);
            else if (!readFileSync(target).equals(content))
                changed.push(file);
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, content);
        }
        const removed = git(['ls-files', 'src/ha'], worktree).split('\n')
            .map(path => path.slice('src/ha/'.length))
            .filter(file => file && file !== 'ha-sync.json' && !manifest.files.includes(file));
        removed.forEach(file => rmSync(join(worktree, 'src', 'ha', file)));

        writeManifest(join(worktree, 'src', 'ha', 'ha-sync.json'), { ...manifest, commit });

        git(['add', '-A', 'src/ha'], worktree);
        if (!git(['status', '--porcelain'], worktree)) {
            console.log(`\n${VendorBranch} is already in sync with ${commit.slice(0, 9)} - nothing to commit.`);
            return;
        }
        git(['commit', '-q', '-m', `build(ha): sync HA frontend source to ${commit.slice(0, 9)}`], worktree);

        console.log(`\nCommitted upstream ${commit.slice(0, 9)} to branch ${VendorBranch}.`);
        printList('Added', added);
        printList('Changed', changed);
        printList('Removed (no longer in manifest)', removed);
        console.log(`\nNext step: git merge ${VendorBranch}`);
    }
    finally {
        git(['worktree', 'remove', '--force', worktree]);
    }
}

const [command, ref] = process.argv.slice(2);
try {
    const manifest = readManifest();
    switch (command) {
        case 'check':
            check(manifest, ref);
            break;
        case 'update':
            update(manifest, ref);
            break;
        default:
            console.log('Usage: ha-sync check [<ref>] | ha-sync update <ref>');
            process.exitCode = 2;
    }
}
catch (error) {
    console.error(`ha-sync: ${error.message}`);
    process.exitCode = 1;
}
