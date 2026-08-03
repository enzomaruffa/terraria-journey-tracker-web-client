<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import type { ItemState } from '$lib/types';

	interface Props {
		search: string;
		/** Reactive on its own, so it is mutated in place rather than bound. */
		states: SvelteSet<ItemState>;
		category: string;
		categories: string[];
		counts: Record<ItemState, number>;
	}

	let {
		search = $bindable(),
		states,
		category = $bindable(),
		categories,
		counts
	}: Props = $props();

	const options: { key: ItemState; label: string }[] = [
		{ key: 'craftable', label: 'Craftable now' },
		{ key: 'partial', label: 'In progress' },
		{ key: 'locked', label: 'Not started' },
		{ key: 'researched', label: 'Researched' }
	];

	function toggle(key: ItemState) {
		if (states.has(key)) states.delete(key);
		else states.add(key);
	}
</script>

<div class="filters">
	<input type="search" placeholder="Search items…" bind:value={search} aria-label="Search items" />

	<select bind:value={category} aria-label="Filter by category">
		<option value="">All categories</option>
		{#each categories as name (name)}
			<option value={name}>{name}</option>
		{/each}
	</select>

	<div class="chips">
		{#each options as option (option.key)}
			<button
				type="button"
				class="chip {option.key}"
				class:on={states.has(option.key)}
				aria-pressed={states.has(option.key)}
				onclick={() => toggle(option.key)}
			>
				{option.label}
				<span class="n">{counts[option.key].toLocaleString()}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem;
		align-items: center;
	}

	input,
	select {
		padding: 0.45rem 0.7rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 8px;
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
	}

	input {
		flex: 1 1 14rem;
		min-width: 10rem;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.7rem;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 999px;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.8rem;
		cursor: pointer;
	}

	.chip.on {
		color: var(--text);
		border-color: var(--chip);
		background: color-mix(in srgb, var(--chip) 16%, var(--surface));
	}

	.chip.craftable {
		--chip: var(--blue);
	}
	.chip.partial {
		--chip: var(--amber);
	}
	.chip.researched {
		--chip: var(--green);
	}
	.chip.locked {
		--chip: var(--text-faint);
	}

	.n {
		font-variant-numeric: tabular-nums;
		font-size: 0.72rem;
		color: var(--text-faint);
	}
</style>
