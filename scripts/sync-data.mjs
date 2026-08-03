#!/usr/bin/env node
/**
 * Copy the tracker's game data into static/ so the built site can parse a dropped .plr
 * with no server behind it.
 *
 * Usage: npm run sync-data [-- ../terraria-journey-tracker-server/data]
 */

import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = resolve(root, '..', 'terraria-journey-tracker-server', 'data');
const FILES = ['items.json', 'recipes.json', 'stations.json', 'drops.json'];

const source = resolve(process.argv[2] ?? DEFAULT_SOURCE);
const target = join(root, 'static', 'data');

try {
	await stat(join(source, 'items.json'));
} catch {
	console.error(`error: no items.json in ${source}`);
	console.error('Point this at the server checkout, e.g.');
	console.error('  npm run sync-data -- ../terraria-journey-tracker-server/data');
	process.exit(1);
}

await mkdir(target, { recursive: true });
for (const name of FILES) {
	await cp(join(source, name), join(target, name));
}

const written = await readdir(target);
console.log(`copied ${written.length} files from ${source} into static/data`);
