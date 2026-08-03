/**
 * Describing where an item comes from.
 *
 * The wiki's Drops table only covers things that drop from something, so it says nothing
 * about ore you mine or blocks you dig. Absence of a drop is therefore not evidence the item
 * is craft-only, and the wording here is careful not to claim otherwise.
 */

import type { Catalogue } from './types';

export function sourceLabel(catalogue: Catalogue, id: number, maxNames = 2): string {
	const drops = catalogue.drops.get(id);

	if (!drops || drops.length === 0) {
		const craftable = catalogue.recipes.some((recipe) => recipe.id === id);
		return craftable ? 'crafted' : 'found in the world';
	}

	// The same enemy appears more than once when its rate differs by difficulty.
	const unique = [...new Set(drops.map((drop) => drop.source))];
	const shown = unique.slice(0, maxNames).join(', ');
	return unique.length > maxNames ? `${shown} +${unique.length - maxNames}` : shown;
}

/** The best-known drop chance, for sorting by "easiest to actually get". */
export function bestDropChance(catalogue: Catalogue, id: number): number | null {
	const drops = catalogue.drops.get(id);
	if (!drops || drops.length === 0) return null;

	let best: number | null = null;
	for (const drop of drops) {
		if (drop.ratePercent === null) continue;
		if (best === null || drop.ratePercent > best) best = drop.ratePercent;
	}
	return best;
}
