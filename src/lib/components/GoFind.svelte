<script lang="ts">
	/*
	 * Plain Map/Set on purpose: these are local working collections inside a pure
	 * computation, not shared state. Making them reactive re-triggers the very
	 * derivation that fills them.
	 */
	/* eslint-disable svelte/prefer-svelte-reactivity */
	/**
	 * Everything the cascade cannot reach — the actual to-do list.
	 *
	 * "Next up" is the shortlist of high-leverage picks. This is the complete set: every item
	 * you must go and obtain in the world, because no amount of crafting from what you have
	 * will produce it.
	 */
	import { hideBrokenImage } from '$lib/images';
	import { bestDropChance, sourceLabel } from '$lib/sources';
	import type { ClosureResult } from '$lib/analysis/closure';
	import type { Leverage } from '$lib/analysis/leverage';
	import type { Catalogue, Item } from '$lib/types';

	interface Props {
		catalogue: Catalogue;
		closure: ClosureResult | null;
		leverage: Leverage[];
	}

	let { catalogue, closure, leverage }: Props = $props();

	type Sort = 'unlocks' | 'cheapest' | 'easiest' | 'name';

	let search = $state('');
	let category = $state('');
	let sort = $state<Sort>('unlocks');
	let hardmodeOnly = $state(false);
	let dropsOnly = $state(false);
	let limit = $state(60);

	let impactById = $derived(new Map(leverage.map((entry) => [entry.id, entry.impact])));

	/** Items outside the closure entirely: not researched, and not craftable from what is. */
	let unreachable = $derived.by(() => {
		if (!closure) return [] as Item[];
		const out: Item[] = [];
		for (const item of catalogue.items.values()) {
			if (!closure.available.has(item.id)) out.push(item);
		}
		return out;
	});

	let categories = $derived.by(() => {
		const names = new Set<string>();
		for (const item of unreachable) for (const name of item.categories) names.add(name);
		return [...names].sort();
	});

	let filtered = $derived.by(() => {
		const needle = search.trim().toLowerCase();

		const list = unreachable.filter((item) => {
			if (hardmodeOnly && !item.hardmode) return false;
			if (dropsOnly && !catalogue.drops.has(item.id)) return false;
			if (category && !item.categories.includes(category)) return false;
			if (needle && !item.name.toLowerCase().includes(needle)) return false;
			return true;
		});

		list.sort((a, b) => {
			switch (sort) {
				case 'cheapest':
					return a.research - b.research || a.name.localeCompare(b.name);
				case 'easiest': {
					// Unknown drop chance sorts last rather than pretending to be zero.
					const left = bestDropChance(catalogue, a.id) ?? -1;
					const right = bestDropChance(catalogue, b.id) ?? -1;
					return right - left || a.name.localeCompare(b.name);
				}
				case 'name':
					return a.name.localeCompare(b.name);
				default:
					return (
						(impactById.get(b.id) ?? 0) - (impactById.get(a.id) ?? 0) ||
						a.name.localeCompare(b.name)
					);
			}
		});

		return list;
	});

	// A new filter should start at the top of the results.
	$effect(() => {
		void [search, category, sort, hardmodeOnly, dropsOnly];
		limit = 60;
	});

	let visible = $derived(filtered.slice(0, limit));
</script>

<section class="panel">
	<header>
		<div>
			<h2 class="label">go find</h2>
			<p class="blurb">
				Nothing you can craft will produce these — they have to be obtained in the world. This is
				the whole list, not just the high-leverage picks.
			</p>
		</div>
	</header>

	<div class="filters">
		<input type="search" placeholder="Search…" bind:value={search} aria-label="Search items" />

		<select bind:value={category} aria-label="Filter by category">
			<option value="">All categories</option>
			{#each categories as name (name)}
				<option value={name}>{name}</option>
			{/each}
		</select>

		<select bind:value={sort} aria-label="Sort order">
			<option value="unlocks">most unlocked</option>
			<option value="cheapest">fewest to sacrifice</option>
			<option value="easiest">best drop chance</option>
			<option value="name">name</option>
		</select>

		<button class="btn" class:on={hardmodeOnly} onclick={() => (hardmodeOnly = !hardmodeOnly)}>
			hardmode
		</button>
		<button class="btn" class:on={dropsOnly} onclick={() => (dropsOnly = !dropsOnly)}>
			has a known drop
		</button>
	</div>

	<p class="summary label">
		{filtered.length.toLocaleString()} to find
		{#if filtered.length > visible.length}· showing {visible.length}{/if}
	</p>

	{#if visible.length === 0}
		<p class="empty label">
			{unreachable.length === 0
				? 'everything in the game is reachable from what you have researched'
				: 'nothing matches those filters'}
		</p>
	{:else}
		<ul>
			{#each visible as item (item.id)}
				<li>
					<img
						src={item.imageUrl}
						alt=""
						loading="lazy"
						decoding="async"
						referrerpolicy="no-referrer"
						onerror={hideBrokenImage}
					/>

					<div class="who">
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a class="name" href="/item/{item.id}">{item.name}</a>
						<span class="src">{sourceLabel(catalogue, item.id)}</span>
					</div>

					<span class="meta">
						{#if item.hardmode}<span class="tag hard">hardmode</span>{/if}
						<span class="cost num">{item.research}x to research</span>
					</span>

					{#if impactById.get(item.id)}
						<span class="impact num">+{impactById.get(item.id)}</span>
					{:else}
						<span class="impact none">—</span>
					{/if}
				</li>
			{/each}
		</ul>

		{#if filtered.length > visible.length}
			<button class="btn more" onclick={() => (limit += 120)}>
				show more ({(filtered.length - visible.length).toLocaleString()} left)
			</button>
		{/if}
	{/if}
</section>

<style>
	section {
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0.7rem;
	}

	h2 {
		margin: 0;
		font-size: 0.68rem;
	}

	.blurb {
		margin: 0.3rem 0 0;
		max-width: 60ch;
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}

	input,
	select {
		padding: 0.4rem 0.65rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		color: inherit;
		font-family: var(--mono);
		font-size: 0.74rem;
	}

	input {
		flex: 1 1 12rem;
		min-width: 8rem;
	}

	input:focus,
	select:focus {
		border-color: var(--cyan);
	}

	.summary,
	.empty {
		margin: 0;
	}

	/*
	 * Cards on a wide screen, where there is room to spread out and scan visually; compact
	 * rows on a phone, where vertical density is what matters.
	 */
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
	}

	li {
		display: grid;
		grid-template-columns: 32px minmax(0, 1fr) auto;
		grid-template-areas:
			'icon who impact'
			'icon meta impact';
		align-items: center;
		gap: 0.1rem 0.6rem;
		padding: 0.55rem 0.65rem;
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		transition:
			border-color 0.15s,
			transform 0.15s;
	}

	li:hover {
		transform: translateY(-1px);
	}

	img {
		grid-area: icon;
	}

	.who {
		grid-area: who;
	}

	.impact,
	.impact.none {
		grid-area: impact;
	}

	.meta {
		grid-area: meta;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	li:hover {
		border-color: var(--border-strong);
	}

	img {
		width: 32px;
		height: 32px;
		object-fit: contain;
		image-rendering: pixelated;
	}

	.who {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.name {
		font-size: 0.82rem;
		color: var(--text);
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.name:hover {
		color: var(--cyan);
	}

	.src {
		font-size: 0.66rem;
		color: var(--text-faint);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tag {
		font-family: var(--mono);
		font-size: 0.58rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		padding: 0.1rem 0.35rem;
		border-radius: 999px;
	}

	.hard {
		color: var(--magenta);
		background: color-mix(in srgb, var(--magenta) 14%, transparent);
	}

	.cost {
		font-size: 0.72rem;
		color: var(--text-faint);
	}

	.impact {
		min-width: 2.5rem;
		text-align: right;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--cyan);
	}

	.impact.none {
		color: var(--text-faint);
		font-weight: 400;
	}

	.more {
		align-self: center;
	}

	@media (max-width: 640px) {
		ul {
			grid-template-columns: 1fr;
			gap: 0.25rem;
		}

		li {
			grid-template-columns: 26px minmax(0, 1fr) auto;
			grid-template-areas: 'icon who impact';
			padding: 0.35rem 0.5rem;
		}

		img {
			width: 26px;
			height: 26px;
		}

		.meta {
			display: none;
		}
	}
</style>
