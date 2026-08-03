import { describe, expect, it } from 'vitest';
import type { PlayerSave } from './plr/parse';
import { buildProgress, findCraftable } from './progress';
import type { Catalogue, Item, Recipe } from './types';

function item(id: number, name: string, research = 1): Item {
	return {
		id,
		name,
		internalName: name.replace(/ /g, ''),
		research,
		imageUrl: '',
		wikiUrl: '',
		categories: [],
		rarity: 0
	};
}

function catalogue(): Catalogue {
	const items = new Map<number, Item>([
		[1, item(1, 'Wood', 100)],
		[2, item(2, 'Ebonwood', 100)],
		[3, item(3, 'Iron Bar', 25)],
		[4, item(4, 'Chest', 1)],
		[5, item(5, 'Zenith', 1)]
	]);

	const recipes: Recipe[] = [
		{
			id: 4,
			name: 'Chest',
			stationIds: [1],
			ingredients: [
				{ name: 'Any Wood', ids: [1, 2], amount: 8 },
				{ name: 'Iron Bar', ids: [3], amount: 2 }
			]
		},
		{
			id: 5,
			name: 'Zenith',
			stationIds: [1],
			ingredients: [{ name: 'Soul of Blight', ids: [], amount: 1 }]
		}
	];

	return { meta: { gameVersion: '1.4.5.6' }, items, recipes, stations: new Map() };
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
