/**
 * The crafting graph, indexed for repeated closure queries.
 *
 * Journey mode's defining rule is that a researched item can be duplicated for free. So an
 * item is *available* if you have researched it, or if some recipe producing it has every
 * ingredient slot available — which makes availability a transitive closure over recipes,
 * not the single step the tracker used to compute.
 */

import type { Catalogue, Recipe } from '$lib/types';

export interface CraftGraph {
	recipes: Recipe[];
	/** Slot counts per recipe, parallel to `recipes`. */
	slotCount: Int32Array;
	/** For each item id, the indices of recipes that use it in some slot. */
	recipesUsing: Map<number, number[]>;
	/** For each recipe index, which slot each of its ingredient ids belongs to. */
	slotOf: Map<number, number[]>[];
	/** Item ids that appear as an ingredient anywhere — the only ones worth ranking. */
	ingredientIds: Set<number>;
}

/**
 * Build the index once per catalogue. Everything downstream reuses it, so the per-query cost
 * is proportional to what actually changes rather than to the size of the catalogue.
 */
export function buildGraph(catalogue: Catalogue): CraftGraph {
	const recipes = catalogue.recipes;
	const slotCount = new Int32Array(recipes.length);
	const recipesUsing = new Map<number, number[]>();
	const slotOf: Map<number, number[]>[] = [];
	const ingredientIds = new Set<number>();

	recipes.forEach((recipe, index) => {
		// A slot with no resolvable item can never be satisfied, so the recipe is dead. The
		// real data has a dozen of these, from items removed in later Terraria versions.
		const usable =
			recipe.ingredients.length > 0 && recipe.ingredients.every((i) => i.ids.length > 0);
		slotCount[index] = usable ? recipe.ingredients.length : -1;

		const perItem = new Map<number, number[]>();
		slotOf.push(perItem);
		if (!usable) return;

		recipe.ingredients.forEach((ing, slot) => {
			for (const id of ing.ids) {
				ingredientIds.add(id);

				let slots = perItem.get(id);
				if (!slots) {
					slots = [];
					perItem.set(id, slots);
					// Only register the recipe once per item even if the item fills two slots.
					const users = recipesUsing.get(id);
					if (users) users.push(index);
					else recipesUsing.set(id, [index]);
				}
				slots.push(slot);
			}
		});
	});

	return { recipes, slotCount, recipesUsing, slotOf, ingredientIds };
}
