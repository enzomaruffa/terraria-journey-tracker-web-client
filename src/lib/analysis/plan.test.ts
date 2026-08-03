import { describe, expect, it } from 'vitest';
import { buildPlan } from './plan';
import { catalogue, drop, ingredient, item, recipe } from '$lib/testing/fixtures';

/**
 * Torch is the case that motivated all of this: 1 Gel + 1 Wood yields *three* Torches, and
 * researching a Torch takes 100 of them.
 */
function torches() {
	return catalogue(
		[
			item(1, 'Gel', { research: 25 }),
			item(2, 'Wood', { research: 100 }),
			item(3, 'Torch', { research: 100 })
		],
		[recipe(3, 'Torch', [ingredient('Gel', [1], 1), ingredient('Wood', [2], 1)], { yield: 3 })],
		{ 1: [drop('Slime')], 2: [drop('Tree')] }
	);
}

describe('unlock mode — the Journey strategy', () => {
	it('costs the ingredients research, not a per-craft quantity', () => {
		// Research Gel (25) and Wood (100) and Torches become unlimited. Gathering 34 Gel for
		// one batch would be more work and would not leave you with infinite Gel.
		const plan = buildPlan(torches(), new Set(), 3, 'unlock');

		expect(plan.gather).toEqual([
			{ itemId: 2, quantity: 100 },
			{ itemId: 1, quantity: 25 }
		]);
		expect(plan.totalToGather).toBe(125);
	});

	it('charges nothing for an ingredient already researched', () => {
		const plan = buildPlan(torches(), new Set([1]), 3, 'unlock');

		expect(plan.gather).toEqual([{ itemId: 2, quantity: 100 }]);
		expect(plan.root.children[0].free).toBe(true);
	});

	it('needs nothing at all when everything is researched', () => {
		const plan = buildPlan(torches(), new Set([1, 2]), 3, 'unlock');
		expect(plan.totalToGather).toBe(0);
	});
});

describe('once mode — the crafting calculator', () => {
	it('accounts for yield instead of assuming one per craft', () => {
		// 100 Torches at 3 per craft is 34 crafts, so 34 Gel and 34 Wood — not 100 of each.
		const plan = buildPlan(torches(), new Set(), 3, 'once');

		expect(plan.root.crafts).toBe(34);
		expect(plan.gather).toEqual([
			{ itemId: 1, quantity: 34 },
			{ itemId: 2, quantity: 34 }
		]);
	});

	it('multiplies ingredient amounts by the number of crafts', () => {
		const data = catalogue(
			[item(1, 'Wood', { research: 100 }), item(2, 'Chest', { research: 2 })],
			[recipe(2, 'Chest', [ingredient('Wood', [1], 8)])],
			{ 1: [drop('Tree')] }
		);

		const plan = buildPlan(data, new Set(), 2, 'once');

		expect(plan.root.crafts).toBe(2);
		expect(plan.gather).toEqual([{ itemId: 1, quantity: 16 }]);
	});
});

describe('choosing a path', () => {
	it('takes the cheapest member of an alternative group', () => {
		const data = catalogue(
			[
				item(1, 'Wood', { research: 100 }),
				item(2, 'Ebonwood', { research: 10 }),
				item(3, 'Table', { research: 1 })
			],
			[recipe(3, 'Table', [ingredient('Any Wood', [1, 2], 1)])],
			{ 1: [drop('Tree')], 2: [drop('Corrupt Tree')] }
		);

		const plan = buildPlan(data, new Set(), 3, 'unlock');

		expect(plan.gather).toEqual([{ itemId: 2, quantity: 10 }]);
	});

	it('prefers crafting when it is cheaper than gathering', () => {
		const data = catalogue(
			[item(1, 'Twig', { research: 2 }), item(2, 'Log', { research: 500 })],
			[recipe(2, 'Log', [ingredient('Twig', [1], 1)])],
			{ 1: [drop('Bush')], 2: [drop('Rare Tree')] }
		);

		const plan = buildPlan(data, new Set(), 2, 'unlock');

		// Gathering 500 Logs is possible but researching 2 Twigs is far cheaper.
		expect(plan.gather).toEqual([{ itemId: 1, quantity: 2 }]);
	});

	it('treats an item with no recipe as findable even without a listed drop', () => {
		// Marble Block is mined, not dropped, so it never appears in the Drops table.
		const data = catalogue(
			[item(1, 'Marble Block', { research: 100 }), item(2, 'Marble Wall', { research: 400 })],
			[recipe(2, 'Marble Wall', [ingredient('Marble Block', [1], 1)])]
		);

		const plan = buildPlan(data, new Set(), 2, 'unlock');

		expect(plan.impossible).toBe(false);
		expect(plan.gather).toEqual([{ itemId: 1, quantity: 100 }]);
	});

	it('never offers to go and find a craft-only item', () => {
		const data = catalogue(
			[item(1, 'Ore', { research: 50 }), item(2, 'Bar', { research: 25 })],
			[recipe(2, 'Bar', [ingredient('Ore', [1], 3)])],
			{ 1: [drop('Rock')] }
		);

		const plan = buildPlan(data, new Set(), 2, 'unlock');

		// Bar has no drop source, so it must be reached through its recipe.
		expect(plan.gather).toEqual([{ itemId: 1, quantity: 50 }]);
		expect(plan.root.gather).toBe(false);
	});
});

describe('awkward data', () => {
	it('reports an unreachable target rather than inventing a path', () => {
		const data = catalogue(
			[item(1, 'Ghost Sword')],
			[recipe(1, 'Ghost Sword', [ingredient('Soul of Blight', [], 1)])]
		);

		expect(buildPlan(data, new Set(), 1, 'unlock').impossible).toBe(true);
	});

	it('terminates on a cyclic recipe pair', () => {
		const data = catalogue(
			[item(1, 'A', { research: 5 }), item(2, 'B', { research: 5 })],
			[recipe(1, 'A', [ingredient('B', [2], 1)]), recipe(2, 'B', [ingredient('A', [1], 1)])],
			{ 1: [drop('Somewhere')] }
		);

		const plan = buildPlan(data, new Set(), 2, 'unlock');

		expect(plan.gather).toEqual([{ itemId: 1, quantity: 5 }]);
	});

	it('merges the same material appearing in several branches', () => {
		const data = catalogue(
			[item(1, 'Iron', { research: 10 }), item(2, 'Hilt'), item(3, 'Blade'), item(4, 'Sword')],
			[
				recipe(2, 'Hilt', [ingredient('Iron', [1], 1)]),
				recipe(3, 'Blade', [ingredient('Iron', [1], 1)]),
				recipe(4, 'Sword', [ingredient('Hilt', [2], 1), ingredient('Blade', [3], 1)])
			],
			{ 1: [drop('Ore')] }
		);

		const plan = buildPlan(data, new Set(), 4, 'unlock');

		// Iron feeds both the Hilt and the Blade, but researching it once makes it infinite —
		// so it is gathered once, not once per branch.
		expect(plan.gather).toEqual([{ itemId: 1, quantity: 10 }]);
	});
});
