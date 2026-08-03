import { describe, expect, it } from 'vitest';
import { computeClosure } from './closure';
import { buildGraph } from './graph';
import { computeLeverage } from './leverage';
import { catalogue, ingredient, item, recipe } from '$lib/testing/fixtures';

/** Wood -> Plank -> Table, plus a dead recipe and an item nothing uses. */
function chain() {
	return catalogue(
		[
			item(1, 'Wood', { research: 100 }),
			item(2, 'Ebonwood', { research: 100 }),
			item(3, 'Plank'),
			item(4, 'Table'),
			item(5, 'Soul of Blight'),
			item(6, 'Ghost Sword'),
			item(7, 'Loose Rock')
		],
		[
			recipe(3, 'Plank', [ingredient('Any Wood', [1, 2], 1)]),
			recipe(4, 'Table', [ingredient('Plank', [3], 4)]),
			// Nothing satisfies this slot, mirroring the removed items in the real data.
			recipe(6, 'Ghost Sword', [ingredient('Soul of Blight', [], 1)])
		]
	);
}

describe('computeClosure', () => {
	it('follows the chain all the way, not just one step', () => {
		const graph = buildGraph(chain());
		const result = computeClosure(graph, [1]);

		// Wood alone reaches Plank and then Table.
		expect(result.unlocked).toEqual([3, 4]);
		expect(result.available.has(4)).toBe(true);
	});

	it('accepts any member of an alternative group', () => {
		const graph = buildGraph(chain());
		expect(computeClosure(graph, [2]).unlocked).toEqual([3, 4]);
	});

	it('never reaches a recipe with an unsatisfiable ingredient', () => {
		const graph = buildGraph(chain());
		const result = computeClosure(graph, [1, 2, 3, 4, 5, 7]);

		expect(result.available.has(6)).toBe(false);
	});

	it('reports nothing new when everything is already researched', () => {
		const graph = buildGraph(chain());
		expect(computeClosure(graph, [1, 3, 4]).unlocked).toEqual([]);
	});

	it('terminates on a cyclic pair', () => {
		const cyclic = catalogue(
			[item(1, 'A'), item(2, 'B'), item(3, 'Seed')],
			[
				recipe(1, 'A', [ingredient('B', [2], 1)]),
				recipe(2, 'B', [ingredient('A', [1], 1)]),
				recipe(3, 'Seed', [ingredient('A', [1], 1)])
			]
		);
		const graph = buildGraph(cyclic);

		expect(computeClosure(graph, []).unlocked).toEqual([]);
		expect(computeClosure(graph, [1]).available.has(2)).toBe(true);
	});

	it('handles an item filling two slots of one recipe', () => {
		const doubled = catalogue(
			[item(1, 'Gel'), item(2, 'Goo')],
			[recipe(2, 'Goo', [ingredient('Gel', [1], 1), ingredient('Gel again', [1], 1)])]
		);
		const graph = buildGraph(doubled);

		expect(computeClosure(graph, [1]).available.has(2)).toBe(true);
	});
});

describe('computeLeverage', () => {
	it('ranks by how much the cascade opens up', () => {
		const data = chain();
		const graph = buildGraph(data);
		const base = computeClosure(graph, []);

		const ranked = computeLeverage(graph, data, base);

		// Wood unlocks Plank and Table; nothing else unlocks anything.
		expect(ranked[0].id).toBe(1);
		expect(ranked[0].impact).toBe(2);
		expect(ranked[0].unlocks).toEqual([3, 4]);
	});

	it('weights by how many copies you must sacrifice', () => {
		const data = chain();
		const graph = buildGraph(data);
		const ranked = computeLeverage(graph, data, computeClosure(graph, []));

		// Wood needs 100 sacrifices for 2 unlocks.
		expect(ranked.find((r) => r.id === 1)?.impactPerSacrifice).toBeCloseTo(0.02);
	});

	it('skips items you can already reach', () => {
		const data = chain();
		const graph = buildGraph(data);
		const ranked = computeLeverage(graph, data, computeClosure(graph, [1]));

		expect(ranked.some((r) => r.id === 1)).toBe(false);
		expect(ranked.some((r) => r.id === 3)).toBe(false);
	});

	it('leaves the base state untouched so rankings do not drift', () => {
		const data = chain();
		const graph = buildGraph(data);
		const base = computeClosure(graph, []);
		const before = Int32Array.from(base.remainingSlots);

		computeLeverage(graph, data, base);

		expect(Array.from(base.remainingSlots)).toEqual(Array.from(before));
	});

	it('gives the same answer on a repeat run', () => {
		const data = chain();
		const graph = buildGraph(data);
		const base = computeClosure(graph, []);

		const first = computeLeverage(graph, data, base);
		const second = computeLeverage(graph, data, base);

		expect(second).toEqual(first);
	});
});
