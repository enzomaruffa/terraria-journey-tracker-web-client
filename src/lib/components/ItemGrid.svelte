<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import Filters from './Filters.svelte';
	import ItemCard from './ItemCard.svelte';
	import type { Catalogue, Item, ItemState, Progress } from '$lib/types';

	interface Props {
		catalogue: Catalogue;
		progress: Progress;
	}

	let { catalogue, progress }: Props = $props();

	let search = $state('');
	let category = $state('');
	const states = new SvelteSet<ItemState>(['craftable', 'partial']);
	// 6,000 item nodes at once janks scrolling badly; reveal them in pages instead.
	let limit = $state(200);

	const PAGE = 200;

	let craftableSet = $derived(new SvelteSet(progress.craftable));

	let classified = $derived.by(() => {
		const rows: { item: Item; state: ItemState; sacrificed: number }[] = [];

		for (const item of catalogue.items.values()) {
			const sacrificed = progress.sacrificed[String(item.id)] ?? 0;
			let state: ItemState;

			if (sacrificed >= item.research) state = 'researched';
			else if (sacrificed > 0) state = 'partial';
			else if (craftableSet.has(item.id)) state = 'craftable';
			else state = 'locked';

			rows.push({ item, state, sacrificed });
		}

		return rows;
	});

	let counts = $derived.by(() => {
		const tally: Record<ItemState, number> = {
			researched: 0,
			partial: 0,
			craftable: 0,
			locked: 0
		};
		for (const row of classified) tally[row.state]++;
		return tally;
	});

	let categories = $derived.by(() => {
		const names = new SvelteSet<string>();
		for (const item of catalogue.items.values()) {
			for (const name of item.categories) names.add(name);
		}
		return [...names].sort();
	});

	let filtered = $derived.by(() => {
		const needle = search.trim().toLowerCase();

		return classified.filter((row) => {
			if (states.size > 0 && !states.has(row.state)) return false;
			if (category && !row.item.categories.includes(category)) return false;
			if (needle && !row.item.name.toLowerCase().includes(needle)) return false;
			return true;
		});
	});

	// Reset paging whenever the result set changes, so a new search starts at the top.
	$effect(() => {
		void search;
		void category;
		void states;
		limit = PAGE;
	});

	let visible = $derived(filtered.slice(0, limit));
</script>

<section>
	<Filters bind:search bind:category {states} {categories} {counts} />

	<p class="summary">
		{filtered.length.toLocaleString()}
		{filtered.length === 1 ? 'item' : 'items'}
		{#if filtered.length > visible.length}
			· showing {visible.length.toLocaleString()}
		{/if}
	</p>

	{#if visible.length === 0}
		<p class="empty">Nothing matches those filters.</p>
	{:else}
		<div class="grid">
			{#each visible as row (row.item.id)}
				<ItemCard item={row.item} state={row.state} sacrificed={row.sacrificed} />
			{/each}
		</div>
	{/if}

	{#if filtered.length > visible.length}
		<button type="button" class="more" onclick={() => (limit += PAGE * 2)}>
			Show more ({(filtered.length - visible.length).toLocaleString()} left)
		</button>
	{/if}
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.grid {
		display: grid;
		gap: 0.5rem;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
	}

	.summary,
	.empty {
		margin: 0;
		font-size: 0.8rem;
		color: var(--text-faint);
	}

	.more {
		align-self: center;
		padding: 0.55rem 1.2rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.more:hover {
		border-color: var(--text-faint);
	}
</style>
