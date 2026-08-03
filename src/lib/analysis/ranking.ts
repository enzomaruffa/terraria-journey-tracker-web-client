/**
 * Ordering "next up" by what is actually worth doing next.
 *
 * Ranking purely by how much an item unlocks puts Luminite first for everybody, because it
 * feeds the entire endgame. That is useless advice at 7% progress: Luminite drops from the
 * Moon Lord, so "go get Luminite" means "finish the game". A suggestion is only useful if it
 * is something you can plausibly go and do now.
 *
 * There is no progression field in the data, but there is a hardmode flag, which is the one
 * hard gate that matters — hardmode starts only once the Wall of Flesh dies, and nothing
 * behind it is obtainable before then. Comparing what the player has already researched
 * against that flag is enough to tell which side of the gate they are on.
 */

import type { Leverage } from './leverage';
import type { Catalogue, Progress } from '$lib/types';

export type Stage = 'pre-hardmode' | 'hardmode';

export interface RankedEntry extends Leverage {
	/** Behind a gate the player has not passed yet. */
	locked: boolean;
}

/**
 * Which side of the hardmode gate the player is on.
 *
 * A handful of hardmode items leak in early through fishing crates, so this needs a margin
 * rather than triggering on the first one.
 */
export function playerStage(catalogue: Catalogue, progress: Progress): Stage {
	let hardmode = 0;

	for (const key of Object.keys(progress.sacrificed)) {
		const item = catalogue.items.get(Number(key));
		if (!item || !item.hardmode) continue;
		if ((progress.sacrificed[key] ?? 0) >= item.research) hardmode += 1;
	}

	return hardmode >= 15 ? 'hardmode' : 'pre-hardmode';
}

export type SortMode = 'best' | 'impact' | 'efficiency';

/**
 * Order candidates for the "next up" list.
 *
 * `best` keeps items you can reach now ahead of ones you cannot, and only then sorts by how
 * much each opens up. The other two modes are unfiltered, for when you want the raw numbers.
 */
export function rankCandidates(
	leverage: Leverage[],
	catalogue: Catalogue,
	stage: Stage,
	mode: SortMode
): RankedEntry[] {
	const ranked: RankedEntry[] = leverage.map((entry) => ({
		...entry,
		locked: stage === 'pre-hardmode' && (catalogue.items.get(entry.id)?.hardmode ?? false)
	}));

	if (mode === 'impact') {
		ranked.sort((a, b) => b.impact - a.impact || a.id - b.id);
	} else if (mode === 'efficiency') {
		ranked.sort((a, b) => b.impactPerSacrifice - a.impactPerSacrifice || b.impact - a.impact);
	} else {
		ranked.sort(
			(a, b) => Number(a.locked) - Number(b.locked) || b.impact - a.impact || a.id - b.id
		);
	}

	return ranked;
}
