/**
 * How far your research actually reaches.
 *
 * `findCraftable` in progress.ts answers "what is one craft away". This answers the question
 * that matters in Journey mode: craft something and you can research it, which makes it free,
 * which unlocks the recipes that use it. The reachable set is normally several times larger
 * than the one-step list.
 */

import type { CraftGraph } from './graph';

export interface ClosureResult {
	/** Everything you have, or can reach by crafting, without gathering anything. */
	available: Set<number>;
	/** The subset you do not have yet — the chain waiting to be crafted. */
	unlocked: number[];
	/** How many crafting steps from your researched items each entry sits. */
	depth: Map<number, number>;
	/** The deepest chain reachable, i.e. how far your research actually propagates. */
	maxDepth: number;
	/** Working state, reused by the leverage pass rather than rebuilt per candidate. */
	remainingSlots: Int32Array;
	filledSlots: Uint8Array[];
}

/**
 * Worklist closure. Each item is processed once and each recipe slot is filled once, so the
 * cost is proportional to the number of ingredient references rather than to repeated sweeps
 * over every recipe.
 */
export function computeClosure(graph: CraftGraph, researched: Iterable<number>): ClosureResult {
	const { recipes, slotCount, recipesUsing, slotOf } = graph;

	const remainingSlots = Int32Array.from(slotCount);
	const filledSlots: Uint8Array[] = recipes.map((r, i) =>
		slotCount[i] < 0 ? new Uint8Array(0) : new Uint8Array(r.ingredients.length)
	);

	const available = new Set<number>();
	const depth = new Map<number, number>();
	// A queue rather than a stack, so depths come out as true shortest craft distances.
	const queue: number[] = [];
	let head = 0;

	for (const id of researched) {
		if (!available.has(id)) {
			available.add(id);
			depth.set(id, 0);
			queue.push(id);
		}
	}

	const seeds = new Set(available);
	let maxDepth = 0;

	while (head < queue.length) {
		const id = queue[head++];

		const users = recipesUsing.get(id);
		if (!users) continue;

		for (const index of users) {
			if (remainingSlots[index] <= 0) continue;

			const filled = filledSlots[index];
			for (const slot of slotOf[index].get(id) ?? []) {
				// A slot is satisfied by *any* of its items, so only the first one counts.
				if (filled[slot]) continue;
				filled[slot] = 1;
				remainingSlots[index] -= 1;
			}

			if (remainingSlots[index] === 0) {
				const result = recipes[index].id;
				if (!available.has(result)) {
					available.add(result);
					const step = (depth.get(id) ?? 0) + 1;
					depth.set(result, step);
					if (step > maxDepth) maxDepth = step;
					queue.push(result);
				}
			}
		}
	}

	const unlocked: number[] = [];
	for (const id of available) {
		if (!seeds.has(id)) unlocked.push(id);
	}
	unlocked.sort((a, b) => a - b);

	return { available, unlocked, depth, maxDepth, remainingSlots, filledSlots };
}
