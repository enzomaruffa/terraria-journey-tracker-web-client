/**
 * Working out how to actually get something.
 *
 * There are two honest answers, and an ordinary crafting calculator only gives the second.
 *
 * `unlock` — the Journey answer. Researching an ingredient makes it infinite, so once every
 * ingredient is researched the target can be crafted without limit and the quantity maths
 * stops mattering entirely. Planning becomes: find the cheapest set of *base* items to
 * research so the target falls out free. Researching Gel costs 25 Gel and then Gel is
 * unlimited forever, which beats gathering 34 Gel for one batch of Torches — cheaper, and
 * permanent.
 *
 * `once` — the classic answer. Exact quantities for a single craft, honouring recipe yield,
 * for when you just want the item and do not care about researching the tree.
 */

import type { Catalogue, Recipe } from '$lib/types';

export type PlanMode = 'unlock' | 'once';

export interface PlanNode {
	itemId: number;
	/** How many you need. In `unlock` mode this is the research cost of a base item. */
	quantity: number;
	/** Already researched, therefore free and infinite. */
	free: boolean;
	/** Must be obtained in the world — nothing further to expand. */
	gather: boolean;
	recipe: Recipe | null;
	/** How many times that recipe must be run (`once` mode). */
	crafts: number;
	children: PlanNode[];
}

export interface Plan {
	mode: PlanMode;
	target: number;
	root: PlanNode;
	/** Everything you must physically obtain, merged and sorted by quantity. */
	gather: { itemId: number; quantity: number }[];
	/** Total items to obtain — the number to compare plans by. */
	totalToGather: number;
	/** True when some branch has no possible source. */
	impossible: boolean;
}

const UNREACHABLE = Number.POSITIVE_INFINITY;

interface Context {
	catalogue: Catalogue;
	researched: Set<number>;
	recipesByResult: Map<number, Recipe[]>;
	mode: PlanMode;
}

function indexRecipes(catalogue: Catalogue): Map<number, Recipe[]> {
	const byResult = new Map<number, Recipe[]>();
	for (const recipe of catalogue.recipes) {
		const list = byResult.get(recipe.id);
		if (list) list.push(recipe);
		else byResult.set(recipe.id, [recipe]);
	}
	return byResult;
}

/**
 * Whether the item can be obtained in the world at all, as opposed to only crafted.
 *
 * A listed drop proves it. So does having no recipe: the Drops table only covers things that
 * drop from something, and says nothing about ore you mine or blocks you dig, so an item with
 * no recipe at all must still be obtainable somehow — Marble Block is the obvious case.
 */
function isGatherable(context: Context, itemId: number): boolean {
	return context.catalogue.drops.has(itemId) || !context.recipesByResult.has(itemId);
}

/**
 * Cost of making `itemId` available, counted in items you must physically obtain.
 *
 * Memoized per item: the researched set is fixed for one evaluation, so an item's cost cannot
 * change between branches. `ancestors` breaks the cycles the recipe data genuinely contains.
 */
function cost(
	context: Context,
	itemId: number,
	ancestors: Set<number>,
	memo: Map<number, number>
): number {
	if (context.researched.has(itemId)) return 0;

	const cached = memo.get(itemId);
	if (cached !== undefined) return cached;
	if (ancestors.has(itemId)) return UNREACHABLE;

	const item = context.catalogue.items.get(itemId);
	if (!item) return UNREACHABLE;

	// Gathering it directly costs one research batch, after which it is infinite.
	let best = isGatherable(context, itemId) ? item.research : UNREACHABLE;

	ancestors.add(itemId);
	for (const recipe of context.recipesByResult.get(itemId) ?? []) {
		if (recipe.ingredients.length === 0) continue;

		let total = 0;
		for (const ingredient of recipe.ingredients) {
			if (ingredient.ids.length === 0) {
				total = UNREACHABLE;
				break;
			}
			// A slot is satisfied by whichever member is cheapest.
			let cheapest = UNREACHABLE;
			for (const id of ingredient.ids) {
				cheapest = Math.min(cheapest, cost(context, id, ancestors, memo));
				if (cheapest === 0) break;
			}
			total += cheapest;
			if (total >= best) break;
		}
		best = Math.min(best, total);
	}
	ancestors.delete(itemId);

	// Only cache once the item is off the current path, so a cycle-truncated value is not kept.
	if (ancestors.size === 0 || best !== UNREACHABLE) memo.set(itemId, best);
	return best;
}

function cheapestRecipe(
	context: Context,
	itemId: number,
	ancestors: Set<number>,
	memo: Map<number, number>
): Recipe | null {
	let best: Recipe | null = null;
	let bestCost = UNREACHABLE;

	for (const recipe of context.recipesByResult.get(itemId) ?? []) {
		if (recipe.ingredients.length === 0) continue;
		if (recipe.ingredients.some((i) => i.ids.length === 0)) continue;
		if (recipe.ingredients.some((i) => i.ids.some((id) => ancestors.has(id)))) continue;

		let total = 0;
		for (const ingredient of recipe.ingredients) {
			let cheapest = UNREACHABLE;
			for (const id of ingredient.ids)
				cheapest = Math.min(cheapest, cost(context, id, ancestors, memo));
			total += cheapest;
		}

		if (total < bestCost) {
			bestCost = total;
			best = recipe;
		}
	}

	return bestCost === UNREACHABLE ? null : best;
}

function cheapestMember(
	context: Context,
	ids: number[],
	ancestors: Set<number>,
	memo: Map<number, number>
): number {
	let best = ids[0];
	let bestCost = UNREACHABLE;
	for (const id of ids) {
		const value = cost(context, id, ancestors, memo);
		if (value < bestCost) {
			bestCost = value;
			best = id;
		}
	}
	return best;
}

function build(
	context: Context,
	itemId: number,
	quantity: number,
	ancestors: Set<number>,
	memo: Map<number, number>,
	gather: Map<number, number>
): PlanNode {
	const item = context.catalogue.items.get(itemId);

	if (context.researched.has(itemId)) {
		return { itemId, quantity, free: true, gather: false, recipe: null, crafts: 0, children: [] };
	}

	const recipe = ancestors.has(itemId) ? null : cheapestRecipe(context, itemId, ancestors, memo);

	// Nothing to expand: this is something you go and find.
	if (!recipe) {
		if (context.mode === 'unlock') {
			// Research it once and it is infinite, so a material feeding several branches is
			// still only gathered once — set rather than accumulate.
			const needed = item?.research ?? quantity;
			gather.set(itemId, needed);
			return {
				itemId,
				quantity: needed,
				free: false,
				gather: true,
				recipe: null,
				crafts: 0,
				children: []
			};
		}

		gather.set(itemId, (gather.get(itemId) ?? 0) + quantity);
		return { itemId, quantity, free: false, gather: true, recipe: null, crafts: 0, children: [] };
	}

	// In unlock mode the count is irrelevant above the base layer: research the ingredients and
	// the target becomes unlimited. In once mode it drives how many times to run the recipe.
	const crafts = context.mode === 'once' ? Math.ceil(quantity / Math.max(recipe.yield, 1)) : 1;

	ancestors.add(itemId);
	const children = recipe.ingredients.map((ingredient) => {
		const chosen = cheapestMember(context, ingredient.ids, ancestors, memo);
		const childQuantity = context.mode === 'once' ? ingredient.amount * crafts : ingredient.amount;
		return build(context, chosen, childQuantity, ancestors, memo, gather);
	});
	ancestors.delete(itemId);

	return { itemId, quantity, free: false, gather: false, recipe, crafts, children };
}

export function buildPlan(
	catalogue: Catalogue,
	researched: Set<number>,
	target: number,
	mode: PlanMode = 'unlock'
): Plan {
	const context: Context = {
		catalogue,
		researched,
		recipesByResult: indexRecipes(catalogue),
		mode
	};

	const item = catalogue.items.get(target);
	const needed = item?.research ?? 1;
	const gather = new Map<number, number>();
	const root = build(context, target, needed, new Set(), new Map(), gather);

	const list = [...gather.entries()]
		.map(([itemId, quantity]) => ({ itemId, quantity }))
		.sort((a, b) => b.quantity - a.quantity || a.itemId - b.itemId);

	return {
		mode,
		target,
		root,
		gather: list,
		totalToGather: list.reduce((sum, entry) => sum + entry.quantity, 0),
		impossible: cost(context, target, new Set(), new Map()) === UNREACHABLE
	};
}
