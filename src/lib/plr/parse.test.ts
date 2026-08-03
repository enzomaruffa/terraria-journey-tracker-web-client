import { describe, expect, it } from 'vitest';
import { decryptPlayerFile } from './crypto';
import { buildPlr, buildPlrPlain, encryptPlain, writeString } from './fixture';
import { PlayerFileError, parsePlayerFile } from './parse';

const RESEARCH: Record<string, number> = {
	IronPickaxe: 1,
	DirtBlock: 100,
	StoneBlock: 100,
	Wood: 100,
	Gel: 25,
	Torch: 100,
	IronBar: 25,
	LeadBar: 25,
	CopperBar: 25,
	TinBar: 25,
	SilverBar: 25,
	GoldBar: 25,
	Zenith: 1,
	Muramasa: 1,
	Excalibur: 1
};

const KNOWN = new Set(Object.keys(RESEARCH));

describe('decryptPlayerFile', () => {
	it('rejects an empty file', async () => {
		await expect(decryptPlayerFile(new Uint8Array(0))).rejects.toThrow('empty');
	});

	it('rejects a file that is not a whole number of blocks', async () => {
		await expect(decryptPlayerFile(new Uint8Array(17))).rejects.toThrow('not a multiple');
	});

	it('reads a file carrying no PKCS#7 padding', async () => {
		// WebCrypto always validates padding and cannot be told not to. The parser appends a
		// synthetic block so an unpadded or hand-edited file still decrypts, rather than
		// failing with an opaque "operation failed".
		const plain = buildPlrPlain({ research: RESEARCH });
		const aligned = plain.slice(0, plain.length - (plain.length % 16));
		const unpadded = (await encryptPlain(aligned)).slice(0, aligned.length);

		const decrypted = await decryptPlayerFile(unpadded);

		expect(decrypted.length).toBe(aligned.length);
		expect([...decrypted.slice(0, 16)]).toEqual([...aligned.slice(0, 16)]);
	});
});

describe('parsePlayerFile', () => {
	it('reads the header', async () => {
		const raw = await buildPlr({ name: 'Enzo', difficulty: 3, research: RESEARCH });
		const save = await parsePlayerFile(raw, KNOWN);

		expect(save.name).toBe('Enzo');
		expect(save.difficultyName).toBe('journey');
		expect(save.isJourney).toBe(true);
		expect(save.fileVersion).toBe(279);
	});

	it('finds the research table wherever it sits', async () => {
		for (const fillerBefore of [0, 500, 3000, 12_000]) {
			const raw = await buildPlr({ research: RESEARCH, fillerBefore, seed: fillerBefore + 7 });
			const save = await parsePlayerFile(raw, KNOWN);

			expect(save.researchFound).toBe(true);
			expect(Object.fromEntries(save.research)).toEqual(RESEARCH);
		}
	});

	it('confirms the match against the stored entry count', async () => {
		const raw = await buildPlr({ research: RESEARCH });
		expect((await parsePlayerFile(raw, KNOWN)).researchVerified).toBe(true);
	});

	it('survives a future file layout', async () => {
		const raw = await buildPlr({ research: RESEARCH, fileVersion: 999, fillerBefore: 40_000 });
		const save = await parsePlayerFile(raw, KNOWN);

		expect(Object.fromEntries(save.research)).toEqual(RESEARCH);
	});

	it('ignores a decoy run shorter than the threshold', async () => {
		const decoy = [...writeString('IronPickaxe'), 1, 0, 0, 0, ...writeString('Zenith'), 1, 0, 0, 0];
		const plain = buildPlrPlain({ research: RESEARCH, fillerBefore: 200, fillerAfter: 200 });
		const spliced = new Uint8Array([...plain.slice(0, 100), ...decoy, ...plain.slice(100)]);

		const save = await parsePlayerFile(await encryptPlain(spliced), KNOWN);

		expect(Object.fromEntries(save.research)).toEqual(RESEARCH);
	});

	it('keeps entries past a name the data does not know', async () => {
		// Happens whenever the player is on a newer Terraria than the bundled data, or is
		// running a mod. Ending the table there discarded everything beyond it, so a fully
		// researched item could read as zero.
		const mixed = { ...RESEARCH, SomeUnknownFutureItem: 5, GoldBroadsword: 1, Sunfury: 1 };
		const save = await parsePlayerFile(await buildPlr({ research: mixed }), KNOWN);

		expect(Object.fromEntries(save.research)).toEqual(mixed);
		expect(save.researchVerified).toBe(true);
	});

	it('still rejects a run of mostly unfamiliar names', async () => {
		const noise = Object.fromEntries(
			Array.from({ length: 40 }, (_, i) => [`NotARealItem${i}`, i + 1])
		);
		const save = await parsePlayerFile(await buildPlr({ research: noise }), KNOWN);

		expect(save.researchFound).toBe(false);
	});

	it('rejects a file that is not a character', async () => {
		const raw = await buildPlr({ research: RESEARCH, corruptMagic: true });
		await expect(parsePlayerFile(raw, KNOWN)).rejects.toThrow(PlayerFileError);
	});

	it('reads a brand new character with only a few items', async () => {
		// Too short to trust on length alone, but Terraria's own entry count confirms it.
		const tiny = { IronPickaxe: 1, DirtBlock: 100, Wood: 100, Gel: 25 };
		const save = await parsePlayerFile(await buildPlr({ research: tiny }), KNOWN);

		expect(Object.fromEntries(save.research)).toEqual(tiny);
		expect(save.researchVerified).toBe(true);
	});

	it('reports a character with no research table', async () => {
		const raw = await buildPlr({ research: {} });
		const save = await parsePlayerFile(raw, KNOWN);

		expect(save.researchFound).toBe(false);
		expect(save.research.size).toBe(0);
	});

	it('flags a non-Journey character', async () => {
		const raw = await buildPlr({ difficulty: 0, research: RESEARCH });
		const save = await parsePlayerFile(raw, KNOWN);

		expect(save.isJourney).toBe(false);
		expect(save.difficultyName).toBe('classic');
	});
});
