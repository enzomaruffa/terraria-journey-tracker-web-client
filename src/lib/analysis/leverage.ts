/**
 * What to go and find next.
 *
 * For every item you cannot currently reach, this asks: if I researched *this*, how much of
 * the rest of the game falls open? That is the question a Journey completionist actually has,
 * and ranking by it turns an undifferentiated list of 5,000 missing items into a short list
 * worth acting on.
 */

import type { Catalogue } from '$lib/types';
import type { ClosureResult } from './closure';
import type { CraftGraph } from './graph';

export interface Leverage {
	id: number;
	/** How many further items researching this one would make reachable. */
	impact: number;
	/** Impact per item you must physically sacrifice — a block costs 100 copies, a sword 1. */
	impactPerSacrifice: number;
	/** The items it unlocks, capped for display. */
	unlocks: number[];
}

const MAX_UNLOCKS_KEPT = 200;

/**
 * Rank candidates by the size of the cascade they would trigger.
 *
 * Each candidate is evaluated against the *existing* closure state rather than from scratch:
 * we apply the candidate, run the worklist, then rewind every counter we touched using an undo
 * log. Most candidates unlock nothing, so total work is proportional to what is actually
 * unlocked rather than to candidates x recipes.
 */
export function computeLeverage(
	graph: CraftGraph,
	catalogue: Catalogue,
	base: ClosureResult
): Leverage[] {
	const { recipes, recipesUsing, slotOf } = graph;
	const remaining = base.remainingSlots;
	const filled = base.filledSlots;

	const results: Leverage[] = [];

	// Only items used as an ingredient can unlock anything downstream.
	for (const candidate of graph.ingredientIds) {
		if (base.available.has(candidate)) continue;
		if (!catalogue.items.has(candidate)) continue;

		const touchedSlots: [number, number][] = [];
		const added: number[] = [];
		const addedSet = new Set<number>([candidate]);
		const queue: number[] = [candidate];

		while (queue.length > 0) {
			const id = queue.pop() as number;
			const users = recipesUsing.get(id);
			if (!users) continue;

			for (const index of users) {
				if (remaining[index] <= 0) continue;

				for (const slot of slotOf[index].get(id) ?? []) {
					if (filled[index][slot]) continue;
					filled[index][slot] = 1;
					touchedSlots.push([index, slot]);
					remaining[index] -= 1;
				}

				if (remaining[index] === 0) {
					const result = recipes[index].id;
					if (!base.available.has(result) && !addedSet.has(result)) {
						addedSet.add(result);
						added.push(result);
						queue.push(result);
					}
				}
			}
		}

		// Rewind so the next candidate starts from the same base state. Every fill decremented
		// the counter exactly once, so undoing per slot restores it precisely.
		for (const [index, slot] of touchedSlots) {
			filled[index][slot] = 0;
			remaining[index] += 1;
		}

		if (added.length === 0) continue;

		const research = catalogue.items.get(candidate)?.research ?? 1;
		results.push({
			id: candidate,
			impact: added.length,
			impactPerSacrifice: added.length / Math.max(research, 1),
			unlocks: added.slice(0, MAX_UNLOCKS_KEPT)
		});
	}

	results.sort((a, b) => b.impact - a.impact || a.id - b.id);
	return results;
}
