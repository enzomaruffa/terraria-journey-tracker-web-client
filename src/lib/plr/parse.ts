/**
 * Browser port of the server's character file parser.
 *
 * Same strategy: rather than walking to the research table with byte offsets that change
 * with every Terraria patch, find it by shape. Each entry is a .NET length-prefixed string
 * followed by a little-endian int32, and each string must be an item internal name the
 * game ships. A dozen of those in a row is a fingerprint nothing else in the file produces.
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
const MIN_RUN = 12;

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

function scanResearch(
	view: DataView,
	bytes: Uint8Array,
	knownNames: Set<string>
): { entries: Map<string, number>; start: number } | null {
	let best: { entries: Map<string, number>; start: number } | null = null;

	let offset = HEADER_SIZE;
	const limit = bytes.length - 8;

	while (offset < limit) {
		if (candidateEntry(view, bytes, offset) === null) {
			offset++;
			continue;
		}

		const entries = new Map<string, number>();
		let cursor = offset;

		while (cursor < limit) {
			const entry = candidateEntry(view, bytes, cursor);
			if (entry === null) break;
			if (!knownNames.has(entry.name)) break;
			if (entries.has(entry.name)) break;
			entries.set(entry.name, entry.count);
			cursor = entry.next;
		}

		if (entries.size >= MIN_RUN) {
			if (best === null || entries.size > best.entries.size) best = { entries, start: offset };
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
		// Terraria stores the entry count immediately before the table.
		save.researchVerified =
			match.start >= 4 && view.getInt32(match.start - 4, true) === match.entries.size;
	}

	return save;
}
