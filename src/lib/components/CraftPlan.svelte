<script lang="ts">
	/**
	 * How to actually get this item, in the two ways that matter.
	 *
	 * "Unlock the chain" is the Journey answer and the default: research the base ingredients
	 * and the target becomes unlimited. "One craft" is the ordinary calculator answer.
	 */
	import { buildPlan, type PlanMode, type PlanNode } from '$lib/analysis/plan';
	import { hideBrokenImage } from '$lib/images';
	import type { Catalogue } from '$lib/types';

	interface Props {
		catalogue: Catalogue;
		researched: Set<number>;
		target: number;
	}

	let { catalogue, researched, target }: Props = $props();

	let mode = $state<PlanMode>('unlock');
	let plan = $derived(buildPlan(catalogue, researched, target, mode));

	function name(id: number): string {
		return catalogue.items.get(id)?.name ?? `#${id}`;
	}

	function image(id: number): string {
		return catalogue.items.get(id)?.imageUrl ?? '';
	}

	/** Flatten for display; the tree is usually shallow enough to show whole. */
	function flatten(node: PlanNode, depth = 0): { node: PlanNode; depth: number }[] {
		return [{ node, depth }, ...node.children.flatMap((child) => flatten(child, depth + 1))];
	}

	let rows = $derived(flatten(plan.root).slice(0, 60));
</script>

<section class="panel">
	<header>
		<div>
			<h2 class="label">how to get it</h2>
			<p class="blurb">
				{#if mode === 'unlock'}
					Research these and the target becomes unlimited — researching an ingredient makes it
					infinite, so the per-craft amounts stop mattering.
				{:else}
					Exact materials for a single batch, accounting for how many each craft yields.
				{/if}
			</p>
		</div>

		<div class="modes">
			<button class="btn" class:on={mode === 'unlock'} onclick={() => (mode = 'unlock')}>
				unlock the chain
			</button>
			<button class="btn" class:on={mode === 'once'} onclick={() => (mode = 'once')}>
				one craft
			</button>
		</div>
	</header>

	{#if plan.impossible}
		<p class="empty label">no known way to obtain this — its recipe needs a removed item</p>
	{:else if plan.gather.length === 0}
		<p class="empty done label">everything needed is already researched — craft it freely</p>
	{:else}
		<div class="gather">
			<span class="label">go and get</span>
			<ul>
				{#each plan.gather as entry (entry.itemId)}
					<li>
						<img
							src={image(entry.itemId)}
							alt=""
							loading="lazy"
							referrerpolicy="no-referrer"
							onerror={hideBrokenImage}
						/>
						<span class="qty num">{entry.quantity}</span>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href="/item/{entry.itemId}">{name(entry.itemId)}</a>
					</li>
				{/each}
			</ul>
			<span class="total label">{plan.totalToGather.toLocaleString()} items in total</span>
		</div>

		<details>
			<summary class="label">show the full tree</summary>
			<ol class="tree">
				{#each rows as row, i (i)}
					<li style="padding-left: {row.depth * 1.1}rem">
						<span class="dot" class:free={row.node.free} class:gather={row.node.gather}></span>
						<span class="num qty">{row.node.quantity}</span>
						<span class="who">{name(row.node.itemId)}</span>
						{#if row.node.free}
							<span class="tag free-tag">researched · free</span>
						{:else if row.node.gather}
							<span class="tag">gather</span>
						{:else if row.node.recipe}
							<span class="tag craft">
								craft{row.node.crafts > 1 ? ` x${row.node.crafts}` : ''}
							</span>
						{/if}
					</li>
				{/each}
			</ol>
		</details>
	{/if}
</section>

<style>
	section {
		padding: 0.8rem 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		justify-content: space-between;
		gap: 0.7rem;
	}

	h2 {
		margin: 0;
		font-size: 0.68rem;
	}

	.blurb {
		margin: 0.3rem 0 0;
		max-width: 52ch;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.modes {
		display: flex;
		gap: 0.3rem;
	}

	.gather {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.gather ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.gather li {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.25rem 0.5rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.gather img {
		width: 20px;
		height: 20px;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.gather a {
		font-size: 0.78rem;
		text-decoration: none;
		color: var(--text-muted);
	}

	.gather a:hover {
		color: var(--cyan);
	}

	.qty {
		font-size: 0.75rem;
		font-weight: 650;
		color: var(--magenta);
	}

	.total {
		color: var(--text-faint);
	}

	summary {
		cursor: pointer;
	}

	.tree {
		list-style: none;
		margin: 0.5rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.tree li {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		font-size: 0.78rem;
	}

	.dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 50%;
		background: var(--cyan);
		flex: none;
	}

	.dot.free {
		background: var(--green);
	}

	.dot.gather {
		background: var(--magenta);
	}

	.who {
		color: var(--text-muted);
	}

	.tag {
		font-family: var(--mono);
		font-size: 0.62rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--magenta);
	}

	.tag.craft {
		color: var(--cyan);
	}

	.free-tag {
		color: var(--green);
	}

	.empty {
		margin: 0;
	}

	.done {
		color: var(--green);
	}
</style>
