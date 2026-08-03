/**
 * Runs the analysis against the real committed catalogue rather than a fixture.
 *
 * Two things are worth guarding: that the whole pass stays fast enough to run inline on every
 * progress update (it measured ~5ms, so the budget below is generous), and that the cascade
 * genuinely reaches further than the one-step list the tracker used to show.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeClosure } from './closure';
import { buildGraph } from './graph';
import { computeLeverage } from './leverage';
import type { Catalogue, Drop, Item, Recipe } from '$lib/types';

const DATA = new URL('../../../static/data/', import.meta.url).pathname;
const BUDGET_MS = 150;

function readCatalogue(): Catalogue {
	const read = (name: string) => JSON.parse(readFileSync(`${DATA}${name}`, 'utf8'));
	const items = read('items.json');
	const recipes = read('recipes.json');
	const drops = read('drops.json');

	return {
		meta: items.meta,
		items: new Map<number, Item>(
			Object.entries(items.items).map(([id, value]) => [Number(id), value as Item])
		),
		recipes: recipes.recipes as Recipe[],
		stations: new Map(),
		drops: new Map<number, Drop[]>(
			Object.entries(drops.drops).map(([id, value]) => [Number(id), value as Drop[]])
		)
	};
}

describe('analysis over the shipped catalogue', () => {
	const catalogue = readCatalogue();
	const graph = buildGraph(catalogue);
	// A mid-game character: the first few hundred items researched.
	const researched = [...catalogue.items.keys()].sort((a, b) => a - b).slice(0, 900);

	it('has a catalogue big enough to be the real thing', () => {
		expect(catalogue.items.size).toBeGreaterThan(6000);
		expect(catalogue.recipes.length).toBeGreaterThan(4000);
	});

	it('reaches further than a single crafting step', () => {
		const base = computeClosure(graph, researched);

		const researchedSet = new Set(researched);
		const oneStep = new Set(
			catalogue.recipes
				.filter(
					(r) =>
						r.ingredients.length > 0 &&
						!researchedSet.has(r.id) &&
						r.ingredients.every(
							(i) => i.ids.length > 0 && i.ids.some((id) => researchedSet.has(id))
						)
				)
				.map((r) => r.id)
		);

		expect(base.unlocked.length).toBeGreaterThan(oneStep.size);
	});

	it('ranks real progression bottlenecks at the top', () => {
		const base = computeClosure(graph, researched);
		const ranked = computeLeverage(graph, catalogue, base);

		expect(ranked.length).toBeGreaterThan(0);
		expect(ranked[0].impact).toBeGreaterThan(10);
		// Ordering is by impact, descending.
		expect(ranked[0].impact).toBeGreaterThanOrEqual(ranked[ranked.length - 1].impact);
	});

	it('never suggests something already reachable', () => {
		const base = computeClosure(graph, researched);
		const ranked = computeLeverage(graph, catalogue, base);

		for (const entry of ranked) {
			expect(base.available.has(entry.id)).toBe(false);
		}
	});

	it('completes fast enough to run inline on every update', () => {
		const started = performance.now();
		const base = computeClosure(graph, researched);
		computeLeverage(graph, catalogue, base);
		const elapsed = performance.now() - started;

		expect(elapsed).toBeLessThan(BUDGET_MS);
	});
});
