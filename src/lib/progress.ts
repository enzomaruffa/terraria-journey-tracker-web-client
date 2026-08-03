/**
 * Progress maths for the serverless mode.
 *
 * When the tracker server is running it sends this already computed; when you drop a .plr
 * onto the page there is nobody to ask, so the same rules live here too.
 */

import type { Catalogue, Progress } from './types';
import type { PlayerSave } from './plr/parse';

function percent(part: number, whole: number): number {
	if (whole <= 0) return 0;
	return Math.round(((100 * part) / whole) * 100) / 100;
}

export function findCraftable(catalogue: Catalogue, researched: Set<number>): number[] {
	const craftable = new Set<number>();

	for (const recipe of catalogue.recipes) {
		if (researched.has(recipe.id) || craftable.has(recipe.id)) continue;
		if (recipe.ingredients.length === 0) continue;

		const satisfied = recipe.ingredients.every(
			(ing) => ing.ids.length > 0 && ing.ids.some((id) => researched.has(id))
		);
		if (satisfied) craftable.add(recipe.id);
	}

	return [...craftable].sort((a, b) => a - b);
}

export function buildProgress(save: PlayerSave, catalogue: Catalogue): Progress {
	const byInternalName = new Map<string, number>();
	for (const item of catalogue.items.values()) byInternalName.set(item.internalName, item.id);

	const sacrificed: Record<string, number> = {};
	const unknown: string[] = [];

	for (const [internalName, count] of save.research) {
		const id = byInternalName.get(internalName);
		if (id === undefined) {
			unknown.push(internalName);
			continue;
		}
		if (count > 0) sacrificed[String(id)] = count;
	}

	const researched = new Set<number>();
	let partial = 0;
	let doneUnits = 0;
	let totalUnits = 0;

	for (const item of catalogue.items.values()) totalUnits += item.research;

	for (const [key, count] of Object.entries(sacrificed)) {
		const item = catalogue.items.get(Number(key));
		if (!item) continue;
		doneUnits += Math.min(count, item.research);
		if (count >= item.research) researched.add(item.id);
		else partial++;
	}

	const craftable = findCraftable(catalogue, researched);
	const itemsTotal = catalogue.items.size;

	return {
		player: {
			name: save.name,
			difficulty: save.difficultyName,
			isJourney: save.isJourney,
			fileVersion: save.fileVersion
		},
		overview: {
			itemsTotal,
			itemsResearched: researched.size,
			itemsPartial: partial,
			itemsUntouched: itemsTotal - researched.size - partial,
			percentItems: percent(researched.size, itemsTotal),
			sacrificesDone: doneUnits,
			sacrificesTotal: totalUnits,
			percentSacrifices: percent(doneUnits, totalUnits),
			craftableNow: craftable.length
		},
		sacrificed,
		craftable,
		researchFound: save.researchFound,
		researchVerified: save.researchVerified,
		unknownInternalNames: unknown.slice(0, 50),
		updatedAt: new Date().toISOString()
	};
}
