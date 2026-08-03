/** Synthetic .plr builder, mirroring tests/plr_fixture.py on the server. Test-only. */

const MAGIC = [0x72, 0x65, 0x6c, 0x6f, 0x67, 0x69, 0x63];
const FILE_TYPE_PLAYER = 3;
const BLOCK_SIZE = 16;

const PASSPHRASE = 'h3y_gUyZ';

function keyBytes(): Uint8Array {
	const bytes = new Uint8Array(PASSPHRASE.length * 2);
	for (let i = 0; i < PASSPHRASE.length; i++) {
		bytes[i * 2] = PASSPHRASE.charCodeAt(i) & 0xff;
		bytes[i * 2 + 1] = PASSPHRASE.charCodeAt(i) >> 8;
	}
	return bytes;
}

export function write7BitEncodedInt(value: number): number[] {
	const out: number[] = [];
	while (value >= 0x80) {
		out.push((value & 0x7f) | 0x80);
		value >>>= 7;
	}
	out.push(value);
	return out;
}

export function writeString(text: string): number[] {
	const encoded = new TextEncoder().encode(text);
	return [...write7BitEncodedInt(encoded.length), ...encoded];
}

function int32(value: number): number[] {
	const buffer = new ArrayBuffer(4);
	new DataView(buffer).setInt32(0, value, true);
	return [...new Uint8Array(buffer)];
}

function uint32(value: number): number[] {
	const buffer = new ArrayBuffer(4);
	new DataView(buffer).setUint32(0, value, true);
	return [...new Uint8Array(buffer)];
}

/** Deterministic filler so a failing test is reproducible. */
function pseudoRandom(count: number, seed: number): number[] {
	const out: number[] = [];
	let state = seed >>> 0;
	for (let i = 0; i < count; i++) {
		state = (state * 1664525 + 1013904223) >>> 0;
		out.push((state >>> 16) & 0xff);
	}
	return out;
}

export interface FixtureOptions {
	name?: string;
	difficulty?: number;
	fileVersion?: number;
	research?: Record<string, number>;
	fillerBefore?: number;
	fillerAfter?: number;
	seed?: number;
	includeCount?: boolean;
	corruptMagic?: boolean;
}

export function buildPlrPlain(options: FixtureOptions = {}): Uint8Array {
	const {
		name = 'Testerino',
		difficulty = 3,
		fileVersion = 279,
		research = {},
		fillerBefore = 3000,
		fillerAfter = 500,
		seed = 1234,
		includeCount = true,
		corruptMagic = false
	} = options;

	const body: number[] = [
		...uint32(fileVersion),
		...(corruptMagic ? [0, 0, 0, 0, 0, 0, 0] : MAGIC),
		FILE_TYPE_PLAYER,
		...uint32(0), // revision
		...uint32(0), // favourite (8 bytes)
		...uint32(0),
		...writeString(name),
		difficulty,
		...pseudoRandom(fillerBefore, seed)
	];

	const entries = Object.entries(research);
	if (includeCount) body.push(...int32(entries.length));
	for (const [internalName, count] of entries) {
		body.push(...writeString(internalName), ...int32(count));
	}

	body.push(...pseudoRandom(fillerAfter, seed + 1));

	return new Uint8Array(body);
}

/** Encrypt exactly as Terraria does: AES-128-CBC with PKCS#7 padding. */
export async function encryptPlain(plain: Uint8Array): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey('raw', keyBytes() as BufferSource, 'AES-CBC', false, [
		'encrypt'
	]);
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-CBC', iv: keyBytes() as BufferSource },
		key,
		plain as BufferSource
	);
	return new Uint8Array(encrypted);
}

export async function buildPlr(options: FixtureOptions = {}): Promise<Uint8Array> {
	return encryptPlain(buildPlrPlain(options));
}

export { BLOCK_SIZE, keyBytes };
