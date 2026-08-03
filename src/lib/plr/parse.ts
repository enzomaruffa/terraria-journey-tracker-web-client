/**
 * Browser port of the server's character file parser.
 *
 * Same strategy: rather than walking to the research table with byte offsets that change
 * with every Terraria patch, find it by shape. Each entry is a .NET length-prefixed string
 * followed by a little-endian int32. A dozen of those in a row is a fingerprint nothing else
 * in the file produces.
 *
 * Names the bundled data does not recognise do not end a run — a player may be on a newer
 * Terraria, or running a mod — they only lower the run's confidence score.
 */

import { decryptPlayerFile } from './crypto';

const MAGIC = [0x72, 0x65, 0x6c, 0x6f, 0x67, 0x69, 0x63]; // "relogic"
const HEADER_SIZE = 24; // version(4) + magic(7) + filetype(1) + revision(4) + favourite(8)

const DIFFICULTY_NAMES: Record<number, string> = {
	0: 'classic',
	1: 'mediumcore',
	2: 'hardcore',
	3: 'journey'
};
const JOURNEY_DIFFICULTY = 3;

const MIN_NAME_LEN = 2;
const MAX_NAME_LEN = 64;
const MAX_SACRIFICE = 10_000;

// How many consecutive well-formed entries we demand before trusting an offset on the
// strength of the run alone.
const MIN_RUN = 12;

// Terraria writes the entry count immediately before the table. When that count matches the
// run exactly, far fewer entries are needed to be sure — which is what lets a freshly made
// Journey character, with only a handful of items researched, still be read.
const MIN_VERIFIED_RUN = 3;

// What share of a run's names must be ones the bundled data knows. The real table is very
// close to 1.0; random bytes that happen to parse score near 0.
const MIN_RECOGNISED = 0.5;

export interface PlayerSave {
	name: string;
	difficulty: number;
	difficultyName: string;
	isJourney: boolean;
	fileVersion: number;
	research: Map<string, number>;
	researchFound: boolean;
	researchVerified: boolean;
}

export class PlayerFileError extends Error {}

function isInternalNameByte(byte: number, first: boolean): boolean {
	const isUpper = byte >= 0x41 && byte <= 0x5a;
	const isLower = byte >= 0x61 && byte <= 0x7a;
	if (first) return isUpper || isLower;
	return isUpper || isLower || (byte >= 0x30 && byte <= 0x39) || byte === 0x5f;
}

interface Entry {
	name: string;
	count: number;
	next: number;
}

function candidateEntry(view: DataView, bytes: Uint8Array, offset: number): Entry | null {
	const length = bytes[offset];
	if (length < MIN_NAME_LEN || length > MAX_NAME_LEN) return null;

	const start = offset + 1;
	const end = start + length;
	if (end + 4 > bytes.length) return null;

	for (let i = start; i < end; i++) {
		if (!isInternalNameByte(bytes[i], i === start)) return null;
	}

	const count = view.getInt32(end, true);
	if (count < 0 || count > MAX_SACRIFICE) return null;

	let name = '';
	for (let i = start; i < end; i++) name += String.fromCharCode(bytes[i]);

	return { name, count, next: end + 4 };
}

function readString(view: DataView, bytes: Uint8Array, offset: number): [string, number] {
	let length = 0;
	let shift = 0;
	let cursor = offset;

	for (;;) {
		if (shift > 28 || cursor >= bytes.length) {
			throw new PlayerFileError('Malformed string length in the character file.');
		}
		const byte = bytes[cursor++];
		length |= (byte & 0x7f) << shift;
		if ((byte & 0x80) === 0) break;
		shift += 7;
	}

	const slice = bytes.subarray(cursor, cursor + length);
	return [new TextDecoder('utf-8').decode(slice), cursor + length];
}

function countMatches(view: DataView, start: number, found: number): boolean {
	return start >= 4 && view.getInt32(start - 4, true) === found;
}

function scanResearch(
	view: DataView,
	bytes: Uint8Array,
	knownNames: Set<string>
): { entries: Map<string, number>; verified: boolean } | null {
	let best: { entries: Map<string, number>; verified: boolean } | null = null;

	let offset = HEADER_SIZE;
	const limit = bytes.length - 8;

	while (offset < limit) {
		if (candidateEntry(view, bytes, offset) === null) {
			offset++;
			continue;
		}

		const entries = new Map<string, number>();
		let known = 0;
		let cursor = offset;

		while (cursor < limit) {
			const entry = candidateEntry(view, bytes, cursor);
			if (entry === null) break;
			// A repeat means we drifted; the table is a dictionary.
			if (entries.has(entry.name)) break;
			entries.set(entry.name, entry.count);
			if (knownNames.has(entry.name)) known += 1;
			cursor = entry.next;
		}

		const recognised = entries.size > 0 ? known / entries.size : 0;
		const verified = countMatches(view, offset, entries.size);
		const longEnough = entries.size >= MIN_RUN || (verified && entries.size >= MIN_VERIFIED_RUN);

		if (longEnough && recognised >= MIN_RECOGNISED) {
			// A run Terraria's own count agrees with always beats a longer unverified one.
			const better =
				best === null ||
				(verified && !best.verified) ||
				(verified === best.verified && entries.size > best.entries.size);

			if (better) best = { entries, verified };
			offset = cursor;
			continue;
		}

		offset++;
	}

	return best;
}

export async function parsePlayerFile(
	raw: Uint8Array,
	knownNames: Set<string>
): Promise<PlayerSave> {
	const bytes = await decryptPlayerFile(raw);
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

	if (bytes.length < HEADER_SIZE + 2) {
		throw new PlayerFileError('That file is too small to be a Terraria character.');
	}
	for (let i = 0; i < MAGIC.length; i++) {
		if (bytes[4 + i] !== MAGIC[i]) {
			throw new PlayerFileError(
				'That does not look like a Terraria character file — check it is a .plr and not a world or a backup.'
			);
		}
	}

	const fileVersion = view.getUint32(0, true);
	const [name, afterName] = readString(view, bytes, HEADER_SIZE);
	const rawDifficulty = bytes[afterName];
	const difficulty = rawDifficulty in DIFFICULTY_NAMES ? rawDifficulty : -1;

	const save: PlayerSave = {
		name,
		difficulty,
		difficultyName: DIFFICULTY_NAMES[difficulty] ?? 'unknown',
		isJourney: difficulty === JOURNEY_DIFFICULTY,
		fileVersion,
		research: new Map(),
		researchFound: false,
		researchVerified: false
	};

	const match = scanResearch(view, bytes, knownNames);
	if (match) {
		save.research = match.entries;
		save.researchFound = true;
		save.researchVerified = match.verified;
	}

	return save;
}
