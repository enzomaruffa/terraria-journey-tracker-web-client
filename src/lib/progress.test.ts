import { describe, expect, it } from 'vitest';
import type { PlayerSave } from './plr/parse';
import { buildProgress, findCraftable } from './progress';
import { catalogue as buildCatalogue, ingredient, item, recipe } from './testing/fixtures';

function catalogue() {
	return buildCatalogue(
		[
			item(1, 'Wood', { research: 100 }),
			item(2, 'Ebonwood', { research: 100 }),
			item(3, 'Iron Bar', { research: 25 }),
			item(4, 'Chest'),
			item(5, 'Zenith')
		],
		[
			recipe(4, 'Chest', [ingredient('Any Wood', [1, 2], 8), ingredient('Iron Bar', [3], 2)]),
			// An ingredient no item satisfies, like the 12 removed items in the real data.
			recipe(5, 'Zenith', [ingredient('Soul of Blight', [], 1)])
		]
	);
}

function save(research: Record<string, number>, difficulty = 3): PlayerSave {
	return {
		name: 'Enzo',
		difficulty,
		difficultyName: difficulty === 3 ? 'journey' : 'classic',
		isJourney: difficulty === 3,
		fileVersion: 279,
		research: new Map(Object.entries(research)),
		researchFound: true,
		researchVerified: true
	};
}

describe('findCraftable', () => {
	it('needs every ingredient slot filled', () => {
		expect(findCraftable(catalogue(), new Set([1]))).toEqual([]);
	});

	it('accepts one member of an alternative group', () => {
		expect(findCraftable(catalogue(), new Set([2, 3]))).toEqual([4]);
	});

	it('does not suggest something already researched', () => {
		expect(findCraftable(catalogue(), new Set([1, 3, 4]))).toEqual([]);
	});

	it('never suggests a recipe with an unresolved ingredient', () => {
		expect(findCraftable(catalogue(), new Set([1, 2, 3]))).not.toContain(5);
	});
});

describe('buildProgress', () => {
	it('counts researched, partial and untouched items', () => {
		const progress = buildProgress(save({ Wood: 100, IronBar: 10 }), catalogue());

		expect(progress.overview.itemsTotal).toBe(5);
		expect(progress.overview.itemsResearched).toBe(1);
		expect(progress.overview.itemsPartial).toBe(1);
		expect(progress.overview.itemsUntouched).toBe(3);
		expect(progress.sacrificed).toEqual({ '1': 100, '3': 10 });
	});

	it('caps sacrifice totals at what the item requires', () => {
		const progress = buildProgress(save({ Wood: 999 }), catalogue());
		expect(progress.overview.sacrificesDone).toBe(100);
	});

	it('reports items missing from the bundled data', () => {
		const progress = buildProgress(save({ SomeNewItem: 3 }), catalogue());

		expect(progress.unknownInternalNames).toEqual(['SomeNewItem']);
		expect(progress.sacrificed).toEqual({});
	});

	it('matches the shape the server sends', () => {
		const progress = buildProgress(save({ Wood: 100 }), catalogue());

		expect(progress.player.isJourney).toBe(true);
		expect(progress.overview.percentItems).toBe(20);
		expect(typeof progress.updatedAt).toBe('string');
	});
});
