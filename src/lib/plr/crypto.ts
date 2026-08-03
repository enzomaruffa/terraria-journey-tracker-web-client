/**
 * Terraria encrypts character files with AES-128-CBC under a key it ships in its own
 * binary. The key doubles as the IV and is the UTF-16LE encoding of "h3y_gUyZ".
 */

const PASSPHRASE = 'h3y_gUyZ';
const BLOCK_SIZE = 16;

function keyBytes(): Uint8Array {
	const bytes = new Uint8Array(PASSPHRASE.length * 2);
	for (let i = 0; i < PASSPHRASE.length; i++) {
		bytes[i * 2] = PASSPHRASE.charCodeAt(i) & 0xff;
		bytes[i * 2 + 1] = PASSPHRASE.charCodeAt(i) >> 8;
	}
	return bytes;
}

async function importKey(): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', keyBytes() as BufferSource, 'AES-CBC', false, [
		'decrypt',
		'encrypt'
	]);
}

/**
 * Build a trailing block that makes an unpadded ciphertext decrypt cleanly.
 *
 * WebCrypto always validates PKCS#7 padding on AES-CBC and offers no way to turn it off.
 * Terraria's files are padded, but a truncated or hand-edited one is not, and that would
 * otherwise fail with an unhelpful "operation failed". Appending E(0x10… XOR Cn) makes the
 * final decrypted block a full pad, which WebCrypto then strips, leaving exactly the
 * original plaintext.
 */
async function paddingBlockFor(key: CryptoKey, lastCipherBlock: Uint8Array): Promise<Uint8Array> {
	const target = new Uint8Array(BLOCK_SIZE).fill(BLOCK_SIZE);
	for (let i = 0; i < BLOCK_SIZE; i++) target[i] ^= lastCipherBlock[i];

	const encrypted = new Uint8Array(
		await crypto.subtle.encrypt(
			{ name: 'AES-CBC', iv: new Uint8Array(BLOCK_SIZE) },
			key,
			target as BufferSource
		)
	);
	return encrypted.slice(0, BLOCK_SIZE);
}

export async function decryptPlayerFile(raw: Uint8Array): Promise<Uint8Array> {
	if (raw.length === 0) throw new Error('That file is empty.');
	if (raw.length % BLOCK_SIZE !== 0) {
		throw new Error(
			`That file is ${raw.length} bytes, which is not a multiple of ${BLOCK_SIZE} — ` +
				'it is probably truncated or not a .plr file.'
		);
	}

	const key = await importKey();
	const iv = keyBytes();

	try {
		return new Uint8Array(
			await crypto.subtle.decrypt(
				{ name: 'AES-CBC', iv: iv as BufferSource },
				key,
				raw as BufferSource
			)
		);
	} catch {
		const lastBlock = raw.slice(raw.length - BLOCK_SIZE);
		const extended = new Uint8Array(raw.length + BLOCK_SIZE);
		extended.set(raw);
		extended.set(await paddingBlockFor(key, lastBlock), raw.length);

		return new Uint8Array(
			await crypto.subtle.decrypt(
				{ name: 'AES-CBC', iv: iv as BufferSource },
				key,
				extended as BufferSource
			)
		);
	}
}
