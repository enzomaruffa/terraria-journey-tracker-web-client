/** Builders for catalogue fixtures. Test-only; keeps specs to the fields they care about. */

import type { Catalogue, Drop, Ingredient, Item, Recipe } from '$lib/types';

export function item(id: number, name: string, overrides: Partial<Item> = {}): Item {
	return {
		id,
		name,
		internalName: name.replace(/[^A-Za-z0-9]/g, ''),
		research: 1,
		imageUrl: '',
		wikiUrl: '',
		categories: [],
		rarity: 0,
		tooltip: [],
		sell: null,
		buy: null,
		damage: null,
		defense: null,
		maxStack: null,
		placeable: false,
		hardmode: false,
		consumable: false,
		...overrides
	};
}

export function ingredient(name: string, ids: number[], amount = 1): Ingredient {
	return { name, ids, amount };
}

export function recipe(
	id: number,
	name: string,
	ingredients: Ingredient[],
	overrides: Partial<Recipe> = {}
): Recipe {
	return { id, name, stationIds: [0], ingredients, yield: 1, ...overrides };
}

export function drop(source: string, overrides: Partial<Drop> = {}): Drop {
	return {
		source,
		quantity: '1',
		rate: '100%',
		ratePercent: 100,
		expert: false,
		master: false,
		...overrides
	};
}

export function catalogue(
	items: Item[],
	recipes: Recipe[] = [],
	drops: Record<number, Drop[]> = {}
): Catalogue {
	return {
		meta: { gameVersion: 'test' },
		items: new Map(items.map((i) => [i.id, i])),
		recipes,
		stations: new Map(),
		drops: new Map(Object.entries(drops).map(([id, list]) => [Number(id), list]))
	};
}
